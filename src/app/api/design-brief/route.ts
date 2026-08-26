import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import { estimatedCosts } from "@/config/costs";
import { ApiInputError, handleApiError, methodNotAllowed, parseJsonBody } from "@/lib/api-response";
import { buildDesignBriefPrompt } from "@/lib/design-brief-prompt";
import { normalizeDesignProfile } from "@/lib/design-profile";
import { createDemoBrief } from "@/lib/demo-data";
import {
  getOrCreateDesignSession,
  logUsageEvent,
  persistDesignImage,
  requireAiAccess,
  requireAuthenticatedUser
} from "@/lib/supabase-server";
import { requireRateLimit } from "@/lib/rate-limit";
import { MissingOpenAiApiKeyError, OpenAiLlmProvider } from "@/services/llm";
import type { ChatMessage, DesignBrief, DesignProfile, GeneratedConcept } from "@/types/design";

export const runtime = "nodejs";

type DesignBriefBody = {
  designProfile?: DesignProfile;
  finalizedConcept?: GeneratedConcept;
  concepts?: GeneratedConcept[];
  conversationContext?: ChatMessage[];
  referenceId?: string;
  sessionId?: string;
  language?: "en" | "ar";
};

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<DesignBriefBody>(request);

    if (!body.finalizedConcept) {
      throw new ApiInputError("Please finalize a design before generating a brief.");
    }

    const referenceId = body.referenceId?.trim() || createReferenceId();
    const profile = normalizeDesignProfile(body.designProfile);
    const concepts = Array.isArray(body.concepts) ? body.concepts : [body.finalizedConcept];
    const conversationContext = normalizeConversationContext(body.conversationContext);
    const language = "ar" as const;

    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;

    const accessDenied = requireAiAccess(auth);
    if (accessDenied) return accessDenied;

    if (serverEnv.demoMode && !serverEnv.openaiApiKey) {
      return NextResponse.json({ brief: createDemoBrief(profile, body.finalizedConcept, referenceId, language), demoMode: true });
    }

    const rateLimit = requireRateLimit(auth.user.id, "/api/design-brief", 10);
    if (rateLimit) return rateLimit;

    const sessionId = await getOrCreateDesignSession({
      userId: auth.user.id,
      sessionId: body.sessionId,
      designProfile: profile
    });

    const startedAt = Date.now();
    let brief: DesignBrief;

    try {
      const provider = new OpenAiLlmProvider();
      const messages = [
        {
          role: "system" as const,
          content:
            "أنت تكتب ملخصات عربية موجزة وراقية لتسليم تصاميم مجوهرات الألماس إلى الورشة. أعد JSON صالحاً فقط، واكتب جميع القيم المقروءة بالعربية."
        },
        {
          role: "user" as const,
          content: buildDesignBriefPrompt({
            finalizedConcept: body.finalizedConcept,
            concepts,
            conversationContext,
            referenceId,
            language
          })
        }
      ];
      const completion = await provider.complete({
        responseFormat: "json",
        temperature: 0.25,
        messages
      });
      brief = normalizeBrief(JSON.parse(completion.content), referenceId, body.finalizedConcept.id, profile, language);

      if (!isFullyArabicBrief(brief)) {
        const correctedCompletion = await provider.complete({
          responseFormat: "json",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "حوّل جميع القيم المقروءة في JSON إلى العربية الفصحى. لا تترك أي كلمة أو اختصار بحروف لاتينية، باستثناء قيمة referenceId التقنية. حافظ على المعنى ومواصفات التصميم وأعد JSON صالحاً فقط."
            },
            {
              role: "user",
              content: completion.content
            }
          ]
        });
        brief = normalizeBrief(
          JSON.parse(correctedCompletion.content),
          referenceId,
          body.finalizedConcept.id,
          profile,
          language
        );
      }

      if (!isFullyArabicBrief(brief)) {
        throw new Error("The design brief contained non-Arabic workshop copy after correction.");
      }
    } catch (error) {
      await logUsageEvent({
        userId: auth.user.id,
        sessionId,
        eventType: "design_brief",
        provider: "openai",
        model: serverEnv.openaiModel,
        units: 0,
        estimatedCost: estimatedCosts.openAiDesignBrief,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        errorCode: "OPENAI_REQUEST_FAILED",
        metadata: { referenceId }
      });

      throw error;
    }

    let finalImageId: string | null = null;

    try {
      const { createAdminSupabaseClient } = await import("@/services/supabase/admin");
      const admin = createAdminSupabaseClient();
      const { data: sourceImage } = admin
        ? await admin
        .from("design_images")
        .select("storage_path")
        .eq("id", body.finalizedConcept.id)
        .eq("user_id", auth.user.id)
        .maybeSingle<{ storage_path: string | null }>()
        : { data: null };

      const finalRecord = await persistDesignImage({
        userId: auth.user.id,
        sessionId,
        concept: body.finalizedConcept,
        type: "final",
        provider: "replicate",
        storagePath: sourceImage?.storage_path ?? null
      });
      finalImageId = finalRecord.id;
      await admin
        ?.from("design_sessions")
        .update({ final_design_id: finalImageId, status: "finalized", design_profile: profile })
        .eq("id", sessionId)
        .eq("user_id", auth.user.id);
    } catch {
      finalImageId = null;
    }

    await logUsageEvent({
      userId: auth.user.id,
      sessionId,
      designImageId: finalImageId,
      eventType: "design_brief",
      provider: "openai",
      model: serverEnv.openaiModel,
      units: 0,
      estimatedCost: estimatedCosts.openAiDesignBrief,
      status: "succeeded",
      latencyMs: Date.now() - startedAt,
      metadata: { referenceId }
    });

    return NextResponse.json({ brief, sessionId });
  } catch (error) {
    if (error instanceof MissingOpenAiApiKeyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }

    return handleApiError(error, "The design brief could not be generated. Please try again.");
  }
}

