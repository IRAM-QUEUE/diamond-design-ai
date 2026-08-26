import { NextResponse } from "next/server";
import { getEnvironmentStatus } from "@/config/env";

export const runtime = "nodejs";

export function GET() {
  const status = getEnvironmentStatus();

  return NextResponse.json({
    status: "ok",
    environment: status.environment,
    supabase: status.supabase,
    openai: status.openai,
    replicate: status.replicate,
    demoMode: status.demoMode
  });
}
