import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import { estimatedImageCosts } from "@/config/costs";
import { ApiInputError, handleApiError, methodNotAllowed, parseJsonBody } from "@/lib/api-response";
import { createDemoEditedConcept } from "@/lib/demo-data";
import { normalizeDesignProfile } from "@/lib/design-profile";
import { updateDesignProfileFromEdit } from "@/lib/edit-profile";
import { requireRateLimit } from "@/lib/rate-limit";
import {
  getOrCreateDesignSession,
  getEditableImageUrlForUser,
  markUsageEventFailed,
  markUsageEventSucceeded,
  mapImageRecordToConcept,
  persistDesignImage,
  reserveImageCredit,
  requireAiAccess,
  requireAuthenticatedUser,
  storeGeneratedImageFromUrl,
  storeImageFromUrl,
  UsageReservationError
} from "@/lib/supabase-server";
import {
  ImageGenerationError,
  MissingImageApiTokenError,
  ReplicateImageProvider,
  buildEditPrompt,
  resolveImageModel
} from "@/services/image";
import type { DesignProfile } from "@/types/design";

export const runtime = "nodejs";
export const maxDuration = 180;

type EditDesignBody = {
  imageUrl?: string;
  editInstruction?: string;
  designProfile?: DesignProfile;
  sourceImageId?: string;
  sourceVersion?: number;
  rootId?: string;
  variationName?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<EditDesignBody>(request);
    const editInstruction = body.editInstruction?.trim() ?? "";

    if (!body.imageUrl || !isValidUrl(body.imageUrl)) {
      throw new ApiInputError("Please select a valid generated image to edit.");
    }

    if (!editInstruction) {
      throw new ApiInputError("Describe the refinement you would like to make.");
    }

    if (!body.sourceImageId || !body.sourceVersion) {
      throw new ApiInputError("The source image version could not be identified.");
    }

    const designProfile = normalizeDesignProfile(body.designProfile);
    const updatedDesignProfile = updateDesignProfileFromEdit(designProfile, editInstruction);
    const variationName = body.variationName?.trim() || "Edited Concept";
    const routing = resolveImageModel({
      preference: designProfile.imageModelPreference,
      designProfile,
      updatedDesignProfile,
      editInstruction,
      operation: "editing"
    });
    const selectedModel = routing.modelIdentifier;
    const routingMetadata = {
      modelPreference: routing.preference,
      effectiveModelPreference: routing.effectivePreference,
      wasArabicOverride: routing.wasArabicOverride
    };
    const prompt = buildEditPrompt({
      designProfile: updatedDesignProfile,
      editInstruction,
      sourceVariationName: variationName,
      preference: routing.effectivePreference
    });

    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;

    const accessDenied = requireAiAccess(auth);
    if (accessDenied) return accessDenied;

    if (serverEnv.demoMode && !serverEnv.replicateApiToken) {
      return NextResponse.json({
        image: createDemoEditedConcept({
          sourceImageId: body.sourceImageId,
          sourceVersion: body.sourceVersion,
          rootId: body.rootId || body.sourceImageId,
          variationName,
          editInstruction
        }),
        updatedDesignProfile,
        demoMode: true,
        ...routingMetadata
      });
    }

    const rateLimit = requireRateLimit(auth.user.id, "/api/edit-design", 5);
    if (rateLimit) return rateLimit;

    const sessionId = await getOrCreateDesignSession({
      userId: auth.user.id,
      sessionId: body.sessionId,
      designProfile: updatedDesignProfile
    });

    const reservation = await reserveImageCredit({
      userId: auth.user.id,
      sessionId,
      eventType: "image_edit",
      provider: "replicate",
      model: selectedModel,
      estimatedCost: estimatedImageCosts[routing.effectivePreference],
      metadata: {
        sourceImageId: body.sourceImageId,
        model: selectedModel,
        ...routingMetadata
      }
    });
    const startedAt = Date.now();
    let record;

    try {
      const provider = new ReplicateImageProvider();
      const resolvedImageUrl = await resolveSourceImageUrl({
        userId: auth.user.id,
        sessionId,
        sourceImageId: body.sourceImageId,
        imageUrl: body.imageUrl
      });
      const image = await provider.editDesign({
        imageUrl: resolvedImageUrl,
        prompt,
        editInstruction,
        sourceImageId: body.sourceImageId,
        sourceVersion: body.sourceVersion,
        rootId: body.rootId || body.sourceImageId,
        variationName,
        model: selectedModel
      });
      const stored = await storeGeneratedImageFromUrl({
        url: image.url,
        userId: auth.user.id,
        sessionId,
        imageId: image.id
      });
      record = await persistDesignImage({
        userId: auth.user.id,
        sessionId,
        concept: { ...image, url: stored.signedUrl },
        type: "edited",
        provider: "replicate",
        model: selectedModel,
        storagePath: stored.storagePath
      });

      await markUsageEventSucceeded({
        usageEventId: reservation.usageEventId,
        designImageId: record.id,
        latencyMs: Date.now() - startedAt,
        metadata: {
          sourceImageId: body.sourceImageId,
          storagePath: stored.storagePath,
          sourceStoragePath: stored.sourceStoragePath,
          watermarked: true,
          model: selectedModel,
          ...routingMetadata
        }
      });
    } catch (error) {
      try {
        await markUsageEventFailed({
          usageEventId: reservation.usageEventId,
          latencyMs: Date.now() - startedAt,
          errorCode: error instanceof ImageGenerationError ? "IMAGE_PROVIDER_ERROR" : "IMAGE_FLOW_ERROR",
          metadata: { sourceImageId: body.sourceImageId, model: selectedModel, ...routingMetadata }
        });
      } catch (statusError) {
        console.error("Reserved image edit usage event could not be marked failed.", statusError);
      }

      throw error;
    }

    return NextResponse.json({
      image: await mapImageRecordToConcept(record),
      updatedDesignProfile,
      sessionId,
      ...routingMetadata
    });
  } catch (error) {
    if (error instanceof UsageReservationError) {
      return NextResponse.json(
        {
          error: error.message,
          remainingCredits: 0
        },
        { status: error.code.includes("USER_BLOCKED") ? 403 : 429 }
      );
    }

    if (error instanceof MissingImageApiTokenError) {
      return NextResponse.json(
        {
          error: error.message
        },
        { status: 503 }
      );
    }

    if (error instanceof ImageGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return handleApiError(error, "The design edit could not be completed. Please try again.");
  }
}

export function GET() {
  return methodNotAllowed();
}

async function resolveSourceImageUrl({
  userId,
  sessionId,
  sourceImageId,
  imageUrl
}: {
  userId: string;
  sessionId: string;
  sourceImageId: string;
  imageUrl: string;
}) {
  const storedImageUrl = await getEditableImageUrlForUser(userId, sourceImageId);
  if (storedImageUrl) return storedImageUrl;

  try {
    const storedReference = await storeImageFromUrl({
      url: imageUrl,
      userId,
      sessionId,
      imageId: sourceImageId
    });
    return storedReference.signedUrl;
  } catch (error) {
    console.warn("Source image could not be copied before edit; using submitted URL.", error);
    return imageUrl;
  }
}

function isValidUrl(value: string) {
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
