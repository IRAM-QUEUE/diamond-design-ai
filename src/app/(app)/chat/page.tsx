"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Columns2,
  Download,
  Gem,
  Heart,
  ImagePlus,
  Printer,
  SendHorizontal,
  Sparkles,
  Store,
  Plus,
  Upload,
  Wand2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AdvancedImageSettings } from "@/components/chat/advanced-image-settings";
import { useAuth } from "@/components/auth/auth-provider";
import { normalizeDesignProfile, statusLabel } from "@/lib/design-profile";
import { createHandoffContext } from "@/lib/handoff-context";
import { requiresArabicJewelryLettering } from "@/lib/personalization";
import { downloadDesignPdf, printDesignPdf } from "@/lib/export-design";
import { clearDiamondSession, loadDiamondSession, saveDiamondSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";
import { getJewelryFontById } from "@/config/jewelry-fonts";
import { publicEnv } from "@/config/public-env";
import { BrowserLocalImageStorage, StorageValidationError, type StoredImage } from "@/services/storage";
import { useLanguage } from "@/lib/language";
import {
  type ChatAction,
  type ChatApiResponse,
  type ChatImageContext,
  type ChatMessage,
  type DesignBrief,
  type ConversationStage,
  type DesignProfile,
  type GeneratedConcept,
  type ImageModelPreference,
  emptyDesignProfile
} from "@/types/design";

const initialAssistantMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  createdAt: "2026-01-01T00:00:00.000Z",
  content:
    "Welcome to your private diamond atelier. Tell me the piece you imagine, or begin with the occasion, metal, and diamond shape."
};

const initialSuggestions = ["Engagement ring", "Modern pendant", "I prefer white gold", "I want an oval diamond"];
const isDemoMode = publicEnv.demoMode;
const editSuggestions = [
  "Make band thinner",
  "Change to rose gold",
  "Make it more minimal",
  "Add hidden halo",
  "Remove halo",
  "Increase center stone"
];

const profileLabels: Array<[keyof Omit<DesignProfile, "readyForGeneration">, string, string]> = [
  ["jewelryType", "Jewelry", "Jewelry"],
  ["metal", "Metal", "Metal"],
  ["diamondShape", "Stone", "Stone"],
  ["setting", "Setting", "Setting"],
  ["style", "Style", "Style"],
  ["occasion", "Occasion", "Occasion"],
  ["recipient", "Recipient", "Occasion"],
  ["bandStyle", "Band", "Setting"],
  ["budgetRange", "Budget", "Style"],
  ["personalizationText", "Name Text", "Personalization"],
  ["personalizationScript", "Script", "Personalization"],
  ["fontPreference", "Font", "Personalization"],
  ["notes", "Notes", "Notes"]
];

type UsageState = {
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyRemaining: number;
  monthlyRemaining: number;
};

