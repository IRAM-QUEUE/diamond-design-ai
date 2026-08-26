import type { ImageModelPreference } from "@/types/design";

export type ImageModelOption = {
  preference: ImageModelPreference;
  name: string;
  description: string;
  modelLabel: string;
  badge: string;
};

export const imageModelOptions: readonly ImageModelOption[] = [
  {
    preference: "default",
    name: "Default",
    description: "Reliable, luxurious jewelry concepts with realistic materials and lighting.",
    modelLabel: "FLUX.2 Pro",
    badge: "Default"
  },
  {
    preference: "precise_changes",
    name: "Precise Changes",
    description: "Best for changing one detail while keeping the rest of the design intact.",
    modelLabel: "GPT Image 2",
    badge: "Precise edits"
  },
  {
    preference: "names_lettering",
    name: "Names & Lettering",
    description: "Best for exact multilingual text and physically connected, jewelry-ready lettering.",
    modelLabel: "Nano Banana 2",
    badge: "Best for text"
  },
  {
    preference: "creative_exploration",
    name: "Creative Exploration",
    description: "Best for imaginative variations, transformations, and new design directions.",
    modelLabel: "Seedream 5 Lite",
    badge: "Creative"
  }
] as const;

export function getImageModelOption(preference: ImageModelPreference) {
  return imageModelOptions.find((option) => option.preference === preference) ?? imageModelOptions[0];
}
