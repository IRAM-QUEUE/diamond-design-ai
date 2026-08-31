import type { DesignProfile } from "@/types/design";
import { jewelryFonts } from "@/config/jewelry-fonts";
import { jewelryLetteringStyles } from "@/config/jewelry-lettering-styles";
import { containsArabicText } from "@/lib/personalization";

export function updateDesignProfileFromEdit(profile: DesignProfile, instruction: string): DesignProfile {
  const text = instruction.toLowerCase();
  const next: DesignProfile = {
    ...profile,
    notes: [...profile.notes]
  };

  if (text.includes("rose gold")) next.metal = "Rose Gold";
  if (text.includes("white gold")) next.metal = "White Gold";
  if (text.includes("yellow gold")) next.metal = "Yellow Gold";
  if (text.includes("platinum")) next.metal = "Platinum";

  const shapes = ["round", "oval", "emerald", "princess", "pear", "marquise", "radiant", "heart", "cushion"];
  const matchedShape = shapes.find((shape) => text.includes(shape));
  if (matchedShape) {
    next.diamondShape = titleCase(matchedShape);
  }

  if (text.includes("hidden halo")) next.setting = "Hidden Halo";
  else if (text.includes("remove halo") || text.includes("without halo") || text.includes("no halo")) {
    next.setting = next.setting.toLowerCase().includes("halo") ? "No Halo" : next.setting;
  } else if (text.includes("halo")) {
    next.setting = "Halo";
  }

  if (text.includes("thinner") || text.includes("thin band")) next.bandStyle = "Thin Band";
  if (text.includes("pave") || text.includes("pavé")) next.bandStyle = next.bandStyle ? `${next.bandStyle}, Pave` : "Pave";

  if (text.includes("minimal")) next.style = "Minimal";
  if (text.includes("luxurious") || text.includes("more luxury") || text.includes("more luxurious")) next.style = "Luxury";

  const requestedFont = jewelryFonts.find((font) => text.includes(font.name.toLowerCase()));
  if (requestedFont) next.fontPreference = requestedFont.name;

  const requestedLetteringStyle = jewelryLetteringStyles.find((style) => text.includes(style.name.toLowerCase()));
  if (requestedLetteringStyle) next.letteringStylePreference = requestedLetteringStyle.name;

  if (text.includes("arabic")) next.personalizationScript = "Arabic";
  if (text.includes("english") || text.includes("latin")) next.personalizationScript = "English or Latin";

  if (removesPersonalization(instruction)) {
    next.personalizationText = "";
    next.personalizationScript = "";
  } else {
    const requestedPersonalization = extractExplicitPersonalizationText(instruction);
    if (requestedPersonalization) {
      next.personalizationText = requestedPersonalization;
      if (containsArabicText(requestedPersonalization)) {
        next.personalizationScript = "Arabic";
      } else if (/\b(?:english|latin)\b/i.test(instruction)) {
        next.personalizationScript = "English or Latin";
      }
    }
  }

  const note = `Edit request: ${instruction.trim()}`;
  if (!next.notes.includes(note)) {
    next.notes = [...next.notes, note].slice(-8);
  }

  return next;
}

function removesPersonalization(instruction: string) {
  return /\b(?:remove|delete)\s+(?:the\s+)?(?:name|inscription|lettering|text)\b|\b(?:without|no)\s+(?:name|inscription|lettering|text)\b|(?:بدون|من دون)\s+(?:اسم|نقش|كتابة)|احذف\s+(?:الاسم|النقش|الكتابة)/iu.test(
    instruction
  );
}

function extractExplicitPersonalizationText(instruction: string) {
  const letteringKeyword = /\b(?:name|inscription|lettering|text|initial|arabic)\b|(?:اسم|الاسم|نقش|النقش|كتابة|الكتابة|حرف)/iu;
  const quotePattern = /["“”'‘’]([^"“”'‘’\r\n]{1,80})["“”'‘’]/gu;

  for (const match of instruction.matchAll(quotePattern)) {
    const candidate = cleanPersonalizationCandidate(match[1]);
    const start = Math.max(0, (match.index ?? 0) - 80);
    const end = Math.min(instruction.length, (match.index ?? 0) + match[0].length + 40);
    if (candidate && letteringKeyword.test(instruction.slice(start, end))) {
      return candidate;
    }
  }

  const explicitPatterns = [
    /\b(?:arabic\s+)?(?:name|inscription|lettering|text|initial)\s*(?:to|with|as|is|:)?\s*([\p{Script=Arabic}\p{Mark}]{1,40})/iu,
    /(?:باسم|الاسم|النقش|الكتابة|حرف)\s*(?:إلى|الى|هو|هي|:)?\s*([\p{Script=Arabic}\p{Mark}]{1,40})/u
  ];

  for (const pattern of explicitPatterns) {
    const candidate = cleanPersonalizationCandidate(instruction.match(pattern)?.[1]);
    if (candidate) return candidate;
  }

  return "";
}

function cleanPersonalizationCandidate(value: string | undefined) {
  return (value ?? "").trim().replace(/[.,!?؛،:]+$/u, "").slice(0, 80);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