export default function ChatPage() {
  const { user, getAccessToken } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [designProfile, setDesignProfile] = useState<DesignProfile>(emptyDesignProfile);
  const [stage, setStage] = useState<ConversationStage>("discovery");
  const [suggestedActions, setSuggestedActions] = useState(initialSuggestions);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedConcepts, setGeneratedConcepts] = useState<GeneratedConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string>("");
  const [selectedConcept, setSelectedConcept] = useState<GeneratedConcept | null>(null);
  const [previewConcept, setPreviewConcept] = useState<GeneratedConcept | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [finalizeCandidate, setFinalizeCandidate] = useState<GeneratedConcept | null>(null);
  const [finalizedConceptId, setFinalizedConceptId] = useState("");
  const [designBrief, setDesignBrief] = useState<DesignBrief | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [revisionUnlockedIds, setRevisionUnlockedIds] = useState<Set<string>>(() => new Set());
  const [pendingUpload, setPendingUpload] = useState<StoredImage | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [usage, setUsage] = useState<UsageState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRefreshInFlightRef = useRef(false);
  const inspirationLoadedRef = useRef(false);
  const fontLoadedRef = useRef(false);
  const storage = useMemo(() => new BrowserLocalImageStorage(), []);
  const usageLimitReached = Boolean(usage && (usage.dailyRemaining <= 0 || usage.monthlyRemaining <= 0));
  const usageLimitMessage = usageLimitReached
    ? usage?.monthlyRemaining === 0
      ? t(
          "You've reached your monthly generation limit.",
          "لقد وصلت إلى حد الإنشاء الشهري."
        )
      : t(
          "You've reached your daily generation limit. It will reset tomorrow.",
          "لقد وصلت إلى حد الإنشاء اليومي. سيتم تجديد الرصيد غداً."
        )
    : "";

  const sortedConcepts = useMemo(
    () =>
      [...generatedConcepts].sort((a, b) => {
        if (a.rootId === b.rootId) return a.version - b.version;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [generatedConcepts]
  );

  const finalizedConcept = useMemo(
    () => sortedConcepts.find((concept) => concept.id === finalizedConceptId) ?? null,
    [finalizedConceptId, sortedConcepts]
  );
  const referenceId = useMemo(
    () => (finalizedConcept ? `DIA-${new Date().getFullYear()}-${finalizedConcept.rootId.slice(0, 8).toUpperCase()}` : ""),
    [finalizedConcept]
  );

  const activeConcept = useMemo(
    () => sortedConcepts.find((concept) => concept.id === selectedConceptId) ?? sortedConcepts[sortedConcepts.length - 1] ?? null,
    [selectedConceptId, sortedConcepts]
  );

  const visibleProfile = useMemo(
    () =>
      profileLabels
        .map(([key, label, section]) => {
          const value = designProfile[key];
          return {
            key,
            label,
            section,
            value: Array.isArray(value) ? value.join(", ") : value
          };
        })
        .filter((item) => item.value),
    [designProfile]
  );

  const completion = useMemo(() => getCompletion(designProfile), [designProfile]);
  const arabicLetteringRequired = useMemo(
    () => requiresArabicJewelryLettering({ designProfile }),
    [designProfile]
  );
  const comparisonConcepts = comparisonIds
    .map((id) => sortedConcepts.find((concept) => concept.id === id))
    .filter((concept): concept is GeneratedConcept => Boolean(concept));

  useEffect(() => {
    const saved = loadDiamondSession(user?.id);
    if (saved) {
      setMessages(saved.messages.length ? saved.messages : [initialAssistantMessage]);
      setDesignProfile(normalizeDesignProfile(saved.designProfile));
      setStage(saved.stage);
      setSuggestedActions(cleanClientSuggestions(saved.suggestedActions));
      setGeneratedConcepts(saved.generatedConcepts);
      setSelectedConceptId(saved.selectedConceptId);
      setFinalizedConceptId(saved.finalizedConceptId);
      setDesignBrief(saved.designBrief);
      setFavoriteIds(new Set(saved.favoriteIds));
      setComparisonIds(saved.comparisonIds);
      setRevisionUnlockedIds(new Set(saved.revisionUnlockedIds));
      setSessionId(saved.sessionId ?? "");
    } else {
      setMessages([{ ...initialAssistantMessage, createdAt: new Date().toISOString() }]);
      setDesignProfile(emptyDesignProfile);
      setStage("discovery");
      setSuggestedActions(initialSuggestions);
      setInput("");
      setGeneratedConcepts([]);
      setSelectedConceptId("");
      setFinalizedConceptId("");
      setDesignBrief(null);
      setFavoriteIds(new Set());
      setComparisonIds([]);
      setRevisionUnlockedIds(new Set());
      setSessionId("");
    }
    setSessionLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      return;
    }

    void refreshUsage();
  }, [user]);

  useEffect(() => {
    if (!sessionLoaded) return;

    saveDiamondSession(
      {
        messages,
        designProfile,
        stage,
        suggestedActions,
        generatedConcepts,
        selectedConceptId,
        finalizedConceptId,
        designBrief,
        favoriteIds: Array.from(favoriteIds),
        comparisonIds,
        revisionUnlockedIds: Array.from(revisionUnlockedIds),
        sessionId
      },
      user?.id
    );
  }, [
    comparisonIds,
    designBrief,
    designProfile,
    favoriteIds,
    finalizedConceptId,
    generatedConcepts,
    messages,
    revisionUnlockedIds,
    selectedConceptId,
    sessionLoaded,
    sessionId,
    stage,
    suggestedActions,
    user?.id
  ]);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function refreshUsage() {
    const headers = await authHeaders();
    if (!("Authorization" in headers)) return;

    try {
      const response = await fetch("/api/usage", { headers });
      const payload = (await response.json()) as { usage?: UsageState };
      if (response.ok && payload.usage) setUsage(payload.usage);
    } catch {
      setUsage(null);
    }
  }

  async function refreshSessionImages() {
    if (!sessionId || imageRefreshInFlightRef.current) return;

    const headers = await authHeaders();
    if (!("Authorization" in headers)) return;

    imageRefreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/design-sessions/${sessionId}`, { headers });
      const payload = (await response.json()) as { images?: GeneratedConcept[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Image links could not be refreshed.");
      if (payload.images?.length) {
        setGeneratedConcepts(payload.images);
        setError("Image links were refreshed because the previous signed URLs expired.");
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Image links could not be refreshed.");
    } finally {
      imageRefreshInFlightRef.current = false;
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [error, generatedConcepts, isGenerating, messages, isSending]);

  useEffect(() => {
    if (usageLimitMessage) setError(usageLimitMessage);
  }, [usageLimitMessage]);

  useEffect(() => {
    const latestConcept = sortedConcepts[sortedConcepts.length - 1];
    if (!selectedConceptId && latestConcept) {
      setSelectedConceptId(latestConcept.id);
    }
  }, [selectedConceptId, sortedConcepts]);

  useEffect(() => {
    if (!sessionLoaded || inspirationLoadedRef.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const imageUrl = params.get("inspiration");
    if (!imageUrl) return;

    inspirationLoadedRef.current = true;
    const title = params.get("title") || "Inspiration Reference";
    const id = crypto.randomUUID();
    const referenceConcept: GeneratedConcept = {
      id,
      url: imageUrl,
      version: 1,
      parentId: null,
      rootId: id,
      variationName: title,
      description: "Reference selected from the inspiration library",
      prompt: "",
      editInstruction: "",
      createdAt: new Date().toISOString()
    };

    setGeneratedConcepts((current) => [...current, referenceConcept]);
    setSelectedConceptId(referenceConcept.id);
    setDesignBrief(null);
    setFinalizedConceptId("");
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I've brought "${title}" into the atelier as a reference. Tell me what you would like to keep, change, or refine from it.`,
        createdAt: new Date().toISOString()
      }
    ]);
    setDesignProfile((current) =>
      normalizeDesignProfile({
        ...current,
        notes: [...current.notes, `Inspiration reference: ${title}`],
        readyForGeneration: current.readyForGeneration
      })
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, [sessionLoaded]);

  useEffect(() => {
    if (!sessionLoaded || fontLoadedRef.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fontId = params.get("font");
    const selectedFont = getJewelryFontById(fontId);
    if (!selectedFont) return;

    fontLoadedRef.current = true;
    setDesignProfile((current) =>
      normalizeDesignProfile({
        ...current,
        fontPreference: selectedFont.name,
        personalizationScript:
          current.personalizationScript ||
          (selectedFont.supportsArabic ? "Arabic or English, exact spelling required" : "English or Latin"),
        notes: [
          ...current.notes,
          `Selected font: ${selectedFont.name} (${selectedFont.category})`
        ]
      })
    );
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I've set ${selectedFont.name} as your lettering preference. Tell me the exact name or inscription, and if it is Arabic, please type the exact Arabic spelling you want in the jewelry.`,
        createdAt: new Date().toISOString()
      }
    ]);
    window.history.replaceState({}, "", window.location.pathname);
  }, [sessionLoaded]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "upload") {
      setUploadOpen(true);
    }
  }, []);

  useEffect(() => {
    const previewId = previewConcept?.id;
    if (!previewId) return;

    function handleKeyDown(event: KeyboardEvent) {
      const index = sortedConcepts.findIndex((concept) => concept.id === previewId);
      if (index < 0 || !sortedConcepts.length) return;
      if (event.key === "Escape") setPreviewConcept(null);
      if (event.key === "ArrowRight") setPreviewConcept(sortedConcepts[(index + 1) % sortedConcepts.length]);
      if (event.key === "ArrowLeft") setPreviewConcept(sortedConcepts[(index - 1 + sortedConcepts.length) % sortedConcepts.length]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewConcept, sortedConcepts]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    if (usageLimitReached) {
      setError(usageLimitMessage);
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          messages: nextMessages,
          designProfile,
          sessionId,
          selectedConceptId,
          images: buildChatImageContext(sortedConcepts, selectedConceptId)
        })
      });
      const payload = (await response.json()) as Partial<ChatApiResponse> & { error?: string; usage?: UsageState };
      if (payload.usage) setUsage(payload.usage);
      if (!response.ok) throw new Error(payload.error ?? "The consultant could not respond. Please try again.");

      const updatedProfile = normalizeDesignProfile({
        ...payload.updatedDesignProfile,
        imageModelPreference: designProfile.imageModelPreference
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.assistantMessage ?? "I can continue refining the direction with you.",
          createdAt: new Date().toISOString()
        }
      ]);
      setDesignProfile(updatedProfile);
      setStage(payload.stage ?? "discovery");
      setSuggestedActions(cleanClientSuggestions(payload.suggestedActions));
      setIsSending(false);
      await runChatAction(payload.action ?? { type: "chat" }, updatedProfile);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  async function runChatAction(action: ChatAction, updatedProfile: DesignProfile) {
    if (action.type === "generate_image") {
      await generateConcepts({ forceReady: true, profileOverride: updatedProfile });
      return;
    }

    if (action.type === "edit_image") {
      const sourceConcept = resolveActionTargetConcept(action.targetImageId);
      if (!sourceConcept) {
        setError("Select or upload a reference image first, then tell me the edit you want.");
        return;
      }

      await editConceptFromChat(sourceConcept, action.editInstruction, { profileOverride: updatedProfile });
    }
  }

  function resolveActionTargetConcept(targetImageId?: string) {
    if (targetImageId && targetImageId !== "selected" && targetImageId !== "latest") {
      const exactConcept = sortedConcepts.find((concept) => concept.id === targetImageId);
      if (exactConcept) return exactConcept;
    }

    if (targetImageId === "latest") {
      return latestEditableConcept(sortedConcepts);
    }

    return activeConcept ?? latestUserProvidedConcept(sortedConcepts) ?? latestEditableConcept(sortedConcepts);
  }

  async function generateConcepts(options?: { forceReady?: boolean; profileOverride?: DesignProfile }) {
    const generationProfile = options?.profileOverride ?? designProfile;
    const readyForGeneration = options?.forceReady || generationProfile.readyForGeneration;
    if (!readyForGeneration || isGenerating) return;
    if (!user && !(isDemoMode && !process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      setError("Sign in to save your designs and generate AI concepts.");
      return;
    }
    if (usageLimitReached) {
      setError(usageLimitMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          designProfile: { ...generationProfile, readyForGeneration: true },
          conversationContext: messages,
          sessionId
        })
      });
      const payload = (await response.json()) as {
        images?: GeneratedConcept[];
        error?: string;
        demoMode?: boolean;
        sessionId?: string;
        usage?: UsageState;
      };
      if (payload.usage) setUsage(payload.usage);
      if (!response.ok && response.status === 429 && !payload.usage) await refreshUsage();
      if (!response.ok) throw new Error(payload.error ?? "The design concepts could not be generated. Please try again.");
      if (!payload.images?.length) throw new Error("No design concepts were returned. Please try again.");

      const receivedAt = Date.now();
      const orderedImages = payload.images.map((image, index) => ({
        ...image,
        createdAt: new Date(receivedAt + index).toISOString()
      }));
      setGeneratedConcepts((current) => [...current, ...orderedImages]);
      if (payload.sessionId) setSessionId(payload.sessionId);
      setSelectedConceptId(orderedImages[0].id);
      setDesignBrief(null);
      setFinalizedConceptId("");
      if (payload.demoMode) {
        setError("Demo mode is showing clearly labeled placeholder concepts because Replicate is not configured.");
      }
      await refreshUsage();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Image generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitEdit() {
    const instruction = editInstruction.trim();
    if (!selectedConcept || !instruction || isEditing) return;
    await editConceptFromChat(selectedConcept, instruction, { closeDialog: true });
  }

  async function editConceptFromChat(
    sourceConcept: GeneratedConcept,
    instruction: string,
    options?: { closeDialog?: boolean; profileOverride?: DesignProfile }
  ) {
    if (!user && !(isDemoMode && !process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      setError("Sign in to save your designs and generate AI concepts.");
      return;
    }
    if (usageLimitReached) {
      setError(usageLimitMessage);
      return;
    }

    setError("");
    setIsEditing(true);

    try {
      const response = await fetch("/api/edit-design", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          imageUrl: sourceConcept.url,
          editInstruction: instruction,
          designProfile: options?.profileOverride ?? designProfile,
          sourceImageId: sourceConcept.id,
          sourceVersion: sourceConcept.version,
          rootId: sourceConcept.rootId,
          variationName: sourceConcept.variationName,
          sessionId
        })
      });
      const payload = (await response.json()) as {
        image?: GeneratedConcept;
        updatedDesignProfile?: DesignProfile;
        error?: string;
        demoMode?: boolean;
        sessionId?: string;
        usage?: UsageState;
      };
      if (payload.usage) setUsage(payload.usage);
      if (!response.ok && response.status === 429 && !payload.usage) await refreshUsage();
      if (!response.ok) throw new Error(payload.error ?? "The edit could not be completed. Please try again.");
      if (!payload.image) throw new Error("No edited image was returned. Please try again.");

      const orderedImage = { ...payload.image, createdAt: new Date().toISOString() };
      setGeneratedConcepts((current) => [...current, orderedImage]);
      if (payload.sessionId) setSessionId(payload.sessionId);
      setSelectedConceptId(orderedImage.id);
      setDesignProfile(normalizeDesignProfile(payload.updatedDesignProfile));
      setDesignBrief(null);
      setFinalizedConceptId("");
      if (payload.demoMode) {
        setError("Demo mode created a clearly labeled placeholder edit because Replicate is not configured.");
      }
      if (options?.closeDialog) {
        setSelectedConcept(null);
        setEditInstruction("");
      }
      await refreshUsage();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Image editing failed. Please try again.");
    } finally {
      setIsEditing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCompare(id: string) {
    setComparisonIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id].slice(-2);
    });
  }

  async function prepareUpload(file: File) {
    setUploadError("");
    setIsProcessingUpload(true);

    try {
      setPendingUpload(await storage.store(file));
    } catch (uploadIssue) {
      setPendingUpload(null);
      setUploadError(
        uploadIssue instanceof StorageValidationError || uploadIssue instanceof Error
          ? uploadIssue.message
          : "The selected image could not be prepared."
      );
    } finally {
      setIsProcessingUpload(false);
    }
  }

  async function confirmUpload() {
    if (!pendingUpload) return;

    const id = crypto.randomUUID();
    const uploadedConcept: GeneratedConcept = {
      id,
      url: pendingUpload.url,
      version: 1,
      parentId: null,
      rootId: id,
      variationName: "Uploaded Reference",
      description: "Customer uploaded reference design",
      prompt: "",
      editInstruction: "",
      createdAt: new Date().toISOString()
    };

    let persistedConcept = uploadedConcept;
    try {
      if (user) {
        const response = await fetch("/api/design-images", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ sessionId, designProfile, concept: uploadedConcept, type: "uploaded_reference" })
        });
        const payload = (await response.json()) as { image?: GeneratedConcept; sessionId?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "The uploaded reference could not be saved.");
        if (payload.image) persistedConcept = payload.image;
        if (payload.sessionId) setSessionId(payload.sessionId);
        await refreshUsage();
      }
    } catch (uploadIssue) {
      setError(uploadIssue instanceof Error ? uploadIssue.message : "The uploaded reference could not be saved.");
      return;
    }

    setGeneratedConcepts((current) => [...current, persistedConcept]);
    setSelectedConceptId(persistedConcept.id);
    setDesignBrief(null);
    setFinalizedConceptId("");
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "I've added your reference design. Tell me what you'd like to change - for example, the metal, diamond shape, band thickness, halo, or overall style.",
        createdAt: new Date().toISOString()
      }
    ]);
    setDesignProfile((current) =>
      normalizeDesignProfile({
        ...current,
        notes: [...current.notes, "Uploaded reference design"],
        readyForGeneration: current.readyForGeneration
      })
    );
    setUploadOpen(false);
    setPendingUpload(null);
    setUploadError("");
  }

  async function requestDesignBrief(conceptToFinalize: GeneratedConcept) {
    if (!conceptToFinalize || isGeneratingBrief) return;

    setError("");
    setFinalizedConceptId(conceptToFinalize.id);
    setSelectedConceptId(conceptToFinalize.id);
    setFinalizeCandidate(null);
    setIsGeneratingBrief(true);

    try {
      const handoffContext = createHandoffContext(conceptToFinalize, sortedConcepts, messages);
      const nextReferenceId = `DIA-${new Date().getFullYear()}-${conceptToFinalize.rootId.slice(0, 8).toUpperCase()}`;
      const response = await fetch("/api/design-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          designProfile,
          finalizedConcept: conceptToFinalize,
          concepts: handoffContext.concepts,
          conversationContext: handoffContext.conversationContext,
          referenceId: nextReferenceId,
          sessionId,
          language: "ar"
        })
      });
      const payload = (await response.json()) as { brief?: DesignBrief; error?: string; demoMode?: boolean; sessionId?: string };
      if (!response.ok) throw new Error(payload.error ?? "The design brief could not be generated.");
      if (!payload.brief) throw new Error("No design brief was returned.");
      if (!isFullyArabicDesignBrief(payload.brief)) {
        throw new Error("The workshop brief could not be converted fully to Arabic. Please try again.");
      }
      setDesignBrief(payload.brief);
      if (payload.sessionId) setSessionId(payload.sessionId);
      if (payload.demoMode) {
        setError("Demo mode generated a placeholder workshop brief because OpenAI is not configured.");
      }
      return payload.brief;
    } catch (briefError) {
      setError(briefError instanceof Error ? briefError.message : "The design brief could not be generated.");
      return null;
    } finally {
      setIsGeneratingBrief(false);
    }
  }

  async function finalizeDesign(conceptToFinalize = finalizeCandidate) {
    if (!conceptToFinalize) return;
    await requestDesignBrief(conceptToFinalize);
  }

  async function ensureArabicDesignBrief(concept: GeneratedConcept) {
    if (
      designBrief &&
      designBrief.sourceConceptId === concept.id &&
      isFullyArabicDesignBrief(designBrief)
    ) {
      return designBrief;
    }
    return requestDesignBrief(concept);
  }

  function createNewRevision(concept: GeneratedConcept) {
    setRevisionUnlockedIds((current) => new Set(current).add(concept.id));
    setSelectedConcept(concept);
    setEditInstruction("");
  }

  function reuseConceptInAtelier(concept: GeneratedConcept) {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const referenceConcept: GeneratedConcept = {
      ...concept,
      id,
      version: 1,
      parentId: null,
      rootId: id,
      createdAt: new Date(createdAt).toISOString()
    };

    setPreviewConcept(null);
    setGeneratedConcepts((current) => [...current, referenceConcept]);
    setSelectedConceptId(referenceConcept.id);
    setDesignBrief(null);
    setFinalizedConceptId("");
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I've brought "${concept.variationName}" back into the atelier as the active reference. Tell me what you would like to keep, change, or refine from it.`,
        createdAt: new Date(createdAt + 1).toISOString()
      }
    ]);
    setDesignProfile((current) =>
      normalizeDesignProfile({
        ...current,
        notes: [...current.notes, `Atelier reference: ${concept.variationName}`],
        readyForGeneration: current.readyForGeneration
      })
    );
  }

  function resetSession() {
    clearDiamondSession(user?.id);
    setMessages([
      {
        ...initialAssistantMessage,
        createdAt: new Date().toISOString()
      }
    ]);
    setDesignProfile(emptyDesignProfile);
    setStage("discovery");
    setSuggestedActions(initialSuggestions);
    setInput("");
    setIsSending(false);
    setIsGenerating(false);
    setIsEditing(false);
    setGeneratedConcepts([]);
    setSelectedConceptId("");
    setSelectedConcept(null);
    setPreviewConcept(null);
    setComparisonIds([]);
    setComparisonOpen(false);
    setUploadOpen(false);
    setFinalizeCandidate(null);
    setFinalizedConceptId("");
    setDesignBrief(null);
    setIsGeneratingBrief(false);
    setRevisionUnlockedIds(new Set());
    setPendingUpload(null);
    setUploadError("");
    setIsProcessingUpload(false);
    setEditInstruction("");
    setFavoriteIds(new Set());
    setError("");
    setSessionId("");
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] rounded-[3rem] bg-[radial-gradient(circle_at_45%_0%,rgba(215,196,154,0.16),transparent_34rem)]" />

      <div className="relative grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-6">
          <ConversationPanel
            messages={messages}
            input={input}
            isSending={isSending}
            isGenerating={isGenerating}
            isEditing={isEditing}
            suggestions={suggestedActions}
            concepts={sortedConcepts}
            activeConceptId={activeConcept?.id ?? ""}
            favoriteIds={favoriteIds}
            comparisonIds={comparisonIds}
            finalizedConceptId={finalizedConceptId}
            revisionUnlockedIds={revisionUnlockedIds}
            usage={usage}
            error={error}
            chatDisabled={usageLimitReached}
            stage={stage}
            completion={completion}
            demoMode={isDemoMode}
            isSignedIn={Boolean(user)}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onSuggestion={(action) => void sendMessage(action)}
            onUpload={() => setUploadOpen(true)}
            onReset={resetSession}
            onSelect={setSelectedConceptId}
            onGenerate={() => void generateConcepts()}
            onEdit={(concept) => {
              setSelectedConcept(concept);
              setEditInstruction("");
            }}
            onFinalize={setFinalizeCandidate}
            onCreateRevision={createNewRevision}
            onPreview={setPreviewConcept}
            onFavorite={toggleFavorite}
            onCompareImage={toggleCompare}
            onImageError={() => void refreshSessionImages()}
            onDismissError={() => setError("")}
            readyForGeneration={designProfile.readyForGeneration}
            imageModelPreference={designProfile.imageModelPreference}
            arabicLetteringRequired={arabicLetteringRequired}
            onImageModelPreferenceChange={(preference) =>
              setDesignProfile((current) =>
                normalizeDesignProfile({ ...current, imageModelPreference: preference })
              )
            }
            scrollRef={scrollRef}
          />
        </div>

        <StudioPanel
          profile={designProfile}
          visibleProfile={visibleProfile}
          concepts={sortedConcepts}
          activeConceptId={activeConcept?.id ?? ""}
          activeConcept={activeConcept}
          finalizedConcept={finalizedConcept}
          designBrief={designBrief}
          referenceId={referenceId}
          isGenerating={isGenerating}
          isGeneratingBrief={isGeneratingBrief}
          usage={usage}
          isSignedIn={Boolean(user)}
          onGenerate={() => void generateConcepts()}
          onUpload={() => setUploadOpen(true)}
          onSelect={setSelectedConceptId}
          onPrepareBrief={(concept) => setFinalizeCandidate(concept)}
          onDownloadPdf={() => {
            if (finalizedConcept) {
              void (async () => {
                const arabicBrief = await ensureArabicDesignBrief(finalizedConcept);
                if (!arabicBrief) return;
                await downloadDesignPdf({ concept: finalizedConcept, brief: arabicBrief });
              })().catch(() => setError("PDF export could not be completed. Please try again."));
            }
          }}
          onPrint={() => {
            if (finalizedConcept) {
              const printWindow = window.open("", "_blank");
              if (!printWindow) {
                setError("Allow pop-ups to open the printable design brief.");
                return;
              }
              void (async () => {
                const arabicBrief = await ensureArabicDesignBrief(finalizedConcept);
                if (!arabicBrief) {
                  printWindow.close();
                  return;
                }
                await printDesignPdf(
                  { concept: finalizedConcept, brief: arabicBrief },
                  printWindow
                );
              })().catch((printError) => {
                printWindow.close();
                setError(printError instanceof Error ? printError.message : "The printable design brief could not be opened.");
              });
            }
          }}
        />
      </div>

      <EditConceptDialog
        concept={selectedConcept}
        instruction={editInstruction}
        isEditing={isEditing}
        usage={usage}
        isSignedIn={Boolean(user)}
        onInstructionChange={setEditInstruction}
        onOpenChange={(open) => {
          if (!open && !isEditing) {
            setSelectedConcept(null);
            setEditInstruction("");
          }
        }}
        onSubmit={() => void submitEdit()}
        onImageError={() => void refreshSessionImages()}
      />

      <PreviewDialog
        concept={previewConcept}
        concepts={sortedConcepts}
        isPreparingHandoff={isGeneratingBrief}
        onOpenChange={(open) => {
          if (!open) setPreviewConcept(null);
        }}
        onNavigate={setPreviewConcept}
        onDownload={(concept) => {
          void downloadImageFile(concept).catch(() => setError("Image download could not be completed. Please try again."));
        }}
        onSendToShop={(concept) => {
          setPreviewConcept(null);
          if (concept.id === finalizedConceptId && designBrief) {
            setSelectedConceptId(concept.id);
            return;
          }
          void finalizeDesign(concept);
        }}
        onEdit={(concept) => {
          reuseConceptInAtelier(concept);
        }}
        onImageError={() => void refreshSessionImages()}
      />

      <ComparisonDialog concepts={comparisonConcepts} open={comparisonOpen} onOpenChange={setComparisonOpen} onImageError={() => void refreshSessionImages()} />
      <FinalizeDesignDialog
        concept={finalizeCandidate}
        onOpenChange={(open) => {
          if (!open) setFinalizeCandidate(null);
        }}
        onConfirm={() => void finalizeDesign()}
        onImageError={() => void refreshSessionImages()}
      />
      <UploadReferenceDialog
        open={uploadOpen}
        pendingUpload={pendingUpload}
        error={uploadError}
        isProcessing={isProcessingUpload}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setPendingUpload(null);
            setUploadError("");
          }
        }}
        onFile={prepareUpload}
        onConfirm={confirmUpload}
        onCancel={() => {
          setUploadOpen(false);
          setPendingUpload(null);
          setUploadError("");
        }}
        onBrokenImage={() => {
          setPendingUpload(null);
          setUploadError("The selected image preview could not be loaded.");
        }}
      />
    </div>
  );
}

function LuxuryAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground md:flex-row md:items-center md:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t("Dismiss", "إغلاق")}
      </Button>
    </motion.div>
  );
}

function ConversationPanel({
  messages,
  input,
  isSending,
  isGenerating,
  isEditing,
  suggestions,
  concepts,
  activeConceptId,
  favoriteIds,
  comparisonIds,
  finalizedConceptId,
  revisionUnlockedIds,
  usage,
  error,
  chatDisabled,
  stage,
  completion,
  demoMode,
  isSignedIn,
  onInputChange,
  onSubmit,
  onSuggestion,
  onUpload,
  onReset,
  onSelect,
  onGenerate,
  onEdit,
  onFinalize,
  onCreateRevision,
  onPreview,
  onFavorite,
  onCompareImage,
  onImageError,
  onDismissError,
  readyForGeneration,
  imageModelPreference,
  arabicLetteringRequired,
  onImageModelPreferenceChange,
  scrollRef
}: {
  messages: ChatMessage[];
  input: string;
  isSending: boolean;
  isGenerating: boolean;
  isEditing: boolean;
  suggestions: string[];
  concepts: GeneratedConcept[];
  activeConceptId: string;
  favoriteIds: Set<string>;
  comparisonIds: string[];
  finalizedConceptId: string;
  revisionUnlockedIds: Set<string>;
  usage: UsageState | null;
  error: string;
  chatDisabled: boolean;
  stage: ConversationStage;
  completion: number;
  demoMode: boolean;
  isSignedIn: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggestion: (value: string) => void;
  onUpload: () => void;
  onReset: () => void;
  onSelect: (id: string) => void;
  onGenerate: () => void;
  onEdit: (concept: GeneratedConcept) => void;
  onFinalize: (concept: GeneratedConcept) => void;
  onCreateRevision: (concept: GeneratedConcept) => void;
  onPreview: (concept: GeneratedConcept) => void;
  onFavorite: (id: string) => void;
  onCompareImage: (id: string) => void;
  onImageError: () => void;
  onDismissError: () => void;
  readyForGeneration: boolean;
  imageModelPreference: ImageModelPreference;
  arabicLetteringRequired: boolean;
  onImageModelPreferenceChange: (preference: ImageModelPreference) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  const aiDisabled = !isSignedIn || Boolean(usage && (usage.dailyRemaining <= 0 || usage.monthlyRemaining <= 0));
  const timeline = useMemo(
    () =>
      [
        ...messages.map((message) => ({ id: message.id, createdAt: message.createdAt, type: "message" as const, message })),
        ...concepts.map((concept) => ({ id: concept.id, createdAt: concept.createdAt, type: "concept" as const, concept }))
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [concepts, messages]
  );
  const { t } = useLanguage();
  const stageText = t(
    statusLabel(stage),
    stage === "ready_to_generate" ? "جاهز للإنشاء" : stage === "refinement" ? "قيد التنقيح" : "مرحلة الاستكشاف"
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative min-w-0 overflow-hidden rounded-[2rem] bg-[#0c0c0b] shadow-[inset_0_1px_0_rgba(215,196,154,0.14),0_30px_110px_rgba(0,0,0,0.48)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(215,196,154,0.11),transparent_25rem)]" />
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-diamond-champagne/35 to-transparent" />

      <div className="relative grid min-w-0 gap-7 p-4 sm:p-6 md:p-8">
        <div className="hidden">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/[0.035] px-4 py-2 text-xs uppercase tracking-[0.24em] text-diamond-champagne/75 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.10)]">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Concierge AI", "مساعد الأتيليه")}
            </div>

            <h1 className="font-display text-balance text-4xl font-medium leading-tight text-diamond-pearl md:text-5xl xl:text-4xl">
              {t("Private design consultation.", "استشارة تصميم خاصة.")}
            </h1>
            <p className="mt-5 text-sm leading-7 text-diamond-smoke">
              {t(
                "Begin with the occasion, stone, metal, or a reference. The agent will quietly shape the brief before any image is generated.",
                "ابدأ بالمناسبة أو الحجر أو المعدن أو مرجع بصري. سيقوم المساعد بتشكيل الملخص بهدوء قبل إنشاء أي صورة."
              )}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between rounded-full bg-white/[0.03] px-4 py-2 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.09)]">
                <span>{t("Progress", "التقدم")}</span>
                <span className="text-diamond-pearl">{completion}%</span>
              </div>
              <div className="flex items-center justify-between rounded-full bg-white/[0.03] px-4 py-2 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.09)]">
                <span>{t("Status", "الحالة")}</span>
                <span className="text-diamond-pearl">{stageText}</span>
              </div>
              {demoMode ? (
                <div className="rounded-full bg-diamond-champagne/10 px-4 py-2 text-diamond-pearl shadow-[inset_0_0_0_1px_rgba(215,196,154,0.16)]">
                  {t("Demo mode", "وضع العرض")}
                </div>
              ) : null}
              {isSignedIn && usage ? (
                <div className="rounded-full bg-white/[0.03] px-4 py-2 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.09)]">
                  {usage.dailyRemaining} daily / {usage.monthlyRemaining} monthly credits
                </div>
              ) : (
                <div className="rounded-2xl bg-diamond-champagne/[0.08] px-4 py-3 leading-5 text-diamond-pearl shadow-[inset_0_0_0_1px_rgba(215,196,154,0.13)]">
                  {t("Sign in to save designs and generate AI concepts.", "سجل الدخول لحفظ التصاميم وإنشاء تصورات بالذكاء الاصطناعي.")}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onUpload}>
                <Upload className="h-4 w-4" />
                {t("Upload Reference", "رفع مرجع")}
              </Button>
              <Button onClick={onReset}>
                <Plus className="h-4 w-4" />
                {t("New Design", "تصميم جديد")}
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-[42rem] w-full max-w-5xl min-w-0 flex-col">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-diamond-champagne/70">{t("Master designer", "المصمم الرئيسي")}</p>
              <h2 className="mt-1 font-display text-3xl font-medium text-diamond-pearl">{t("Atelier conversation", "محادثة الأتيليه")}</h2>
            </div>
            <Gem className="h-5 w-5 text-diamond-champagne/75" />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto rounded-[1.4rem] bg-[#070707]/62 p-3 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.07),inset_0_1px_20px_rgba(255,255,255,0.015)] sm:p-5">
            <AnimatePresence initial={false}>
              {timeline.map((item) => (
                item.type === "message" ? (
                  <ChatBubble key={item.id} message={item.message} stream={item.message.id === lastAssistantId} />
                ) : (
                  <ChatImageBubble
                    key={item.id}
                    concept={item.concept}
                    side={isUserProvidedConcept(item.concept) ? "user" : "assistant"}
                    active={item.concept.id === activeConceptId}
                    favorite={favoriteIds.has(item.concept.id)}
                    onSelect={onSelect}
                    onPreview={onPreview}
                    onFavorite={onFavorite}
                    onImageError={onImageError}
                  />
                )
              ))}
            </AnimatePresence>
            {isSending ? <TypingIndicator /> : null}
            {isGenerating || isEditing ? <ImageGeneratingBubble label={isEditing ? "Editing the selected image..." : "Creating one diamond image..."} /> : null}
            {error ? <LuxuryAlert message={error} onRetry={onDismissError} /> : null}
            <div ref={scrollRef} />
          </div>

          <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden">
            {suggestions.map((action) => (
              <Button
                key={action}
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSending || chatDisabled}
                className="max-w-full whitespace-normal break-words rounded-full bg-white/[0.025] px-4 py-2 text-left leading-5 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.07)]"
                onClick={() => onSuggestion(action)}
              >
                <span className="line-clamp-2 max-w-[15rem]">{translateSuggestion(action, t)}</span>
              </Button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-4 rounded-[1.25rem] bg-[#050505]/92 p-2 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.13),inset_0_10px_30px_rgba(0,0,0,0.38)]">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" aria-label="Upload reference image" type="button" onClick={onUpload}>
                <ImagePlus className="h-5 w-5" />
              </Button>
              <input
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                disabled={isSending || chatDisabled}
                className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:shadow-none disabled:opacity-60"
                placeholder={t("Describe your dream jewelry...", "صف المجوهرات التي تتخيلها...")}
                aria-label="Message the diamond consultant"
              />
              <Button size="icon" aria-label="Send message" disabled={isSending || chatDisabled || !input.trim()}>
                {isSending ? <Sparkles className="h-5 w-5 animate-pulse" /> : <SendHorizontal className="h-5 w-5" />}
              </Button>
            </div>
            <div className="flex min-w-0 items-center border-t border-diamond-champagne/[0.07] px-1 pt-1">
              <AdvancedImageSettings
                value={imageModelPreference}
                onChange={onImageModelPreferenceChange}
                arabicOverride={arabicLetteringRequired}
              />
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  );
}

const ChatBubble = memo(function ChatBubble({ message, stream }: { message: ChatMessage; stream: boolean }) {
  const isAssistant = message.role === "assistant";
  const { t } = useLanguage();
  const content =
    message.content === initialAssistantMessage.content
      ? t(
          initialAssistantMessage.content,
          "مرحباً بك في أتيليه الألماس الخاص بك. أخبرني بالقطعة التي تتخيلها، أو ابدأ بالمناسبة والمعدن وشكل الألماس."
        )
      : message.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex min-w-0 gap-3 sm:gap-4", isAssistant ? "justify-start" : "justify-end")}
    >
      {isAssistant ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.24),0_12px_30px_rgba(0,0,0,0.28)]">
          <Gem className="h-5 w-5" />
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 max-w-[92%] rounded-[1.35rem] p-4 text-sm leading-7 md:max-w-[85%] sm:p-5",
          isAssistant ? "bg-black/35 text-card-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)]" : "bg-diamond-champagne/[0.09] text-diamond-pearl shadow-[inset_0_0_0_1px_rgba(215,196,154,0.14)]"
        )}
      >
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-diamond-champagne/55">
          {message.id === initialAssistantMessage.id ? t("Now", "الآن") : formatTime(message.createdAt)}
        </p>
        {stream && isAssistant ? <StreamingMessage content={content} /> : <RichMessage content={content} />}
      </div>
    </motion.div>
  );
});

