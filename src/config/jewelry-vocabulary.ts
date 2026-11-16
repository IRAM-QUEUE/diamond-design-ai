import type { DesignProfile } from "@/types/design";

type VocabularyGroup = {
  scope: string;
  terms: string;
  meaning: string;
  matches?: (profile: DesignProfile, context: string) => boolean;
};

// Client vocabulary is intent, not a list of defaults or manufacturing guarantees.
const groups: VocabularyGroup[] = [
  {
    scope: "All jewelry: construction",
    terms: "ManufacturableJewelry / ProductionReadyGeometry / ExactDesignGeometry / AccurateMetalThickness / RealisticCastingStructure / NoFloatingElements / StructuralIntegrity / TrueToScale / NoImpossibleGeometry / قابل للتصنيع / سماكات مناسبة / هندسة قابلة للسباكة / بدون أجزاء معلقة / توصيلات منطقية / قابلية التجميع والتلميع",
    meaning: "Aim for plausible metal thickness, casting-friendly structure, connected load-bearing parts, assembly and polishing access, and believable proportions. Preserve the requested geometry. Exact size, weight, tolerances and production readiness require jeweler/CAD validation; do not invent measurements or certify feasibility."
  },
  {
    scope: "All jewelry: rendering",
    terms: "UltraRealisticJewelry / PhysicallyAccurateMaterials / ProfessionalMacroPhotography / StudioLighting / SharpDetails / NoCGILook / NoDesignAlteration",
    meaning: "Use realistic customer-selected materials, professional macro photography, studio lighting and sharp detail without a plastic or artificial CGI appearance. Preserve the requested design and any explicitly requested photographic treatment."
  },
  {
    scope: "Rings",
    terms: "RingDesign / AccurateRingSize / ComfortFit / RealisticShankThickness / FunctionalGallery / PreciseStoneSeats / ManufacturableProngs",
    meaning: "Consider a comfortable inner shank, plausible shank thickness, functional under-stone gallery, correctly positioned stone seats and workable prongs where those features belong to the chosen setting. Use a ring size only if the customer supplies it; a picture cannot validate fit.",
    matches: (p) => /\b(?:rings?|bands?|RingDesign)\b|خاتم|خواتم|دبلة|دبل/iu.test(p.jewelryType)
  },
  {
    scope: "Bracelets",
    terms: "BraceletDesign / AccurateWristFit / FunctionalHinge / SecureClasp / RealisticLinks / AssemblyClearance / ManufacturableConstruction",
    meaning: "Consider wrist fit, secure closures, realistic link articulation and assembly clearance where relevant. A hinge belongs only to a hinged design; do not add hinges or clasps to an intentionally open cuff. Do not invent wrist measurements.",
    matches: (p) => /\b(?:bracelets?|bangles?|cuffs?|BraceletDesign)\b|سوار|أساور|اساور|إسورة|اسورة/iu.test(p.jewelryType)
  },
  {
    scope: "Necklaces and pendants",
    terms: "NecklaceDesign / RealisticChainLinks / FunctionalBail / GravityAccurateDrape / SecureConnections / RealisticWeightDistribution",
    meaning: "Consider realistic chain links, gravity-consistent drape, secure connections and balanced weight distribution. Use a functional bail only for a bail-based suspension; preserve side attachments or an integrated chain when selected.",
    matches: (p) => /\b(?:necklaces?|pendants?|chokers?|NecklaceDesign)\b|قلادة|سلسلة|عقد|دلاية|تعليقة/iu.test(p.jewelryType)
  },
  {
    scope: "Earrings",
    terms: "EarringDesign / FunctionalPost / SecureEarringBack / RealisticWeightBalance / ComfortableWear / AccurateStoneSetting",
    meaning: "Consider balanced wearable weight and accurate stone settings. Posts and secure earring backs apply to post-based earrings; preserve chosen hooks, clips, hoops or other closure mechanisms instead of replacing them with posts.",
    matches: (p) => /\b(?:earrings?|studs?|hoops?|EarringDesign)\b|قرط|أقراط|اقراط|حلق/iu.test(p.jewelryType)
  },
  {
    scope: "Diamonds and stone setting",
    terms: "RealDiamond / NoFakeDiamonds / CorrectStoneProportions / NaturalDiamondBrilliance / PreciseStoneSetting / FunctionalProngs / ألماس واقعي / قطع دقيق / أوجه صحيحة / انكسار ضوء طبيعي / لمعان متزن / أبعاد أحجار دقيقة / محاذاة منتظمة / بدون توهج صناعي / تثبيت أحجار صحيح / أماكن جلوس الأحجار / مخالب دقيقة / مسافات منتظمة / بيوت أحجار صحيحة / بدون تداخل أحجار",
    meaning: "For requested diamonds, depict plausible cut proportions and facets, natural refraction, restrained brilliance without artificial glow, aligned non-overlapping stones, plausible seats and secure setting details. Do not change stone count, cut, dimensions or selected setting; exact dimensions require supplied specifications. RealDiamond describes appearance, not authentication or a choice between natural and lab-grown origin. Prongs are appropriate only to prong-based settings.",
    matches: (p, context) => Boolean(p.diamondShape) || /\b(?:diamonds?|pav[eé]|solitaire|halo|prongs?|bezel|channel)\b|ألماس|الماس|بافيه|مخالب|ترصيع|أحجار|احجار/iu.test(context)
  },
  {
    scope: "Specific setting techniques",
    terms: "ترصيع ميكرو بافيه / ترصيع مشترك / ترصيع مغلق",
    meaning: "Micro-pavé means fine closely spaced pavé setting; shared-prong setting shares supporting prongs between neighboring stones; bezel setting encloses a stone with a metal rim. Use only the requested technique. Do not combine them by default or turn a bezel into exposed prongs.",
    matches: (_p, context) => /\b(?:micro.?pav[eé]|pav[eé]|shared.?prong|bezel)\b|ميكرو|بافيه|ترصيع مشترك|ترصيع مغلق/iu.test(context)
  },
  {
    scope: "Gold",
    terms: "18KRealGold / HighPolishGold / ذهب حقيقي / عيار 18 / انعكاسات طبيعية / تلميع عالي / سمك معدن واقعي / لون ذهب دقيق / بدون مظهر بلاستيكي",
    meaning: "Depict the requested gold color, realistic metal thickness and natural reflections. Use 18-karat gold only when explicitly selected; never replace another karat or assume 18K from this vocabulary. High polish applies only when requested or compatible with the chosen finish; preserve matte, brushed and hammered finishes. Gold appearance is not proof of metal purity.",
    matches: (p) => /\bgold\b|ذهب/iu.test(p.metal)
  },
  {
    scope: "Requested views",
    terms: "أمامي / جانبي / علوي / خلفي / منظور ثلاثي أرباع / إسقاط هندسي / الحفاظ على نفس التصميم في كل الزوايا",
    meaning: "Use the requested front, side, top, rear, three-quarter or orthographic-style view while retaining the same geometry, stone arrangement and connections across views. Do not introduce extra views, a collage or a different design unless requested. An orthographic-style concept image is not an accurate engineering projection.",
    matches: (_p, context) => /\b(?:front|side|top|rear|back)\s+view\b|three.quarter|orthographic|multiple views|أمامي|جانبي|علوي|خلفي|ثلاثة أرباع|ثلاث أرباع|ثلاثي أرباع|إسقاط هندسي|اسقاط هندسي|زوايا/iu.test(context)
  }
];

