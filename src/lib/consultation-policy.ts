import { canGenerateDesign, hasConsultantQuestion, missingDesignDetails } from "@/lib/design-profile";
import type { ChatApiResponse } from "@/types/design";

export function enforceConsultationPolicy(response: ChatApiResponse, awaitingCustomerAnswer: boolean, arabic: boolean): ChatApiResponse {
  const missing = missingDesignDetails(response.updatedDesignProfile);
  const generating = response.action.type === "generate_image";
  const pending = awaitingCustomerAnswer || response.action.type === "ask_clarifying_question" || hasConsultantQuestion(response.assistantMessage);
  if (!pending && !(generating && !canGenerateDesign(response.updatedDesignProfile))) {
    return missing.length ? { ...response, updatedDesignProfile: { ...response.updatedDesignProfile, readyForGeneration: false }, stage: "refinement" } : response;
  }

  let message = response.assistantMessage;
  let suggestions = response.suggestedActions;
  if (response.action.type === "ask_clarifying_question" && response.action.question?.trim()) {
    message = response.action.question.trim();
  }
  const needsFallback = !pending || (response.action.type !== "ask_clarifying_question" && !hasConsultantQuestion(message));
  if (needsFallback && missing.length) {
    const questions: Record<string, [string, string]> = {
      jewelryType: ["What type of jewelry would you like to create?", "ما نوع قطعة المجوهرات التي ترغبين في تصميمها؟"],
      metal: ["Which metal and color would you like: yellow gold, white gold, rose gold, or another option?", "ما المعدن واللون الذي تفضلينه: ذهب أصفر، أبيض، وردي، أم خيار آخر؟"],
      style: ["What visual style would you like for the piece?", "ما الطابع البصري الذي تفضلينه للقطعة؟"],
      setting: ["How would you like the diamonds arranged: subtle accents, pavé on the main strokes, or another treatment?", "كيف تفضلين توزيع الألماس: لمسات بسيطة، ترصيع على الخطوط الرئيسية، أم توزيع آخر؟"],
      personalizationText: ["Please type the exact inscription in its intended script, including the exact Arabic spelling if applicable.", "يرجى كتابة الاسم أو النقش بالحروف المطلوبة تمامًا، بما في ذلك التهجئة العربية الدقيقة."]
    };
    message = questions[missing[0]][arabic ? 1 : 0];
    suggestions = [];
  } else if (needsFallback) {
    message = arabic ? "هل ترغبين في إنشاء التصور وفق تفاصيل التصميم الحالية؟" : "Would you like me to create the concept with the current design details?";
    suggestions = [];
  }
  return {
    ...response,
    assistantMessage: message,
    updatedDesignProfile: { ...response.updatedDesignProfile, readyForGeneration: false },
    stage: "refinement",
    suggestedActions: suggestions,
    action: { type: "ask_clarifying_question", question: message }
  };
}
