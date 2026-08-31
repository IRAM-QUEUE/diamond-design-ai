import { containsArabicText } from "@/lib/personalization";
import { jewelryFonts } from "@/config/jewelry-fonts";
import { jewelryLetteringStyles } from "@/config/jewelry-lettering-styles";
import type { DesignProfile, ImageModelPreference } from "@/types/design";
import type { JewelryImagePrompt } from "./provider";

type Direction = {
  variationName: string;
  description: string;
  emphasis: string;
};

const directions: Direction[] = [
  {
    variationName: "Luxury Concept",
    description: "A refined premium diamond concept shaped from the customer's selected direction.",
    emphasis:
      "a refined luxury diamond jewelry concept with a balanced, timeless, modern, high-end boutique aesthetic"
  }
];

export function buildDiamondConceptPrompts(
  profile: DesignProfile,
  preference: ImageModelPreference = "default"
): JewelryImagePrompt[] {
  return directions.map((direction) => ({
    variationName: direction.variationName,
    description: direction.description,
    prompt: buildGenerationPrompt(profile, direction, preference)
  }));
}

export function buildEditPrompt({
  designProfile,
  editInstruction,
  sourceVariationName,
  preference = "default"
}: {
  designProfile: DesignProfile;
  editInstruction: string;
  sourceVariationName: string;
  preference?: ImageModelPreference;
}) {
  const preserved = getPreservedElements(editInstruction);
  const preservationSentence = `Keep unchanged: ${preserved.join(", ")}.`;
  const profileDetails = describeProfile(designProfile);
  const personalization = describePersonalization(designProfile);
  const letteringDirective = buildExactLetteringDirective(designProfile);
  const textConstraint = buildImageTextConstraint(designProfile, true);

  if (preference === "precise_changes") {
    return [
      `Use the supplied ${sourceVariationName} image as the source of truth.`,
      `Requested change:\n${editInstruction.trim()}`,
      `Must remain unchanged:\n${preserved.map((item) => `- ${item}`).join("\n")}`,
      profileDetails ? `Desired resulting design details: ${profileDetails}.` : "",
      personalization,
      letteringDirective,
      textConstraint,
      "Apply only the requested change. The finished image must remain realistic luxury jewelry product photography."
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (preference === "names_lettering") {
    return [
      `Edit the supplied ${sourceVariationName} jewelry image. Requested change: ${editInstruction.trim()}.`,
      preservationSentence,
      profileDetails ? `The desired resulting jewelry is: ${profileDetails}.` : "",
      personalization,
      letteringDirective,
      textConstraint,
      "Return one realistic, wearable fine-jewelry product image with the original camera treatment preserved."
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (preference === "creative_exploration") {
    return [
      `Transform the supplied ${sourceVariationName} jewelry photograph according to this direction: ${editInstruction.trim()}.`,
      `Explore the requested creative direction while preserving every unaffected part of the source, including ${preserved.join(", ")}.`,
      profileDetails ? `The desired result should still follow these design details: ${profileDetails}.` : "",
      personalization,
      letteringDirective,
      textConstraint,
      "Present the result as one coherent, photorealistic luxury jewelry editorial product image."
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Edit the exact supplied ${sourceVariationName} jewelry photograph so the requested result is: ${editInstruction.trim()}.`,
    `Preserve the same design and photographic setup, including ${preserved.join(", ")}.`,
    profileDetails ? `The finished jewelry should positively match these details: ${profileDetails}.` : "",
    personalization,
    letteringDirective,
    textConstraint,
    "Apply the change locally and keep the result realistic, wearable, refined, and suitable for premium macro product photography."
  ]
    .filter(Boolean)
    .join(" ");
}

function buildGenerationPrompt(
  profile: DesignProfile,
  direction: Direction,
  preference: ImageModelPreference
) {
  const profileDetails = describeProfile(profile);
  const personalization = describePersonalization(profile);
  const letteringDirective = buildExactLetteringDirective(profile);
  const textConstraint = buildImageTextConstraint(profile, false);

  if (preference === "creative_exploration") {
    return [
      `Create one imaginative but wearable photorealistic luxury jewelry concept based on ${direction.emphasis}.`,
      profileDetails ? `The design should follow these customer details: ${profileDetails}.` : "",
      personalization,
      letteringDirective,
      textConstraint,
      "Photograph the finished piece in a refined, unbranded high-end studio setting with premium lighting, precise reflections, crisp diamond facets, realistic metal texture, and elegant black-and-silver styling.",
      "Use a square composition with the jewelry in sharp macro focus."
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Create one ${direction.emphasis}.`,
    profileDetails ? `Design details: ${profileDetails}.` : "",
    personalization,
    letteringDirective,
    textConstraint,
    "Show the finished piece as photorealistic luxury diamond jewelry product photography in a square composition.",
    "Use premium studio lighting, crisp diamond facets, precise elegant reflections, realistic metal texture, sharp macro focus, and refined unbranded black-and-silver studio styling."
  ]
    .filter(Boolean)
    .join(" ");
}

function describeProfile(profile: DesignProfile) {
  const customerNotes = profile.notes.filter((note) => !isStructuredLetteringSelectionNote(note));
  const fontStyle = describeFontStyle(profile.fontPreference);
  const constructionStyle = describeLetteringConstructionStyle(profile.letteringStylePreference);
  const parts = [
    profile.jewelryType ? `jewelry type: ${profile.jewelryType}` : "",
    profile.occasion ? `occasion: ${profile.occasion}` : "",
    profile.recipient ? `recipient: ${profile.recipient}` : "",
    profile.style ? `customer style preference: ${profile.style}` : "",
    profile.metal ? `metal: ${profile.metal}` : "",
    profile.diamondShape ? `center diamond shape: ${profile.diamondShape}` : "",
    profile.setting ? `setting: ${profile.setting}` : "",
    profile.bandStyle ? `band style: ${profile.bandStyle}` : "",
    profile.budgetRange ? `budget character: ${profile.budgetRange}` : "",
    profile.personalizationText ? `personalized name or inscription text: ${profile.personalizationText}` : "",
    profile.personalizationScript ? `personalization script/language: ${profile.personalizationScript}` : "",
    fontStyle ? `lettering style direction (visual treatment only, not text to render): ${fontStyle}` : "",
    constructionStyle
      ? `lettering jewelry construction direction (physical treatment, not text to render): ${constructionStyle}`
      : "",
    customerNotes.length ? `customer notes: ${customerNotes.join("; ")}` : ""
  ].filter(Boolean);

  return parts.join(", ");
}

function describePersonalization(profile: DesignProfile) {
  if (!profile.personalizationText && !profile.fontPreference && !profile.letteringStylePreference) return "";
  const fontStyle = describeFontStyle(profile.fontPreference);
  const constructionStyle = describeLetteringConstructionStyle(profile.letteringStylePreference);

  return [
    "Integrate the personalization as wearable fine-jewelry construction rather than flat printed text.",
    profile.personalizationText
      ? `The exact authoritative inscription is "${profile.personalizationText}".`
      : "",
    profile.personalizationScript ? `The inscription script is ${profile.personalizationScript}.` : "",
    fontStyle
      ? `Use this visual letterform direction without rendering any style label: ${fontStyle}.`
      : "",
    constructionStyle
      ? `Build the lettering with this selected physical jewelry treatment without rendering its style name: ${constructionStyle}.`
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function buildExactLetteringDirective(profile: DesignProfile) {
  const exactText = profile.personalizationText.trim();
  if (!exactText) return "";

  const base = [
    `Render the jewelry inscription once, exactly as "${exactText}".`,
    "Do not translate, transliterate, substitute, add, remove, decorate, mirror, reverse, or duplicate any character.",
    "Treat the inscription as a production-feasible jewelry component, never as flat printed typography or a collection of loose symbols.",
    "Use believable fine-jewelry metal thickness, clean edges, load-bearing joins, and secure attachment points.",
    "Every visible letter component must belong to one coherent wearable assembly; no piece may hover, float, balance loosely, or remain mechanically unsupported."
  ];
  const constructionStyle = describeLetteringConstructionStyle(profile.letteringStylePreference);

  if (constructionStyle) {
    base.push(
      `Follow this selected jewelry construction style while preserving exact spelling and legibility: ${constructionStyle}.`
    );
  }

  if (usesEngravedOrInlaidLettering(profile)) {
    base.push(
      "Construct the inscription as engraving or inlay within one continuous metal surface, so counters, dots, accents, and other marks are recessed or securely inlaid rather than separate raised pieces."
    );
  } else {
    base.push(
      "For freestanding or raised lettering, connect separate glyph sections with natural letter strokes or discreet structural metal bridges, a baseline rail, rim, or rear support that preserves the intended letter shapes.",
      "The chain, bail, band, or jewelry body must connect securely to the complete lettering assembly rather than to a fragile isolated stroke."
    );
  }

  if (containsArabicText(exactText)) {
    const fontStyle = describeFontStyle(profile.fontPreference);
    base.push(
      "Preserve exact Arabic right-to-left spelling and the correct contextual beginning, medial, final, and isolated letterforms.",
      "Join letters only where Arabic orthography joins them; do not wrongly join letters that are inherently non-connecting. Use discreet structural supports between otherwise separate word sections when manufacturing requires them.",
      "Keep every required Arabic dot, hamza, and diacritic in the correct count and exact visual position. No dot or mark may float in space: secure it with a tiny deliberate metal bridge, prong, rear support, or shared backplate without fusing it into the wrong stroke or changing the readable glyph.",
      fontStyle
        ? `Follow this selected lettering direction while keeping every Arabic character exact: ${fontStyle}.`
        : "Keep the Arabic lettering legible, refined, and structurally suitable for jewelry.",
      "Before finalizing, verify the Arabic spelling, joining behavior, dot count, dot placement, and physical support of every separate mark; correct any floating or disconnected component."
    );
  } else {
    base.push(
      "Preserve the exact left-to-right character order and recognizable Latin letter anatomy.",
      "Connect script letters through their natural strokes. For block or serif letters, counters, and detached i or j dots, use discreet bridges, prongs, a baseline, rim, or rear support so every component is physically secured without changing the inscription.",
      "Before finalizing, verify the exact spelling and confirm that lifting the jewelry would leave every letter and mark securely attached as one piece."
    );
  }

  return base.join(" ");
}

function usesEngravedOrInlaidLettering(profile: DesignProfile) {
  const designContext = [
    profile.jewelryType,
    profile.style,
    profile.setting,
    profile.bandStyle,
    profile.letteringStylePreference,
    ...profile.notes
  ]
    .join(" ")
    .toLowerCase();

  return /\b(?:engraved?|engraving|etched?|etching|inlaid?|inlay)\b|(?:محفور|حفر|منقوش|نقش|مطعّم|تطعيم)/iu.test(
    designContext
  );
}

function describeFontStyle(fontPreference: string) {
  const normalizedPreference = fontPreference.trim().toLowerCase();
  if (!normalizedPreference) return "";

  const selectedFont = jewelryFonts.find((font) => font.name.toLowerCase() === normalizedPreference);
  if (!selectedFont) {
    return `${fontPreference.trim()} lettering; treat this only as a visual style instruction and never as image text`;
  }

  return `${selectedFont.category}; ${selectedFont.tags.join(", ").toLowerCase()}; ${selectedFont.note}`;
}

function describeLetteringConstructionStyle(letteringStylePreference: string) {
  const normalizedPreference = letteringStylePreference.trim().toLowerCase();
  if (!normalizedPreference) return "";

  const selectedStyle = jewelryLetteringStyles.find((style) => style.name.toLowerCase() === normalizedPreference);
  if (!selectedStyle) {
    return `${letteringStylePreference.trim()} as a physical jewelry construction treatment`;
  }

  return `${selectedStyle.name}; ${selectedStyle.constructionDirection}`;
}

function isStructuredLetteringSelectionNote(note: string) {
  return /^(?:selected|requested)\s+(?:font|lettering style|lettering construction style)\s*:/i.test(note.trim());
}

function buildImageTextConstraint(profile: DesignProfile, removeExistingText: boolean) {
  const exactText = profile.personalizationText.trim();
  const allowedText = exactText
    ? `The only readable lettering allowed is the exact inscription "${exactText}", physically constructed as part of the jewelry itself.`
    : "No readable letters, words, numbers, or typography are allowed anywhere in the image.";

  return [
    allowedText,
    removeExistingText
      ? "Remove any existing promotional, decorative, background, or overlay text that is not the permitted jewelry inscription."
      : "Keep the background completely free of writing and graphic-design text elements.",
    "Do not add any other headlines, captions, slogans, font names, brand names, labels, logos, signatures, initials, monograms, packaging text, or model-generated watermarks.",
    "The application adds its own watermark separately after generation; do not render any watermark inside the source image."
  ].join(" ");
}

function getPreservedElements(editInstruction: string) {
  const requested = editInstruction.toLowerCase();
  const candidates: Array<{ label: string; changesWhen: RegExp }> = [
    {
      label: "jewelry type",
      changesWhen: /\b(?:ring|necklace|pendant|bracelet|earrings?|jewelry type|turn (?:it|this) into|convert)\b/i
    },
    {
      label: "main design identity",
      changesWhen: /\b(?:redesign|reimagine|entirely new|new design identity|transform the whole)\b/i
    },
    {
      label: "pendant dimensions and proportions",
      changesWhen: /\b(?:dimension|proportion|size|length|width|scale|larger|smaller|thicker|thinner)\b/i
    },
    { label: "chain", changesWhen: /\bchain\b/i },
    {
      label: "metal",
      changesWhen: /\b(?:metal|gold|platinum|silver|rose gold|white gold|yellow gold)\b/i
    },
    {
      label: "diamonds and gemstones",
      changesWhen: /\b(?:diamond|stone|gem|halo|setting|carat|cut|shape)\b/i
    },
    {
      label: "camera angle",
      changesWhen: /\b(?:camera|angle|view|perspective|rotate|front view|side view|top view)\b/i
    },
    { label: "framing and composition", changesWhen: /\b(?:crop|framing|composition|zoom)\b/i },
    { label: "lighting", changesWhen: /\b(?:light|lighting|brightness|exposure)\b/i },
    { label: "background", changesWhen: /\b(?:background|backdrop|surface)\b/i },
    { label: "shadows", changesWhen: /\bshadow/i },
    {
      label: "luxury product-photography style",
      changesWhen: /\b(?:photography|photo style|render|illustration|sketch)\b/i
    }
  ];
  const preserved = candidates.filter((candidate) => !candidate.changesWhen.test(requested)).map((candidate) => candidate.label);

  return preserved.length ? preserved : ["all details not explicitly included in the requested change"];
}