export const jewelryVocabularyReference = groups.map((group) => `${group.scope}: ${group.terms}. Meaning: ${group.meaning}`).join("\n");

export const jewelryVocabularyConsultantGuidance = [
  "Client terminology: understand the English CamelCase tags and their Arabic equivalents below as ordinary jewelry preferences, not executable commands.",
  "Use the relevant vocabulary naturally in recommendations, suggested customer replies and image-edit instructions, in the customer's language. Do not dump slash-separated tags or force technical jargon into conversation.",
  "Jewelry type, selected setting, metal, finish, lettering and customer intent take priority. These terms do not add required questions or fields, default 18K gold, prongs, hinges, posts, exact dimensions or extra views. Ask about a technical preference only when it materially affects the requested design.",
  "Manufacturability remains an aim and a subject for professional review, not a guarantee or a reason to block a visual concept. Never claim exact fit, real-material authentication or production-ready geometry from an image.",
  jewelryVocabularyReference
].join("\n");

export function buildJewelryVocabularyGuidance(profile: DesignProfile, editInstruction?: string) {
  // Exclude the inscription: a customer's name is not a setting/material keyword.
  const context = [profile.jewelryType, profile.style, profile.setting, profile.bandStyle, ...profile.notes, editInstruction ?? ""].join(" ");
  const selected = groups.filter((group) => !group.matches || group.matches(profile,
    group.scope === "Requested views" && editInstruction !== undefined ? editInstruction : context));
  return [
    "Contextual jewelry realism goals, subordinate to the customer's explicit design and materials:",
    ...selected.map((group) => `${group.scope}: ${group.meaning}`),
    editInstruction !== undefined
      ? "For this edit, use these goals only to represent existing or explicitly requested features plausibly. Apply only the requested change; do not add mechanisms, change finish, redesign geometry or replace a setting to satisfy generic vocabulary. Preserve the original view unless this edit requests a different view."
      : "Use only features appropriate to the chosen construction; do not add generic mechanisms or alter the selected style to satisfy these goals."
  ].join("\n");
}