export function GET() {
  return methodNotAllowed();
}

function normalizeBrief(
  input: Partial<DesignBrief>,
  referenceId: string,
  sourceConceptId: string,
  profile: DesignProfile,
  language: "en" | "ar"
): DesignBrief {
  const attribute = (value: unknown, fallback: string) =>
    text(value) || (language === "ar" ? "غير محدد" : fallback);
  const customerNotes = Array.isArray(input.customerNotes)
    ? input.customerNotes.filter((note): note is string => typeof note === "string")
    : language === "ar"
      ? []
      : profile.notes;

  return {
    referenceId,
    sourceConceptId,
    sessionSummary: text(input.sessionSummary),
    customerDesignSummary: text(input.customerDesignSummary),
    jewelryType: attribute(input.jewelryType, profile.jewelryType),
    occasion: attribute(input.occasion, profile.occasion),
    recipient: attribute(input.recipient, profile.recipient),
    style: attribute(input.style, profile.style),
    metal: attribute(input.metal, profile.metal),
    diamondShape: attribute(input.diamondShape, profile.diamondShape),
    setting: attribute(input.setting, profile.setting),
    bandStyle: attribute(input.bandStyle, profile.bandStyle),
    customerNotes,
    designEvolution: text(input.designEvolution),
    finalAiDescription: text(input.finalAiDescription),
    workshopNotes: text(input.workshopNotes),
    recommendedDiscussionPoints: Array.isArray(input.recommendedDiscussionPoints)
      ? input.recommendedDiscussionPoints.filter((point): point is string => typeof point === "string")
      : [],
    revisionHistorySummary: text(input.revisionHistorySummary),
    disclaimer:
      language === "ar"
        ? "هذا التصور مخصص للإلهام البصري والمراجعة داخل الورشة. يجب أن يتولى صائغ محترف جميع القرارات الهندسية وقرارات التصنيع النهائية."
        : "This concept is intended for visual inspiration and workshop review. Final engineering and manufacturing decisions must be made by a professional jeweler."
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isFullyArabicBrief(brief: DesignBrief) {
  const visibleText = [
    brief.sessionSummary,
    brief.customerDesignSummary,
    brief.jewelryType,
    brief.occasion,
    brief.recipient,
    brief.style,
    brief.metal,
    brief.diamondShape,
    brief.setting,
    brief.bandStyle,
    ...brief.customerNotes,
    brief.designEvolution,
    brief.finalAiDescription,
    brief.workshopNotes,
    ...brief.recommendedDiscussionPoints,
    brief.revisionHistorySummary,
    brief.disclaimer
  ].join(" ");

  return /[\u0600-\u06ff]/.test(visibleText) && !/[a-z]/i.test(visibleText);
}

function normalizeConversationContext(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (message): message is ChatMessage =>
        typeof message === "object" &&
        message !== null &&
        ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
        typeof (message as ChatMessage).content === "string"
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content.trim().slice(0, 2_000),
      createdAt: message.createdAt
    }))
    .slice(-24);
}

function createReferenceId() {
  return `DIA-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