function ChatImageBubble({
  concept,
  side,
  active,
  favorite,
  onSelect,
  onPreview,
  onFavorite,
  onImageError
}: {
  concept: GeneratedConcept;
  side: "assistant" | "user";
  active: boolean;
  favorite: boolean;
  onSelect: (id: string) => void;
  onPreview: (concept: GeneratedConcept) => void;
  onFavorite: (id: string) => void;
  onImageError: () => void;
}) {
  const isAssistant = side === "assistant";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex min-w-0 gap-3 sm:gap-4", isAssistant ? "justify-start" : "justify-end")}
    >
      {isAssistant ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.24),0_12px_30px_rgba(0,0,0,0.28)]">
          <Gem className="h-5 w-5" />
        </div>
      ) : null}
      <div
        className={cn(
          "group relative w-full max-w-[17rem] overflow-hidden rounded-[1.2rem] p-1 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] sm:max-w-xs md:max-w-sm",
          isAssistant ? "bg-black/35" : "bg-diamond-champagne/[0.09]",
          active && "shadow-[inset_0_0_0_1px_rgba(215,196,154,0.32),0_18px_55px_rgba(0,0,0,0.26)]"
        )}
      >
        <button
          type="button"
          className="block aspect-[4/5] w-full overflow-hidden rounded-[1rem] text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_rgba(215,196,154,0.18)]"
          onClick={() => {
            onSelect(concept.id);
            onPreview(concept);
          }}
        >
          <img
            src={concept.url}
            alt={concept.variationName}
            loading="lazy"
            onError={onImageError}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </button>
        <button
          type="button"
          aria-label={favorite ? "Unlike concept" : "Favorite concept"}
          onClick={() => onFavorite(concept.id)}
          className={cn(
            "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border bg-black/60 text-white backdrop-blur transition hover:bg-white/15",
            favorite && "border-diamond-champagne text-diamond-champagne"
          )}
        >
          <Heart className={cn("h-4 w-4", favorite && "fill-diamond-champagne")} />
        </button>
      </div>
    </motion.div>
  );
}

