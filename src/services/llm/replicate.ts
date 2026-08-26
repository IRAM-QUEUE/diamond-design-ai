import Replicate from "replicate";
import { requireReplicateApiToken, serverEnv } from "@/config/env";
import type { LlmCompletionRequest, LlmCompletionResponse, LlmMessage, LlmProvider } from "./provider";

const requestTimeoutMs = 60_000;
const maximumJsonAttempts = 2;
const maximumRepairContextLength = 12_000;
const jsonResponseInstruction =
  "Return exactly one valid JSON object. Do not use Markdown fences, commentary, or text before or after the JSON object.";

type ReplicateLlmOutput = string | Array<ReplicateLlmOutput> | { output?: ReplicateLlmOutput; text?: string };
type ReplicateModelIdentifier = `${string}/${string}`;

export class ReplicateLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateLlmError";
  }
}

export class ReplicateLlmProvider implements LlmProvider {
  private readonly client: Replicate;
  private readonly model: ReplicateModelIdentifier;

  constructor(apiToken = serverEnv.replicateApiToken, model = serverEnv.replicateLlmModel) {
    const token = apiToken || requireReplicateApiToken();
    this.client = new Replicate({ auth: token, useFileOutput: false });
    this.model = normalizeModelIdentifier(model);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const expectsJson = request.responseFormat === "json";
    const maximumAttempts = expectsJson ? maximumJsonAttempts : 1;
    let messages = prepareMessages(request.messages, expectsJson);
    let previousOutput = "";

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      if (attempt > 0) {
        messages = [
          ...messages,
          ...(previousOutput
            ? [{ role: "assistant" as const, content: previousOutput.slice(0, maximumRepairContextLength) }]
            : []),
          {
            role: "user",
            content: `${jsonResponseInstruction} Correct the previous response without changing its intended data.`
          }
        ];
      }

      const content = await this.runOnce(messages, request);
      if (!content) {
        if (expectsJson) continue;
        throw new ReplicateLlmError("Replicate GPT-5.4 returned an empty response.");
      }
      if (!expectsJson) return { content };

      const normalizedJson = normalizeJsonObjectResponse(content);
      if (normalizedJson) return { content: normalizedJson };
      previousOutput = content;
    }

    throw new ReplicateLlmError("Replicate GPT-5.4 did not return valid JSON after an automatic retry.");
  }

  private async runOnce(messages: LlmMessage[], request: LlmCompletionRequest) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const output = (await this.client.run(this.model, {
        input: {
          messages,
          reasoning_effort: request.reasoningEffort ?? "none",
          verbosity: request.verbosity ?? (request.responseFormat === "json" ? "low" : "medium"),
          max_completion_tokens: request.maxCompletionTokens ?? 4_096
        },
        signal: controller.signal
      })) as ReplicateLlmOutput;
      const content = extractTextOutput(output).trim();
      return content;
    } catch (error) {
      if (error instanceof ReplicateLlmError) throw error;
      if (controller.signal.aborted) {
        throw new ReplicateLlmError("Replicate GPT-5.4 timed out.");
      }

      console.error("Replicate LLM request failed", getErrorMessage(error));
      throw new ReplicateLlmError("Replicate GPT-5.4 request failed.");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function prepareMessages(messages: LlmMessage[], expectsJson: boolean) {
  const prepared = messages.map((message) => ({ ...message }));
  if (!expectsJson) return prepared;

  const systemMessage = prepared.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = `${systemMessage.content}\n\n${jsonResponseInstruction}`;
    return prepared;
  }

  return [{ role: "system" as const, content: jsonResponseInstruction }, ...prepared];
}

function normalizeModelIdentifier(value: string): ReplicateModelIdentifier {
  const model = value.trim();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+(?::[a-f0-9]+)?$/i.test(model)) {
    throw new ReplicateLlmError("REPLICATE_LLM_MODEL must use the owner/model format.");
  }

  return model as ReplicateModelIdentifier;
}

function extractTextOutput(output: ReplicateLlmOutput): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map(extractTextOutput).join("");
  if (typeof output === "object" && output !== null) {
    if (typeof output.text === "string") return output.text;
    if (output.output !== undefined) return extractTextOutput(output.output);
  }
  return "";
}

export function normalizeJsonObjectResponse(content: string) {
  const trimmed = content.trim().replace(/^\uFEFF/, "");
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidates = [trimmed, fencedMatch?.[1]?.trim(), extractFirstJsonObject(trimmed)].filter(
    (candidate): candidate is string => Boolean(candidate)
  );

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return JSON.stringify(parsed);
      }
    } catch {
      // Try the next safely extracted candidate before asking the model to repair its response.
    }
  }

  return null;
}

function extractFirstJsonObject(content: string) {
  for (let start = content.indexOf("{"); start >= 0; start = content.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < content.length; index += 1) {
      const character = content[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unknown Replicate error";
}
