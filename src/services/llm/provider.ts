export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
export type LlmVerbosity = "low" | "medium" | "high";

export type LlmCompletionRequest = {
  messages: LlmMessage[];
  responseFormat?: "text" | "json";
  reasoningEffort?: LlmReasoningEffort;
  verbosity?: LlmVerbosity;
  maxCompletionTokens?: number;
};

export type LlmCompletionResponse = {
  content: string;
};

export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream?(request: LlmCompletionRequest): AsyncIterable<LlmCompletionResponse>;
}
