import { imageModels, type ActiveReplicateImageModel } from "./models";

export type ReplicateModelInput = Record<string, unknown>;

type InputBuilder = {
  generation: (prompt: string, referenceImageUrls: string[]) => ReplicateModelInput;
  editing: (prompt: string, imageUrl: string) => ReplicateModelInput;
};

const inputBuilders: Record<ActiveReplicateImageModel, InputBuilder> = {
  [imageModels.flux2Pro]: {
    generation: (prompt, referenceImageUrls) => ({
      prompt,
      input_images: referenceImageUrls,
      aspect_ratio: "1:1",
      resolution: "1 MP",
      output_format: "webp",
      output_quality: 80,
      safety_tolerance: 2
    }),
    editing: (prompt, imageUrl) => ({
      prompt,
      input_images: [imageUrl],
      aspect_ratio: "match_input_image",
      resolution: "match_input_image",
      output_format: "webp",
      output_quality: 80,
      safety_tolerance: 2
    })
  },
  [imageModels.gptImage2]: {
    generation: (prompt, referenceImageUrls) => ({
      prompt,
      input_images: referenceImageUrls,
      aspect_ratio: "1:1",
      quality: "medium",
      number_of_images: 1,
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      moderation: "auto"
    }),
    editing: (prompt, imageUrl) => ({
      prompt,
      input_images: [imageUrl],
      aspect_ratio: "1:1",
      quality: "medium",
      number_of_images: 1,
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      moderation: "auto"
    })
  },
  [imageModels.nanoBanana2]: {
    generation: (prompt, referenceImageUrls) => ({
      prompt,
      image_input: referenceImageUrls,
      aspect_ratio: "1:1",
      resolution: "1K",
      output_format: "png",
      google_search: false,
      image_search: false
    }),
    editing: (prompt, imageUrl) => ({
      prompt,
      image_input: [imageUrl],
      aspect_ratio: "match_input_image",
      resolution: "1K",
      output_format: "png",
      google_search: false,
      image_search: false
    })
  },
  [imageModels.seedream5Lite]: {
    generation: (prompt, referenceImageUrls) => ({
      prompt,
      image_input: referenceImageUrls,
      aspect_ratio: "1:1",
      size: "2K",
      sequential_image_generation: "disabled",
      max_images: 1,
      output_format: "png"
    }),
    editing: (prompt, imageUrl) => ({
      prompt,
      image_input: [imageUrl],
      aspect_ratio: "match_input_image",
      size: "2K",
      sequential_image_generation: "disabled",
      max_images: 1,
      output_format: "png"
    })
  }
};

export function buildReplicateGenerationInput(
  model: ActiveReplicateImageModel,
  prompt: string,
  referenceImageUrls: string[] = []
) {
  return inputBuilders[model].generation(prompt, referenceImageUrls);
}

export function buildReplicateEditInput(model: ActiveReplicateImageModel, prompt: string, imageUrl: string) {
  return inputBuilders[model].editing(prompt, imageUrl);
}
