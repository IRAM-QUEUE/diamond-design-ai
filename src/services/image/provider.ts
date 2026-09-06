import type { ChatMessage, DesignProfile } from "@/types/design";
import type { ActiveReplicateImageModel } from "./models";

export type JewelryImagePrompt = {
  prompt: string;
  variationName: string;
  description: string;
  model?: ActiveReplicateImageModel;
  referenceImageUrls?: string[];
};

export type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  variationName: string;
  description: string;
  editInstruction?: string;
  version: number;
  parentId: string | null;
  rootId: string;
  createdAt: string;
};

export interface ImageGenerationProvider {
  generateDesigns(requests: JewelryImagePrompt[]): Promise<GeneratedImage[]>;
  editDesign(request: EditDesignProviderRequest): Promise<GeneratedImage>;
}

export type GenerateDesignsRequest = {
  designProfile: DesignProfile;
  conversationContext: ChatMessage[];
};

export type GenerateDesignsResponse = {
  images: GeneratedImage[];
};

export type EditDesignProviderRequest = {
  imageUrl: string;
  prompt: string;
  editInstruction: string;
  sourceImageId: string;
  sourceVersion: number;
  rootId: string;
  variationName: string;
  model?: ActiveReplicateImageModel;
};

export class MissingImageApiTokenError extends Error {
  constructor() {
    super("Replicate API token is missing. Add REPLICATE_API_TOKEN to .env.local and restart the server.");
    this.name = "MissingImageApiTokenError";
  }
}

export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}
