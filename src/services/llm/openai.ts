import { requireOpenAiApiKey, serverEnv } from "@/config/env";
import type { LlmCompletionRequest, LlmCompletionResponse, LlmProvider } from "./provider";

type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class MissingOpenAiApiKeyError extends Error {
  constructor() {
    super("OpenAI API key is missing. Add OPENAI_API_KEY to .env.local and restart the server.");
    this.name = "MissingOpenAiApiKeyError";
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey = serverEnv.openaiApiKey, model = serverEnv.openaiModel) {
    try {
      this.apiKey = apiKey || requireOpenAiApiKey();
    } catch {
      throw new MissingOpenAiApiKeyError();
    }

    this.model = model;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const response = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages satisfies OpenAiChatMessage[],
          temperature: request.temperature ?? 0.35,
          response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined
        })
      }),
      45_000
    );

    const payload = (await response.json()) as OpenAiChatResponse;

    if (!response.ok) {
      console.error("OpenAI request failed", payload.error?.message ?? response.statusText);
      throw new Error("OpenAI request failed.");
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    return { content };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("OpenAI request timed out.")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
