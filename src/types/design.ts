export type ConversationStage = "discovery" | "refinement" | "ready_to_generate";

export type ImageModelPreference =
  | "default"
  | "precise_changes"
  | "names_lettering"
  | "creative_exploration";

export type DesignProfile = {
  jewelryType: string;
  occasion: string;
  recipient: string;
  style: string;
  metal: string;
  diamondShape: string;
  setting: string;
  bandStyle: string;
  budgetRange: string;
  personalizationText: string;
  personalizationScript: string;
  fontPreference: string;
  letteringStylePreference: string;
  imageModelPreference: ImageModelPreference;
  notes: string[];
  readyForGeneration: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatImageContext = {
  id: string;
  variationName: string;
  description: string;
  isUserProvided: boolean;
  isSelected: boolean;
  isLatest: boolean;
};

export type ChatAction =
  | { type: "chat" }
  | { type: "ask_clarifying_question"; question?: string }
  | { type: "generate_image"; instruction?: string; reason?: string }
  | { type: "edit_image"; targetImageId?: string; editInstruction: string; reason?: string };

export type ChatApiRequest = {
  messages: ChatMessage[];
  designProfile: DesignProfile;
  sessionId?: string;
  selectedConceptId?: string;
  images?: ChatImageContext[];
};

export type ChatApiResponse = {
  assistantMessage: string;
  updatedDesignProfile: DesignProfile;
  stage: ConversationStage;
  suggestedActions: string[];
  action: ChatAction;
};

export type GeneratedConcept = {
  id: string;
  url: string;
  prompt: string;
  variationName: string;
  description: string;
  editInstruction?: string;
  version: number;
  parentId: string | null;
  rootId: string;
  createdAt: string;
};

export type CustomerContactDetails = {
  name: string;
  mobile: string;
  email: string;
};

export type DesignBrief = {
  referenceId: string;
  sourceConceptId?: string;
  sessionSummary: string;
  customerDesignSummary: string;
  jewelryType: string;
  occasion: string;
  recipient: string;
  style: string;
  metal: string;
  diamondShape: string;
  setting: string;
  bandStyle: string;
  customerNotes: string[];
  designEvolution: string;
  finalAiDescription: string;
  workshopNotes: string;
  recommendedDiscussionPoints: string[];
  revisionHistorySummary: string;
  disclaimer: string;
  customerContact?: CustomerContactDetails;
};

export const emptyDesignProfile: DesignProfile = {
  jewelryType: "",
  occasion: "",
  recipient: "",
  style: "",
  metal: "",
  diamondShape: "",
  setting: "",
  bandStyle: "",
  budgetRange: "",
  personalizationText: "",
  personalizationScript: "",
  fontPreference: "",
  letteringStylePreference: "",
  imageModelPreference: "default",
  notes: [],
  readyForGeneration: false
};
