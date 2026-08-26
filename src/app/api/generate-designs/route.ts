import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import { estimatedImageCosts } from "@/config/costs";
import { ApiInputError, handleApiError, methodNotAllowed, parseJsonBody } from "@/lib/api-response";
import { createDemoConcepts } from "@/lib/demo-data";
import { normalizeDesignProfile } from "@/lib/design-profile";
import { requireRateLimit } from "@/lib/rate-limit";
import {
  getOrCreateDesignSession,
  markUsageEventFailed,
  markUsageEventSucceeded,
  mapImageRecordToConcept,
  persistDesignImage,
  reserveImageCredit,
  requireAiAccess,
  requireAuthenticatedUser,
  storeGeneratedImageFromUrl,
  UsageReservationError
} from "@/lib/supabase-server";
import {
  ImageGenerationError,
  MissingImageApiTokenError,
  ReplicateImageProvider,
  buildDiamondConceptPrompts,
  resolveImageModel
} from "@/services/image";
import type { ChatMessage, DesignProfile } from "@/types/design";

export const runtime = "nodejs";
export const maxDuration = 180;

type GenerateDesignsBody = {
  designProfile?: DesignProfile;
  conversationContext?: ChatMessage[];
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<GenerateDesignsBody>(request);
    const designProfile = normalizeDesignProfile(body.designProfile);

    if (!designProfile.readyForGeneration) {
      throw new ApiInputError("The design direction is not ready yet. Continue the consultation before generating concepts.");
    }

    const routing = resolveImageModel({
      preference: designProfile.imageModelPreference,
      designProfile,
      operation: "generation"
    });
    const routingMetadata = {
      modelPreference: routing.preference,
      effectiveModelPreference: routing.effectivePreference,
      wasArabicOverride: routing.wasArabicOverride
    };

    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;

    const accessDenied = requireAiAccess(auth);
    if (accessDenied) return accessDenied;

    if (serverEnv.demoMode && !serverEnv.replicateApiToken) {
      return NextResponse.json({ images: createDemoConcepts(), demoMode: true, ...routingMetadata });
    }

    const rateLimit = requireRateLimit(auth.user.id, "/api/generate-designs", 5);
    if (rateLimit) return rateLimit;

    const sessionId = await getOrCreateDesignSession({
      userId: auth.user.id,
      sessionId: body.sessionId,
      designProfile
    });

    const selectedModel = routing.modelIdentifier;
    const prompts = buildDiamondConceptPrompts(designProfile, routing.effectivePreference).map((prompt) => ({
      ...prompt,
      model: selectedModel
    }));
    const reservation = await reserveImageCredit({
      userId: auth.user.id,
      sessionId,
      eventType: "image_generation",
      provider: "replicate",
      model: selectedModel,
      estimatedCost: estimatedImageCosts[routing.effectivePreference],
      metadata: { promptCount: prompts.length, model: selectedModel, ...routingMetadata }
    });
    const startedAt = Date.now();
    const savedImages = [];

    try {
      const provider = new ReplicateImageProvider();
      const images = await provider.generateDesigns(prompts);

      for (const image of images) {
        const normalizedImage = {
          ...image,
          rootId: image.rootId || image.id
        };
        const stored = await storeGeneratedImageFromUrl({
          url: normalizedImage.url,
          userId: auth.user.id,
          sessionId,
          imageId: normalizedImage.id
        });
        const record = await persistDesignImage({
          userId: auth.user.id,
          sessionId,
          concept: { ...normalizedImage, url: stored.signedUrl },
          type: "generated",
          provider: "replicate",
          model: selectedModel,
          storagePath: stored.storagePath
        });

        await markUsageEventSucceeded({
          usageEventId: reservation.usageEventId,
          designImageId: record.id,
          latencyMs: Date.now() - startedAt,
          metadata: {
            promptCount: prompts.length,
            storagePath: stored.storagePath,
            sourceStoragePath: stored.sourceStoragePath,
            watermarked: true,
            model: selectedModel,
            ...routingMetadata
          }
        });

        savedImages.push(await mapImageRecordToConcept(record));
      }
    } catch (error) {
      try {
        await markUsageEventFailed({
          usageEventId: reservation.usageEventId,
          latencyMs: Date.now() - startedAt,
          errorCode: error instanceof ImageGenerationError ? "IMAGE_PROVIDER_ERROR" : "IMAGE_FLOW_ERROR",
          metadata: { promptCount: prompts.length, model: selectedModel, ...routingMetadata }
        });
      } catch (statusError) {
        console.error("Reserved image generation usage event could not be marked failed.", statusError);
      }

      throw error;
    }

    return NextResponse.json({ images: savedImages, sessionId, ...routingMetadata });
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

    return handleApiError(error, "The design concepts could not be generated. Please try again.");
  }
}

export function GET() {
  return methodNotAllowed();
}
