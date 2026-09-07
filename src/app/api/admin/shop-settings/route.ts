import { NextResponse } from "next/server";
import { ApiInputError, handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { isEmailAddress } from "@/lib/shop-order";
import { createAdminSupabaseClient } from "@/services/supabase/admin";

export const runtime = "nodejs";

async function authorize(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== "admin" || auth.profile.is_blocked) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return auth;
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof NextResponse) return auth;
    const admin = createAdminSupabaseClient()!;
    const { data, error } = await admin.from("shop_settings").select("recipient_email").eq("id", true).single();
    if (error) throw error;
    return NextResponse.json({
      recipientEmail: data.recipient_email
    });
  } catch (error) {
    return handleApiError(error, "Shop email settings could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof NextResponse) return auth;
    const body = await parseJsonBody<{ recipientEmail?: unknown }>(request);
    const email = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    if (!isEmailAddress(email)) throw new ApiInputError("Enter one valid shop email address.");
    const { error } = await createAdminSupabaseClient()!.from("shop_settings").upsert({
      id: true,
      recipient_email: email,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return NextResponse.json({ recipientEmail: email });
  } catch (error) {
    return handleApiError(error, "Shop email settings could not be saved.");
  }
}
