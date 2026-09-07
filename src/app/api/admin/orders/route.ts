import { NextResponse } from "next/server";
import { ApiInputError, handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { isUuid } from "@/lib/shop-order";
import { orderStatuses, workshopOrdersBucket, workshopPdfPath, workshopImagePath } from "@/lib/workshop-orders";
import { createAdminSupabaseClient } from "@/services/supabase/admin";

export const runtime = "nodejs";
const fields = "id,reference_id,customer_name,customer_mobile,customer_email,image_name,status,submitted_at";
async function authorize(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== "admin" || auth.profile.is_blocked) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return auth;
}
const json = (data: unknown) => NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof NextResponse) return auth;
    const admin = createAdminSupabaseClient()!;
    const params = new URL(request.url).searchParams;
    const id = params.get("orderId");
    if (id !== null) {
      if (!isUuid(id)) throw new ApiInputError("A valid order is required.");
      const order = await admin.from("shop_orders").select(fields).eq("id", id).neq("status", "preparing").maybeSingle();
      if (order.error) throw order.error;
      if (!order.data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const storage = admin.storage.from(workshopOrdersBucket);
      const [pdf, image, preview] = await Promise.all([
        storage.createSignedUrl(workshopPdfPath(id), 300, { download: `${order.data.reference_id}-handover.pdf` }),
        storage.createSignedUrl(workshopImagePath(id), 300, { download: `${order.data.reference_id}-final-image.png` }),
        storage.createSignedUrl(workshopImagePath(id), 300)
      ]);
      if (pdf.error || image.error || preview.error) throw pdf.error || image.error || preview.error;
      return json({ order: order.data, pdfUrl: pdf.data.signedUrl, imageUrl: image.data.signedUrl, previewUrl: preview.data.signedUrl });
    }
    const page = Number(params.get("page") ?? "0");
    if (!Number.isInteger(page) || page < 0 || page > 100000) throw new ApiInputError("Invalid page.");
    const status = params.get("status") ?? "all";
    if (status !== "all" && !orderStatuses.some((value) => value === status)) throw new ApiInputError("Invalid order status.");
    let query = admin.from("shop_orders").select(fields, { count: "exact" }).neq("status", "preparing");
    if (status !== "all") query = query.eq("status", status);
    const result = await query.order("submitted_at", { ascending: false }).order("id", { ascending: false }).range(page * 20, page * 20 + 19);
    if (result.error) throw result.error;
    return json({ orders: result.data ?? [], total: result.count ?? 0 });
  } catch (error) {
    return handleApiError(error, "Orders could not be loaded.");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof NextResponse) return auth;
    const body = await parseJsonBody<{ orderId?: unknown; status?: unknown; expectedStatus?: unknown }>(request);
    if (!isUuid(body.orderId) || !orderStatuses.some((value) => value === body.status) || !orderStatuses.some((value) => value === body.expectedStatus)) throw new ApiInputError("Choose a valid order and status.");
    const updated = await createAdminSupabaseClient()!.from("shop_orders")
      .update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.orderId)
      .eq("status", body.expectedStatus).select(fields).maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return NextResponse.json({ error: "This order changed or is no longer available. Refresh and try again." }, { status: 409 });
    return json({ order: updated.data });
  } catch (error) {
    return handleApiError(error, "Order status could not be saved.");
  }
}
