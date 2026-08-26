import type { ImageModelPreference } from "@/types/design";

function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const estimatedCosts = {
  replicateFlux2ProImage: numberFromEnv("ESTIMATED_COST_REPLICATE_FLUX_2_PRO_IMAGE", 0.04),
  replicateGptImage2MediumImage: numberFromEnv("ESTIMATED_COST_REPLICATE_GPT_IMAGE_2_MEDIUM_IMAGE", 0.047),
  replicateNanoBanana2_1kImage: numberFromEnv("ESTIMATED_COST_REPLICATE_NANO_BANANA_2_1K_IMAGE", 0.067),
  replicateSeedream5LiteImage: numberFromEnv("ESTIMATED_COST_REPLICATE_SEEDREAM_5_LITE_IMAGE", 0.035),
  openAiChat: numberFromEnv("ESTIMATED_COST_OPENAI_CHAT", 0.01),
  openAiDesignBrief: numberFromEnv("ESTIMATED_COST_OPENAI_DESIGN_BRIEF", 0.02)
};

export const estimatedImageCosts: Readonly<Record<ImageModelPreference, number>> = {
  default: estimatedCosts.replicateFlux2ProImage,
  precise_changes: estimatedCosts.replicateGptImage2MediumImage,
  names_lettering: estimatedCosts.replicateNanoBanana2_1kImage,
  creative_exploration: estimatedCosts.replicateSeedream5LiteImage
};
