export const serverEnv = {
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.4",
  replicateApiToken: process.env.REPLICATE_API_TOKEN?.trim() ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
};

export type RuntimeEnvironment = "production" | "development";

export type EnvironmentStatus = {
  status: "ok" | "missing";
  environment: RuntimeEnvironment;
  supabase: "configured" | "missing";
  openai: "configured" | "missing";
  replicate: "configured" | "missing";
  demoMode: boolean;
  missing: string[];
  warnings: string[];
};

const requiredProductionEnv = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "REPLICATE_API_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function getEnvironmentStatus(): EnvironmentStatus {
  const missing = requiredProductionEnv.filter((name) => !process.env[name]?.trim());
  const warnings: string[] = [];
  const environment = getRuntimeEnvironment();

  if (environment === "production" && serverEnv.demoMode) {
    warnings.push("NEXT_PUBLIC_DEMO_MODE is true in production. Disable demo mode before launch.");
  }

  return {
    status: missing.length || (environment === "production" && serverEnv.demoMode) ? "missing" : "ok",
    environment,
    supabase: serverEnv.supabaseUrl && serverEnv.supabaseAnonKey && serverEnv.supabaseServiceRoleKey ? "configured" : "missing",
    openai: serverEnv.openaiApiKey && serverEnv.openaiModel ? "configured" : "missing",
    replicate: serverEnv.replicateApiToken ? "configured" : "missing",
    demoMode: serverEnv.demoMode,
    missing,
    warnings
  };
}

export function validateProductionEnvironment() {
  const status = getEnvironmentStatus();
  if (status.status === "ok") return status;

  const details = [
    status.missing.length ? `Missing required environment variables: ${status.missing.join(", ")}` : "",
    ...status.warnings
  ].filter(Boolean);

  throw new MissingEnvironmentVariableError(
    "PRODUCTION_ENV",
    details.join(" ") || "Production environment variables are incomplete."
  );
}

export class MissingEnvironmentVariableError extends Error {
  constructor(
    readonly variableName: "OPENAI_API_KEY" | "REPLICATE_API_TOKEN" | "PRODUCTION_ENV",
    message: string
  ) {
    super(message);
    this.name = "MissingEnvironmentVariableError";
  }
}

export function requireOpenAiApiKey() {
  if (!serverEnv.openaiApiKey) {
    throw new MissingEnvironmentVariableError(
      "OPENAI_API_KEY",
      "OpenAI API key is missing. Add OPENAI_API_KEY to .env.local and restart the server."
    );
  }

  return serverEnv.openaiApiKey;
}

export function requireReplicateApiToken() {
  if (!serverEnv.replicateApiToken) {
    throw new MissingEnvironmentVariableError(
      "REPLICATE_API_TOKEN",
      "Replicate API token is missing. Add REPLICATE_API_TOKEN to .env.local and restart the server."
    );
  }

  return serverEnv.replicateApiToken;
}
