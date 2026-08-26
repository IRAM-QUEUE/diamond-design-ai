import { normalizeImageModelPreference } from "@/lib/design-profile";
import { requiresArabicJewelryLettering } from "@/lib/personalization";
import type { DesignProfile, ImageModelPreference } from "@/types/design";
import { imageModels, type ActiveReplicateImageModel } from "./models";

export type ImageOperation = "generation" | "editing";

type ImageModelRegistryEntry = {
  modelIdentifier: ActiveReplicateImageModel;
};

export const IMAGE_MODEL_REGISTRY: Readonly<Record<ImageModelPreference, ImageModelRegistryEntry>> = {
  default: {
    modelIdentifier: imageModels.flux2Pro
  },
  precise_changes: {
    modelIdentifier: imageModels.gptImage2
  },
  names_lettering: {
    modelIdentifier: imageModels.nanoBanana2
  },
  creative_exploration: {
    modelIdentifier: imageModels.seedream5Lite
  }
};

export type ResolvedImageModel = {
  preference: ImageModelPreference;
  effectivePreference: ImageModelPreference;
  modelIdentifier: ActiveReplicateImageModel;
  operation: ImageOperation;
  wasArabicOverride: boolean;
};

export function resolveImageModel({
  preference,
  designProfile,
  updatedDesignProfile,
  editInstruction,
  operation
}: {
  preference: unknown;
  designProfile: DesignProfile;
  updatedDesignProfile?: DesignProfile;
  editInstruction?: string;
  operation: ImageOperation;
}): ResolvedImageModel {
  const normalizedPreference = normalizeImageModelPreference(preference);
  const wasArabicOverride = requiresArabicJewelryLettering({
    designProfile,
    updatedDesignProfile,
    editInstruction
  });
  const effectivePreference: ImageModelPreference = wasArabicOverride
    ? "names_lettering"
    : normalizedPreference;

  return {
    preference: normalizedPreference,
    effectivePreference,
    modelIdentifier: IMAGE_MODEL_REGISTRY[effectivePreference].modelIdentifier,
    operation,
    wasArabicOverride
  };
}