function StreamingMessage({ content }: { content: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);
    const interval = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= content.length) {
          window.clearInterval(interval);
          return current;
        }

        return Math.min(content.length, current + 4);
      });
    }, 16);

    return () => window.clearInterval(interval);
  }, [content]);

  return <RichMessage content={content.slice(0, visibleLength)} />;
}

function RichMessage({ content }: { content: string }) {
  return (
    <div className="mt-2 space-y-2 leading-7">
      {content.split("\n").map((line, index) => (
        <p key={`${line}-${index}`} className="whitespace-pre-wrap">
          {renderInlineMarkdown(line)}
        </p>
      ))}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.24),0_12px_30px_rgba(0,0,0,0.28)]">
        <Sparkles className="h-5 w-5 animate-pulse" />
      </div>
      <div className="w-full max-w-md rounded-[1.35rem] bg-black/35 p-5 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)]">
        <p className="mb-3 text-sm text-muted-foreground">Crafting inspiration...</p>
        <LoadingSkeleton className="mb-3 h-4 w-2/3" />
        <LoadingSkeleton className="h-4 w-1/2" />
      </div>
    </motion.div>
  );
}

function ImageGeneratingBubble({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.24),0_12px_30px_rgba(0,0,0,0.28)]">
        <Sparkles className="h-5 w-5 animate-pulse" />
      </div>
      <div className="w-full max-w-[17rem] rounded-[1.2rem] bg-black/35 p-1 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] sm:max-w-xs md:max-w-sm">
        <LoadingSkeleton className="aspect-[4/5] rounded-[1rem]" />
        <p className="px-3 py-3 text-sm text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

