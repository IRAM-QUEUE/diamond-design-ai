import type { DesignProfile } from "@/types/design";

const arabicUnicodePattern = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/;

export function containsArabicText(value: string | null | undefined) {
  return arabicUnicodePattern.test(value ?? "");
}

export function requiresArabicJewelryLettering({
  designProfile,
  updatedDesignProfile,
  editInstruction
}: {
  designProfile: DesignProfile;
  updatedDesignProfile?: DesignProfile;
  editInstruction?: string;
}) {
  const desiredProfile = updatedDesignProfile ?? designProfile;
  const personalizationText = desiredProfile.personalizationText.trim();

  if (containsArabicText(personalizationText)) {
    return true;
  }

  if (hasExplicitArabicLetteringRequest(editInstruction)) {
    return true;
  }

  return isConfirmedArabicScript(desiredProfile.personalizationScript) && Boolean(personalizationText);
}

function isConfirmedArabicScript(value: string) {
  return value.trim().toLowerCase() === "arabic";
}

function hasExplicitArabicLetteringRequest(value: string | undefined) {
  if (!value) return false;

  return /\barabic\s+(?:name|initial|inscription|lettering|text|calligraphy)\b|(?:اسم|حرف|نقش|كتابة|خط)\s+(?:عربي|بالعربية)|(?:خط|كتابة|نقش)\s+عربي/iu.test(
    value
  );
}
