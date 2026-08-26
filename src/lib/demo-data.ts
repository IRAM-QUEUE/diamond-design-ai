import type { DesignBrief, DesignProfile, GeneratedConcept } from "@/types/design";

const svg = (title: string, subtitle: string, accent = "#d7c49a") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="48%" stop-color="#15171c"/>
      <stop offset="100%" stop-color="#050506"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#g)"/>
  <circle cx="600" cy="490" r="150" fill="none" stroke="${accent}" stroke-width="18"/>
  <path d="M485 490 L600 330 L715 490 L600 650 Z" fill="none" stroke="#f7fbff" stroke-width="14"/>
  <path d="M420 720 C520 800 680 800 780 720" fill="none" stroke="#c9d3df" stroke-width="24" stroke-linecap="round"/>
  <text x="600" y="900" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="48" font-weight="700">${title}</text>
  <text x="600" y="958" text-anchor="middle" fill="#c9d3df" font-family="Arial" font-size="26">${subtitle}</text>
  <text x="600" y="1040" text-anchor="middle" fill="${accent}" font-family="Arial" font-size="22">DEMO PLACEHOLDER</text>
</svg>`)}`;

export function createDemoConcepts(): GeneratedConcept[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-luxury",
      url: svg("Luxury Concept", "Sample diamond concept"),
      prompt: "Demo placeholder prompt. Real image generation requires REPLICATE_API_TOKEN.",
      variationName: "Demo Placeholder - Luxury Concept",
      description: "Demo placeholder for one luxury diamond concept.",
      version: 1,
      parentId: null,
      rootId: "demo-luxury",
      createdAt: now
    }
  ];
}

export function createDemoBrief(
  profile: DesignProfile,
  finalizedConcept: GeneratedConcept,
  referenceId: string,
  language: "en" | "ar" = "en"
): DesignBrief {
  if (language === "ar") {
    return {
      referenceId,
      sourceConceptId: finalizedConcept.id,
      sessionSummary: "ملخص تجريبي: تم اختيار تصور فاخر من الألماس لمراجعته داخل الورشة.",
      customerDesignSummary: "تصور مختار لمجوهرات ألماس جرى إعداده كمرجع بصري للنقاش مع الصائغ.",
      jewelryType: "مجوهرات ألماس",
      occasion: "غير محدد",
      recipient: "غير محدد",
      style: "فاخر",
      metal: "غير محدد",
      diamondShape: "غير محدد",
      setting: "غير محدد",
      bandStyle: "غير محدد",
      customerNotes: [],
      designEvolution: "تم اختيار التصور النهائي للمراجعة داخل الورشة.",
      finalAiDescription: "تصور ألماس فاخر للمراجعة الاحترافية.",
      workshopNotes: "تُراجع النسب ومواصفات الأحجار وإمكانية تنفيذ الترصيع والراحة وطريقة الإنتاج.",
      recommendedDiscussionPoints: ["حجم الحجر ودرجته", "اختيار المعدن", "متانة الترصيع", "إمكانية التصنيع"],
      revisionHistorySummary: `الإصدار النهائي المختار: ${finalizedConcept.version}.`,
      disclaimer:
        "هذا التصور مخصص للإلهام البصري والمراجعة داخل الورشة. يجب أن يتولى صائغ محترف جميع القرارات الهندسية وقرارات التصنيع النهائية."
    };
  }

  return {
    referenceId,
    sourceConceptId: finalizedConcept.id,
    sessionSummary:
      "Demo mode summary: a luxury diamond concept was selected for workshop review. Configure OpenAI for production copy.",
    customerDesignSummary: "A selected diamond jewelry concept prepared as a visual reference for jeweler discussion.",
    jewelryType: profile.jewelryType,
    occasion: profile.occasion,
    recipient: profile.recipient,
    style: profile.style,
    metal: profile.metal,
    diamondShape: profile.diamondShape,
    setting: profile.setting,
    bandStyle: profile.bandStyle,
    customerNotes: profile.notes,
    designEvolution: `The selected concept is ${finalizedConcept.variationName}.`,
    finalAiDescription: finalizedConcept.description,
    workshopNotes: "Review proportions, stone specifications, setting feasibility, comfort, and production approach.",
    recommendedDiscussionPoints: ["Stone size and grade", "Metal selection", "Setting durability", "Production feasibility"],
    revisionHistorySummary: `Final selected version: V${finalizedConcept.version}.`,
    disclaimer:
      "This concept is intended for visual inspiration and workshop review. Final engineering and manufacturing decisions must be made by a professional jeweler."
  };
}

export function createDemoEditedConcept({
  sourceImageId,
  sourceVersion,
  rootId,
  variationName,
  editInstruction
}: {
  sourceImageId: string;
  sourceVersion: number;
  rootId: string;
  variationName: string;
  editInstruction: string;
}): GeneratedConcept {
  return {
    id: `demo-edit-${crypto.randomUUID()}`,
    url: svg("Edited Concept", "Demo AI refinement", "#d7c49a"),
    prompt: "Demo placeholder edit. Real FLUX Kontext Pro editing requires REPLICATE_API_TOKEN.",
    variationName: `${variationName} / Demo Edit`,
    description: `Demo placeholder refinement: ${editInstruction}`,
    editInstruction,
    version: sourceVersion + 1,
    parentId: sourceImageId,
    rootId,
    createdAt: new Date().toISOString()
  };
}
