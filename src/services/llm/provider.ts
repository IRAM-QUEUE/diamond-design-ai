export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmCompletionRequest = {
  messages: LlmMessage[];
  temperature?: number;
  responseFormat?: "text" | "json";
};

export type LlmCompletionResponse = {
  content: string;
};

export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream?(request: LlmCompletionRequest): AsyncIterable<LlmCompletionResponse>;
}
