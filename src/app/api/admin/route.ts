import { NextResponse } from "next/server";
import { ApiInputError, handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/services/supabase/admin";
import {
  AdminReportRangeError,
  readAllReportRows,
  resolveAdminReportRange,
  summarizeAdminUsage,
  type AdminUser,
  type ImageUsageEvent
} from "@/lib/admin-reporting";

export const runtime = "nodejs";

type AdminPatchBody = {
  userId?: string;
  isBlocked?: boolean;
  dailyImageLimit?: number;
  monthlyImageLimit?: number;
  role?: "customer" | "admin";
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
    }

    const range = resolveAdminReportRange(new URL(request.url).searchParams);
    const [profiles, events] = await Promise.all([
      readAllReportRows<AdminUser>((from, to) => admin.from("profiles")
        .select("id,email,full_name,role,daily_image_limit,monthly_image_limit,is_blocked")
        .order("id").range(from, to)),
      readAllReportRows<ImageUsageEvent>((from, to) => admin.from("usage_events")
        .select("user_id,event_type,units,estimated_cost,status,latency_ms")
        .gte("created_at", range.start)
        .lt("created_at", range.endExclusive)
        .in("event_type", ["image_generation", "image_edit"])
        .order("created_at").order("id").range(from, to))
    ]);

    const metrics = summarizeAdminUsage(profiles, events);
    return NextResponse.json({
      range,
      ...metrics,
      // Keep already-open daily dashboards working across this deployment.
      ...(range.period === "daily" ? {
        successfulImageGenerationsToday: metrics.successfulImageGenerations,
        failedImageGenerationsToday: metrics.failedImageGenerations,
        reservedImageGenerationsToday: metrics.reservedImageGenerations,
        successfulImageEditsToday: metrics.successfulImageEdits,
        failedImageEditsToday: metrics.failedImageEdits,
        reservedImageEditsToday: metrics.reservedImageEdits,
        imagesGeneratedToday: metrics.successfulImageGenerations,
        imagesEditedToday: metrics.successfulImageEdits,
        estimatedUsageCostToday: metrics.estimatedUsageCost,
        averageLatencyMsToday: metrics.averageLatencyMs
      } : {})
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AdminReportRangeError) {
      return handleApiError(new ApiInputError(error.message), "Invalid reporting range.");
    }
    return handleApiError(error, "Admin metrics could not be loaded.");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await parseJsonBody<AdminPatchBody>(request);
    if (!body.userId) {
      throw new ApiInputError("User ID is required.");
    }

    const updates: Record<string, number | boolean | string> = {};
    if (typeof body.isBlocked === "boolean") updates.is_blocked = body.isBlocked;
    if (Number.isInteger(body.dailyImageLimit) && body.dailyImageLimit! >= 0) updates.daily_image_limit = body.dailyImageLimit!;
    if (Number.isInteger(body.monthlyImageLimit) && body.monthlyImageLimit! >= 0) updates.monthly_image_limit = body.monthlyImageLimit!;
    if (body.role !== undefined) {
      if (body.role !== "admin" && body.role !== "customer") {
        throw new ApiInputError("Role must be admin or customer.");
      }
      updates.role = body.role;
    }

    if (!Object.keys(updates).length) {
      throw new ApiInputError("At least one user update is required.");
    }

    const admin = createAdminSupabaseClient();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
    }

    const { data: targetProfile, error: targetProfileError } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", body.userId)
      .maybeSingle<{ id: string; role: "customer" | "admin" }>();

    if (targetProfileError) throw targetProfileError;
    if (!targetProfile) {
      throw new ApiInputError("User profile was not found.");
    }

    if (updates.role === "customer" && targetProfile.role === "admin") {
      if (body.userId === auth.user.id) {
        throw new ApiInputError("You cannot remove your own admin access.");
      }

      const { count, error: adminCountError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (adminCountError) throw adminCountError;
      if ((count ?? 0) <= 1) {
        throw new ApiInputError("At least one admin must remain.");
      }
    }

    const { error } = await admin.from("profiles").update(updates).eq("id", body.userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "The user limits could not be updated.");
  }
}
