import {
  type ConversationStage,
  type DesignProfile,
  type ImageModelPreference,
  emptyDesignProfile
} from "@/types/design";

import { containsArabicText } from "@/lib/personalization";

const profileKeys = Object.keys(emptyDesignProfile) as Array<keyof DesignProfile>;

export function normalizeDesignProfile(input: unknown): DesignProfile {
  const source = isRecord(input) ? input : {};
  const profile: DesignProfile = { ...emptyDesignProfile };

  for (const key of profileKeys) {
    const value = source[key];

    if (key === "notes") {
      profile.notes = Array.isArray(value)
        ? value.filter((note): note is string => typeof note === "string").slice(0, 8)
        : [];
      continue;
    }

    if (key === "readyForGeneration") {
      profile.readyForGeneration = value === true;
      continue;
    }

    if (key === "imageModelPreference") {
      profile.imageModelPreference = normalizeImageModelPreference(value);
      continue;
    }

    profile[key] = (typeof value === "string" ? value.trim() : "") as never;
  }

  return profile;
}

export function normalizeImageModelPreference(input: unknown): ImageModelPreference {
  if (
    input === "default" ||
    input === "precise_changes" ||
    input === "names_lettering" ||
    input === "creative_exploration"
  ) {
    return input;
  }

  return "default";
}

export function normalizeStage(input: unknown, profile: DesignProfile): ConversationStage {
  if (input === "discovery" || input === "refinement" || input === "ready_to_generate") {
    return input;
  }

  return profile.readyForGeneration ? "ready_to_generate" : completedCoreFields(profile) >= 4 ? "refinement" : "discovery";
}

export function statusLabel(stage: ConversationStage) {
  const labels: Record<ConversationStage, string> = {
    discovery: "Discovery in progress",
    refinement: "Refining preferences",
    ready_to_generate: "Ready to generate concepts"
  };

  return labels[stage];
}

function completedCoreFields(profile: DesignProfile) {
  return [
    profile.jewelryType,
    profile.occasion,
    profile.recipient,
    profile.style,
    profile.metal,
    profile.diamondShape,
    profile.setting,
    profile.bandStyle,
    profile.budgetRange,
    profile.personalizationText,
    profile.personalizationScript,
    profile.fontPreference,
    profile.letteringStylePreference
  ].filter(Boolean).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Shared by consultation and generation: a model's ready flag is not sufficient.
export function missingDesignDetails(profile: DesignProfile): string[] {
  const missing: string[] = [];
  if (!profile.jewelryType) missing.push("jewelryType");
  if (!profile.metal || /^(?:gold|ذهب|ذهبي)$/iu.test(profile.metal.trim())) missing.push("metal");
  if (!profile.style && !profile.fontPreference && !profile.letteringStylePreference) missing.push("style");
  if (!profile.setting) missing.push("setting");
  const personalized = Boolean(profile.fontPreference || profile.letteringStylePreference || profile.personalizationScript) ||
    /name|initial|monogram|inscription|personaliz|اسم|أحرف|حروف|نقش/iu.test(profile.jewelryType);
  if (personalized && !profile.personalizationText) missing.push("personalizationText");
  if (/arabic|عربي/iu.test(profile.personalizationScript) && !containsArabicText(profile.personalizationText)) {
    if (!missing.includes("personalizationText")) missing.push("personalizationText");
  }
  return missing;
}

export function canGenerateDesign(profile: DesignProfile) {
  return profile.readyForGeneration && missingDesignDetails(profile).length === 0;
}

export function hasConsultantQuestion(message: string) {
  // Fail closed for a question, including Arabic. Structured clarification is also checked separately.
  return /[?؟]/u.test(message);
}
