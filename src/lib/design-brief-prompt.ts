import { jewelryVocabularyReference } from "@/config/jewelry-vocabulary";
import type { ChatMessage, GeneratedConcept } from "@/types/design";

export function buildDesignBriefPrompt({
  finalizedConcept,
  concepts,
  conversationContext = [],
  referenceId,
  language = "en"
}: {
  finalizedConcept: GeneratedConcept;
  concepts: GeneratedConcept[];
  conversationContext?: ChatMessage[];
  referenceId: string;
  language?: "en" | "ar";
}) {
  const arabicOutputInstruction =
    language === "ar"
      ? `
Write every human-readable value in Arabic, including summaries, jewelry attributes, notes, discussion points, revision history, and the disclaimer.
Translate English source details into natural professional Arabic.
Keep only technical identifiers such as "${referenceId}" unchanged.
Use clear Modern Standard Arabic suitable for a jeweler and natural right-to-left reading.
Do not use any English or Latin words anywhere in the values. Translate jewelry terminology such as solitaire, halo, pavé, white gold, and yellow gold into Arabic.
The disclaimer must be exactly:
"هذا التصور مخصص للإلهام البصري والمراجعة داخل الورشة. يجب أن يتولى صائغ محترف جميع القرارات الهندسية وقرارات التصنيع النهائية."`
      : "Write every human-readable value in concise professional English.";

  return `
You are preparing a luxury diamond jewelry workshop handoff document.

This is not CAD, not 3D, not a manufacturing-ready file, and not a production guarantee.
The brief bridges AI visual inspiration and review by a professional jeweler.

Terminology reference (use only when relevant):
${jewelryVocabularyReference}
For this brief, generic realism goals in image prompts are not verified image features or customer specifications. Use manufacturing/fit/clearance terms as workshop review points; never invent dimensions, 18K purity, mechanisms, certifications or production-ready status from them. Preserve the authoritative selected design.

Output language requirements:
${arabicOutputInstruction}

Selected-image accuracy requirements:
- The finalized concept below is the authoritative design being handed off.
- Use its prompt, description, variation name, and edit instruction as the primary source for metal, stone, setting, band, style, and other visible features.
- The conversation context contains only requirements that existed when that selected image was created. Use it to explain that image.
- The revision history contains only concepts available up to and including the selected image.
- Never apply a later requirement, later edit, or a different image's specifications to the finalized concept.

Return only valid JSON with this exact shape:
{
  "referenceId": "${referenceId}",
  "sessionSummary": "",
  "customerDesignSummary": "",
  "jewelryType": "",
  "occasion": "",
  "recipient": "",
  "style": "",
  "metal": "",
  "diamondShape": "",
  "setting": "",
  "bandStyle": "",
  "customerNotes": [],
  "designEvolution": "",
  "finalAiDescription": "",
  "workshopNotes": "",
  "recommendedDiscussionPoints": [],
  "revisionHistorySummary": "",
  "disclaimer": ""
}

Authoritative finalized concept:
${JSON.stringify(finalizedConcept, null, 2)}

Conversation context available before the selected image:
${JSON.stringify(
  conversationContext.map(({ role, content }) => ({ role, content })),
  null,
  2
)}

Revision history available up to the selected image:
${JSON.stringify(
  concepts.map((concept) => ({
    version: concept.version,
    variationName: concept.variationName,
    description: concept.description,
    editInstruction: concept.editInstruction,
    parentId: concept.parentId
  })),
  null,
  2
)}
`.trim();
}