function ChatImageStudies({
  concepts,
  activeConceptId,
  favoriteIds,
  comparisonIds,
  finalizedConceptId,
  revisionUnlockedIds,
  isGenerating,
  readyForGeneration,
  aiDisabled,
  onSelect,
  onGenerate,
  onUpload,
  onEdit,
  onFinalize,
  onCreateRevision,
  onPreview,
  onFavorite,
  onCompare,
  onImageError
}: {
  concepts: GeneratedConcept[];
  activeConceptId: string;
  favoriteIds: Set<string>;
  comparisonIds: string[];
  finalizedConceptId: string;
  revisionUnlockedIds: Set<string>;
  isGenerating: boolean;
  readyForGeneration: boolean;
  aiDisabled: boolean;
  onSelect: (id: string) => void;
  onGenerate: () => void;
  onUpload: () => void;
  onEdit: (concept: GeneratedConcept) => void;
  onFinalize: (concept: GeneratedConcept) => void;
  onCreateRevision: (concept: GeneratedConcept) => void;
  onPreview: (concept: GeneratedConcept) => void;
  onFavorite: (id: string) => void;
  onCompare: (id: string) => void;
  onImageError: () => void;
}) {
  const { t } = useLanguage();
  if (!concepts.length && !isGenerating && !readyForGeneration) return null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 gap-3 sm:gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.24),0_12px_30px_rgba(0,0,0,0.28)]">
        <Gem className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 rounded-[1.35rem] bg-black/35 p-4 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] sm:p-5">
        <div className="mb-4 hidden flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-diamond-champagne/55">{t("Image studies", "دراسات بصرية")}</p>
            <h3 className="mt-1 font-display text-2xl font-medium text-diamond-pearl">
              {concepts.length ? t("Presented inside your consultation", "معروضة داخل الاستشارة") : t("Ready for the first visual study", "جاهز لأول دراسة بصرية")}
            </h3>
          </div>
          {!concepts.length ? (
            <Button disabled={!readyForGeneration || isGenerating || aiDisabled} onClick={onGenerate}>
              {isGenerating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Wand2 className="h-4 w-4" />}
              {t("Present Study", "عرض دراسة")}
            </Button>
          ) : null}
        </div>

        {isGenerating ? (
          <div className="max-w-xl">
            <LoadingSkeleton className="aspect-[4/5] rounded-2xl" />
            <p className="mt-3 px-1 text-sm text-muted-foreground">{t("Creating one diamond image...", "Creating one diamond image...")}</p>
          </div>
        ) : concepts.length ? (
          <div className="flex min-w-0 flex-col gap-4">
            {concepts.map((concept) => {
              const finalized = concept.id === finalizedConceptId;
              const revisionUnlocked = revisionUnlockedIds.has(concept.id);
              return (
                <article
                  key={concept.id}
                  className={cn(
                    "group relative max-w-xl overflow-hidden rounded-[1.2rem] bg-transparent transition",
                    concept.id === activeConceptId && "shadow-[inset_0_0_0_1px_rgba(215,196,154,0.34),0_18px_55px_rgba(0,0,0,0.32)]"
                  )}
                >
                  <button
                    type="button"
                    className="relative block aspect-[4/5] w-full overflow-hidden rounded-[1.2rem] text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_rgba(215,196,154,0.18)]"
                    onClick={() => {
                      onSelect(concept.id);
                      onPreview(concept);
                    }}
                  >
                    <img src={concept.url} alt={concept.variationName} loading="lazy" onError={onImageError} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="hidden">
                      V{concept.version}
                    </div>
                    {finalized ? (
                      <div className="hidden">
                        {t("Final", "نهائي")}
                      </div>
                    ) : null}
                  </button>
                  <div className="p-0">
                    <div className="hidden">
                      <p className="text-xs uppercase tracking-[0.16em] text-diamond-champagne/65">{concept.variationName}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{concept.description}</p>
                    </div>
                    <div className="absolute right-3 top-3">
                      <Button className="hidden" variant="secondary" size="sm" onClick={() => (finalized && !revisionUnlocked ? onCreateRevision(concept) : onEdit(concept))} disabled={aiDisabled}>
                        <Wand2 className="h-4 w-4" />
                        {finalized && !revisionUnlocked ? t("Revise", "تنقيح") : t("Edit", "تعديل")}
                      </Button>
                      <Button className="hidden" variant="outline" size="sm" onClick={() => onFinalize(concept)} disabled={finalized}>
                        <Check className="h-4 w-4" />
                        {t("Final", "نهائي")}
                      </Button>
                      <IconButton label="Favorite concept" active={favoriteIds.has(concept.id)} onClick={() => onFavorite(concept.id)}>
                        <Heart className={cn("h-4 w-4", favoriteIds.has(concept.id) && "fill-diamond-champagne")} />
                      </IconButton>
                      <IconButton label="Compare concept" active={comparisonIds.includes(concept.id)} onClick={() => onCompare(concept.id)} hidden>
                        <Columns2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.025] p-5 text-sm leading-6 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)]">
            {t(
              "Continue the consultation until the direction is ready.",
              "استمر في الاستشارة حتى يصبح الاتجاه واضحاً، أو ارفع صورة مرجعية للبدء بصرياً."
            )}
          </div>
        )}

        {!concepts.length ? (
          <Button className="hidden" variant="secondary" onClick={onUpload}>
            <Upload className="h-4 w-4" />
            {t("Add Reference Image", "إضافة صورة مرجعية")}
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function IconButton({
  label,
  active,
  onClick,
  hidden,
  children
}: {
  label: string;
  active?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full border bg-black/60 text-white backdrop-blur transition hover:bg-white/15", active && "border-diamond-champagne text-diamond-champagne", hidden && "hidden")}
    >
      {children}
    </button>
  );
}

function StudioPanel({
  profile,
  visibleProfile,
  concepts,
  activeConceptId,
  activeConcept,
  isGenerating,
  isGeneratingBrief,
  finalizedConcept,
  designBrief,
  referenceId,
  usage,
  isSignedIn,
  onGenerate,
  onUpload,
  onSelect,
  onPrepareBrief,
  onDownloadPdf,
  onPrint
}: {
  profile: DesignProfile;
  visibleProfile: Array<{ key: keyof Omit<DesignProfile, "readyForGeneration">; label: string; section: string; value: string }>;
  concepts: GeneratedConcept[];
  activeConceptId: string;
  activeConcept: GeneratedConcept | null;
  isGenerating: boolean;
  isGeneratingBrief: boolean;
  finalizedConcept: GeneratedConcept | null;
  designBrief: DesignBrief | null;
  referenceId: string;
  usage: UsageState | null;
  isSignedIn: boolean;
  onGenerate: () => void;
  onUpload: () => void;
  onSelect: (id: string) => void;
  onPrepareBrief: (concept: GeneratedConcept) => void;
  onDownloadPdf: () => void;
  onPrint: () => void;
}) {
  const { t } = useLanguage();
  const limitReached = Boolean(usage && (usage.dailyRemaining <= 0 || usage.monthlyRemaining <= 0));
  const disabledReason = !isSignedIn
    ? t("Sign in to save your designs and generate AI concepts.", "سجل الدخول لحفظ التصاميم وإنشاء تصورات بالذكاء الاصطناعي.")
    : limitReached
      ? t("You've reached today's AI image limit. Please try again tomorrow.", "لقد وصلت إلى حد الصور اليومي. حاول مرة أخرى غداً.")
      : "";

  return (
    <motion.aside initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-diamond-champagne/70">{t("Private consultation", "استشارة خاصة")}</p>
              <CardTitle className="mt-1">{t("Design Profile", "ملف التصميم")}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {visibleProfile.length ? <ProfileSummary items={visibleProfile} /> : <ElegantEmptyState title={t("Profile forming", "جاري تكوين الملف")} description={t("The atelier will shape jewelry, stone, setting, style, and occasion details as you talk.", "سيشكل الأتيليه نوع المجوهرات والحجر والترصيع والأسلوب والمناسبة أثناء المحادثة.")} compact />}
          <Button className="hidden" disabled={!profile.readyForGeneration || isGenerating || Boolean(disabledReason)} onClick={onGenerate}>
            {isGenerating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Wand2 className="h-4 w-4" />}
            {t("Present Diamond Study", "عرض دراسة ألماس")}
          </Button>
          {disabledReason ? <p className="mt-3 text-sm leading-6 text-diamond-champagne">{disabledReason}</p> : null}
          {isSignedIn && usage ? (
            <div className="mt-3 rounded-2xl bg-black/25 p-3 text-sm leading-6 text-muted-foreground ring-1 ring-diamond-champagne/10">
              <p>{usage.dailyRemaining} / {usage.dailyLimit} daily image credits remaining</p>
              <p>{usage.monthlyRemaining} / {usage.monthlyLimit} monthly image credits remaining</p>
            </div>
          ) : null}
          <Button className="hidden" variant="secondary" onClick={onUpload}>
            <Upload className="h-4 w-4" />
            {t("Add Reference Image", "إضافة صورة مرجعية")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-diamond-champagne/70">{t("Workshop handoff", "تسليم الورشة")}</p>
              <CardTitle className="mt-1">{t("Atelier Brief", "ملخص الأتيليه")}</CardTitle>
            </div>
            {finalizedConcept ? (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-diamond-champagne/40 bg-diamond-champagne/15 text-diamond-champagne"
              >
                <Check className="h-5 w-5" />
              </motion.div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!finalizedConcept && activeConcept ? (
            <div className="space-y-3 rounded-2xl bg-black/25 p-4 ring-1 ring-diamond-champagne/10">
              <p className="text-xs uppercase tracking-[0.18em] text-diamond-champagne/70">{t("Current image", "Current image")}</p>
              <p className="text-sm font-medium text-white">{activeConcept.variationName}</p>
              <Button className="w-full" size="sm" onClick={() => onPrepareBrief(activeConcept)} disabled={isGeneratingBrief}>
                {isGeneratingBrief ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
                {t("Prepare Brief", "Prepare Brief")}
              </Button>
            </div>
          ) : null}
          {finalizedConcept ? (
            <>
              <div className="rounded-2xl bg-diamond-champagne/10 p-4 ring-1 ring-diamond-champagne/20">
                <p className="font-medium text-white">{t("Final Direction Chosen", "تم اختيار الاتجاه النهائي")}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{finalizedConcept.variationName}</p>
                <p className="mt-2 text-xs text-diamond-champagne">{referenceId}</p>
              </div>
              {isGeneratingBrief ? (
                <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-diamond-champagne/10">
                  <LoadingSkeleton className="mb-3 h-4 w-2/3" />
                  <p className="text-sm text-muted-foreground">{t("Preparing the atelier handoff...", "جاري تجهيز تسليم الأتيليه...")}</p>
                </div>
              ) : designBrief ? (
                <>
                  <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-diamond-champagne/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-diamond-champagne/70">{t("Session summary", "ملخص الجلسة")}</p>
                    <p className="mt-3 text-sm leading-6 text-white">{designBrief.sessionSummary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" onClick={onDownloadPdf}>
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onPrint}>
                      <Printer className="h-4 w-4" />
                      {t("Print", "طباعة")}
                    </Button>
                  </div>
                  <Button className="w-full" variant="outline" disabled title="Manufacturer connection coming soon">
                    <Store className="h-4 w-4" />
                    {t("Send to shop", "إرسال إلى المتجر")}
                  </Button>
                </>
              ) : (
                <ElegantEmptyState title={t("Brief pending", "الملخص قيد الانتظار")} description={t("The professional handoff brief will appear after the session summary is prepared.", "سيظهر ملخص التسليم الاحترافي بعد تجهيز ملخص الجلسة.")} compact />
              )}
            </>
          ) : (
            <ElegantEmptyState title={t("No final direction yet", "لا يوجد اتجاه نهائي بعد")} description={t("Choose one study to prepare the workshop-ready design brief and export card.", "اختر دراسة واحدة لتجهيز ملخص التصميم وبطاقة التصدير للورشة.")} compact />
          )}
        </CardContent>
      </Card>

      <Card className="hidden">
        <CardHeader>
          <CardTitle>{t("Design Lineage", "تسلسل التصميم")}</CardTitle>
        </CardHeader>
        <CardContent>
          {concepts.length ? (
            <div className="space-y-3">
              {concepts.map((concept, index) => (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => onSelect(concept.id)}
                  className={cn("flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeConceptId === concept.id && "bg-diamond-champagne/10 ring-1 ring-diamond-champagne/45")}
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-xs text-white ring-1 ring-diamond-champagne/15">V{concept.version}</div>
                    {index < concepts.length - 1 ? <div className="mt-2 h-8 w-px bg-border" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{concept.variationName}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {concept.parentId ? t("Refined study", "دراسة منقحة") : t("Original study", "دراسة أصلية")}
                    </p>
                    {activeConceptId === concept.id ? <p className="mt-2 text-xs text-diamond-champagne">Current</p> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <ElegantEmptyState title={t("No lineage yet", "لا يوجد تسلسل بعد")} description={t("Your generated and refined studies will form a clickable timeline here.", "ستظهر الدراسات المنشأة والمنقحة هنا كتسلسل قابل للنقر.")} compact />
          )}
        </CardContent>
      </Card>
    </motion.aside>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div className="h-full rounded-full bg-diamond-champagne" initial={{ width: 0 }} animate={{ width: `${value}%` }} />
    </div>
  );
}

function StageTracker({ stage, ready }: { stage: ConversationStage; ready: boolean }) {
  const { t } = useLanguage();
  const steps = [
    t("Discovery", "الاستكشاف"),
    t("Refinement", "التنقيح"),
    t("Ready for Generation", "جاهز للإنشاء"),
    t("Refining", "قيد التعديل"),
    t("Completed", "مكتمل")
  ];
  const activeIndex = ready ? 2 : stage === "refinement" ? 1 : 0;

  return (
    <div className="grid gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-3 text-xs">
          <span className={cn("h-2.5 w-2.5 rounded-full border", index <= activeIndex ? "border-diamond-champagne bg-diamond-champagne" : "border-muted-foreground/40")} />
          <span className={index <= activeIndex ? "text-white" : "text-muted-foreground"}>{step}</span>
        </div>
      ))}
    </div>
  );
}

function ProfileSummary({
  items
}: {
  items: Array<{ key: keyof Omit<DesignProfile, "readyForGeneration">; label: string; section: string; value: string }>;
}) {
  const sections = ["Jewelry", "Personalization", "Metal", "Stone", "Setting", "Style", "Occasion", "Notes"];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (!sectionItems.length) return null;
        return (
          <div key={section} className="rounded-2xl bg-black/22 p-4 ring-1 ring-diamond-champagne/10">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-diamond-champagne/70">{section}</p>
            <div className="space-y-3">
              {sectionItems.map((item) => (
                <div key={item.key} className="text-sm">
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className="mt-1 leading-6 text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ElegantEmptyState({ title, description, compact }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-black/20 p-6 text-center ring-1 ring-diamond-champagne/10", compact && "p-4")}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-diamond-champagne/25 bg-black/35 text-diamond-champagne">
        <Gem className="h-5 w-5" />
      </div>
      <h3 className="font-display text-xl font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function UploadReferenceDialog({
  open,
  pendingUpload,
  error,
  isProcessing,
  onOpenChange,
  onFile,
  onConfirm,
  onCancel,
  onBrokenImage
}: {
  open: boolean;
  pendingUpload: StoredImage | null;
  error: string;
  isProcessing: boolean;
  onOpenChange: (open: boolean) => void;
  onFile: (file: File) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onBrokenImage: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a Reference Image</DialogTitle>
          <DialogDescription>
            Add a diamond reference image as the first study, then refine it with the same private atelier workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_18rem]">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-diamond-champagne/20 bg-black/25 p-8 text-center transition focus-within:ring-2 focus-within:ring-ring",
              isDragging && "border-diamond-champagne bg-diamond-champagne/10"
            )}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border bg-white/[0.05] text-diamond-champagne">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="font-display text-2xl font-medium text-white">Drop your reference image here</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              PNG, JPG, JPEG, or WEBP. Maximum 10MB. PDF, SVG, HEIC, and videos are not accepted.
            </p>
            <span className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-luxury transition hover:brightness-110">
              Browse files
            </span>
          </label>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-diamond-champagne/15 bg-black/40">
              {pendingUpload ? (
                <img
                  src={pendingUpload.url}
                  alt="Uploaded reference preview"
                  className="aspect-square h-full w-full object-cover"
                  onError={onBrokenImage}
                />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center p-6 text-center">
                  <Gem className="mb-4 h-8 w-8 text-diamond-champagne" />
                  <p className="text-sm text-muted-foreground">A private preview appears before confirming.</p>
                </div>
              )}
            </div>

            {pendingUpload ? (
              <div className="rounded-2xl border bg-white/[0.035] p-4 text-sm">
                <p className="truncate font-medium text-white">{pendingUpload.fileName}</p>
                <p className="mt-1 text-muted-foreground">{formatBytes(pendingUpload.size)}</p>
              </div>
            ) : null}

            {isProcessing ? (
              <div className="rounded-2xl border bg-white/[0.035] p-4">
                <LoadingSkeleton className="mb-3 h-4 w-2/3" />
                <p className="text-sm text-muted-foreground">Preparing your reference for the atelier...</p>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onCancel} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={onConfirm} disabled={!pendingUpload || isProcessing}>
                Add Reference
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDesignDialog({
  concept,
  onOpenChange,
  onConfirm,
  onImageError
}: {
  concept: GeneratedConcept | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onImageError: () => void;
}) {
  return (
    <Dialog open={Boolean(concept)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose This Final Direction</DialogTitle>
          <DialogDescription>
            You are about to mark this study as the preferred diamond direction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {concept ? (
            <div className="overflow-hidden rounded-2xl border border-diamond-champagne/15 bg-black/30">
              <img src={concept.url} alt={concept.variationName} onError={onImageError} className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <p className="text-sm font-medium text-white">
                  V{concept.version} - {concept.variationName}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{concept.description}</p>
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-diamond-champagne/30 bg-diamond-champagne/10 p-4 text-sm leading-6 text-muted-foreground">
            This does not create a manufacturing-ready file. Your jeweler will review and refine the design before
            production.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>
              <Check className="h-4 w-4" />
              Choose Direction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditConceptDialog({
  concept,
  instruction,
  isEditing,
  usage,
  isSignedIn,
  onImageError,
  onInstructionChange,
  onOpenChange,
  onSubmit
}: {
  concept: GeneratedConcept | null;
  instruction: string;
  isEditing: boolean;
  usage: UsageState | null;
  isSignedIn: boolean;
  onImageError: () => void;
  onInstructionChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const limitReached = Boolean(usage && (usage.dailyRemaining <= 0 || usage.monthlyRemaining <= 0));
  const disabledReason = !isSignedIn
    ? "Sign in to save your designs and generate AI concepts."
    : limitReached
      ? "You've reached today's AI image limit. Please try again tomorrow."
      : "";

  return (
    <Dialog open={Boolean(concept)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Refine Diamond Study</DialogTitle>
          <DialogDescription>Describe one focused refinement. The original study will remain in your design history.</DialogDescription>
        </DialogHeader>
        {concept ? (
          <div className="grid gap-5 md:grid-cols-[18rem_1fr]">
            <div className="overflow-hidden rounded-2xl border border-diamond-champagne/15 bg-black">
              <img src={concept.url} alt={concept.variationName} onError={onImageError} className="aspect-square h-full w-full object-cover" />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  V{concept.version} - {concept.variationName}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{concept.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {editSuggestions.map((suggestion) => (
                  <Button key={suggestion} size="sm" variant="ghost" type="button" disabled={isEditing} onClick={() => onInstructionChange(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
              <textarea
                value={instruction}
                onChange={(event) => onInstructionChange(event.target.value)}
                disabled={isEditing}
                rows={5}
                className="w-full resize-none rounded-2xl border bg-background/70 p-4 text-sm leading-6 text-white outline-none placeholder:text-muted-foreground disabled:opacity-60"
                placeholder="Describe the refinement you want..."
                aria-label="Describe the design refinement"
              />
              {isEditing ? (
                <div className="rounded-2xl border bg-white/[0.035] p-4">
                  <LoadingSkeleton className="mb-3 h-4 w-2/3" />
                  <p className="text-sm text-muted-foreground">Refining your diamond study...</p>
                </div>
              ) : null}
              {disabledReason ? <p className="text-sm leading-6 text-diamond-champagne">{disabledReason}</p> : null}
              {isSignedIn && usage ? (
                <div className="rounded-2xl border bg-white/[0.035] p-3 text-sm leading-6 text-muted-foreground">
                  <p>{usage.dailyRemaining} / {usage.dailyLimit} daily image credits remaining</p>
                  <p>{usage.monthlyRemaining} / {usage.monthlyLimit} monthly image credits remaining</p>
                </div>
              ) : null}
              <Button className="w-full" disabled={isEditing || !instruction.trim() || Boolean(disabledReason)} onClick={onSubmit}>
                {isEditing ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Wand2 className="h-4 w-4" />}
                Refine Study
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({
  concept,
  concepts,
  isPreparingHandoff,
  onOpenChange,
  onNavigate,
  onDownload,
  onSendToShop,
  onEdit,
  onImageError
}: {
  concept: GeneratedConcept | null;
  concepts: GeneratedConcept[];
  isPreparingHandoff: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (concept: GeneratedConcept) => void;
  onDownload: (concept: GeneratedConcept) => void;
  onSendToShop: (concept: GeneratedConcept) => void;
  onEdit: (concept: GeneratedConcept) => void;
  onImageError: () => void;
}) {
  const index = concept ? concepts.findIndex((item) => item.id === concept.id) : -1;
  const canNavigate = concepts.length > 1 && index >= 0;

  return (
    <Dialog open={Boolean(concept)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-6xl border-white/10 bg-black/90 p-0">
        {concept ? (
          <div className="relative min-h-[80vh] overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-diamond-radial opacity-60" />
            <div className="relative flex min-h-[80vh] flex-col">
              <div className="flex flex-col gap-4 border-b bg-black/35 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-diamond-champagne/70">Private preview</p>
                  <h2 className="font-display mt-1 text-2xl font-medium text-white">
                    {concept.variationName}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onSendToShop(concept)}
                    disabled={isPreparingHandoff}
                  >
                    {isPreparingHandoff ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Store className="h-4 w-4" />}
                    {isPreparingHandoff ? "Preparing..." : "Send to shop"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit(concept)}
                    disabled={isPreparingHandoff}
                  >
                    <Wand2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Download image" onClick={() => onDownload(concept)}>
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Close preview" onClick={() => onOpenChange(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="relative flex flex-1 items-center justify-center p-8">
                {canNavigate ? (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute left-4 z-10"
                    aria-label="Previous concept"
                    onClick={() => onNavigate(concepts[(index - 1 + concepts.length) % concepts.length])}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                ) : null}
                <img src={concept.url} alt={concept.variationName} onError={onImageError} className="max-h-[68vh] rounded-2xl border border-diamond-champagne/15 object-contain shadow-luxury" />
                {canNavigate ? (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-4 z-10"
                    aria-label="Next concept"
                    onClick={() => onNavigate(concepts[(index + 1) % concepts.length])}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ComparisonDialog({
  concepts,
  open,
  onOpenChange,
  onImageError
}: {
  concepts: GeneratedConcept[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageError: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare Design Studies</DialogTitle>
          <DialogDescription>Select two images from the archive to review them side by side.</DialogDescription>
        </DialogHeader>
        {concepts.length === 2 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {concepts.map((concept, index) => (
              <div key={concept.id} className="overflow-hidden rounded-2xl border border-diamond-champagne/15 bg-black/30">
                <div className="border-b p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{index === 0 ? "Before" : "After"}</p>
                  <h3 className="font-display mt-1 text-xl font-medium text-white">
                    V{concept.version} - {concept.variationName}
                  </h3>
                </div>
                <img src={concept.url} alt={concept.variationName} onError={onImageError} className="aspect-square w-full object-cover" />
                <p className="p-4 text-sm leading-6 text-muted-foreground">{concept.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <ElegantEmptyState title="Choose two studies" description="Use the compare icon on two gallery cards to open a split-screen review." />
        )}
      </DialogContent>
    </Dialog>
  );
}

function getCompletion(profile: DesignProfile) {
  const fields = [
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
    profile.fontPreference
  ];
  const base = Math.round((fields.filter(Boolean).length / fields.length) * 85);
  return Math.min(100, base + (profile.readyForGeneration ? 15 : 0));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function downloadImageFile(concept: GeneratedConcept) {
  const response = await fetch(concept.url);
  if (!response.ok) throw new Error("Image download failed.");

  const blob = await response.blob();
  const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${safeFileName(concept.variationName || "diamond-design")}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "diamond-design";
}

function isFullyArabicDesignBrief(brief: DesignBrief) {
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

function isUserProvidedConcept(concept: GeneratedConcept) {
  const label = `${concept.variationName} ${concept.description}`.toLowerCase();
  return (
    !concept.prompt.trim() &&
    (label.includes("uploaded reference") ||
      label.includes("customer uploaded reference") ||
      label.includes("reference selected from the inspiration library"))
  );
}

function latestUserProvidedConcept(concepts: GeneratedConcept[]) {
  return [...concepts].reverse().find((concept) => isUserProvidedConcept(concept)) ?? null;
}

function latestEditableConcept(concepts: GeneratedConcept[]) {
  return [...concepts].reverse().find(Boolean) ?? null;
}

function buildChatImageContext(concepts: GeneratedConcept[], selectedConceptId: string): ChatImageContext[] {
  const latestConceptId = concepts[concepts.length - 1]?.id ?? "";

  return concepts.slice(-12).map((concept) => ({
    id: concept.id,
    variationName: concept.variationName,
    description: concept.description,
    isUserProvided: isUserProvidedConcept(concept),
    isSelected: concept.id === selectedConceptId,
    isLatest: concept.id === latestConceptId
  }));
}

function cleanClientSuggestions(actions: unknown): string[] {
  if (!Array.isArray(actions)) return initialSuggestions;

  const blocked = ["ask customer", "clarify", "after ", "next ", "should ", "need to", "determine", "collect"];
  const cleaned = actions
    .filter((action): action is string => typeof action === "string")
    .map((action) => action.trim())
    .filter((action) => action.length > 0 && action.length <= 36)
    .filter((action) => !blocked.some((phrase) => action.toLowerCase().includes(phrase)))
    .slice(0, 4);

  return cleaned.length ? cleaned : initialSuggestions;
}

function translateSuggestion(value: string, t: (english: string, arabic: string) => string) {
  const suggestions: Record<string, string> = {
    "Engagement ring": "خاتم خطوبة",
    "Modern pendant": "قلادة عصرية",
    "I prefer white gold": "أفضل الذهب الأبيض",
    "I want an oval diamond": "أريد ألماسة بيضاوية",
    "Classic solitaire engagement ring": "خاتم خطوبة سوليتير كلاسيكي",
    "Vintage inspired halo pendant": "قلادة هالة بطابع كلاسيكي",
    "Elegant three stone ring": "خاتم أنيق بثلاثة أحجار",
    "Nature inspired design": "تصميم مستوحى من الطبيعة"
  };

  return t(value, suggestions[value] ?? value);
}
