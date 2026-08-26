import { NextResponse } from "next/server";
import { getEnvironmentStatus, serverEnv } from "@/config/env";

export const runtime = "nodejs";

export function GET() {
  const status = getEnvironmentStatus();

  return NextResponse.json(
    {
      status: status.status,
      environment: status.environment,
      supabase: status.supabase,
      llm: status.llm,
      llmProvider: "replicate",
      llmModel: serverEnv.replicateLlmModel,
      replicate: status.replicate,
      demoMode: status.demoMode
    },
    { status: status.status === "ok" ? 200 : 503 }
  );
}
