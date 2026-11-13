export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  >;
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
