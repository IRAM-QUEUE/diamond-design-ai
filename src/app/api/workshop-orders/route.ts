import { NextResponse } from "next/server";
import sharp from "sharp";
import { ApiInputError, handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { requireRateLimit } from "@/lib/rate-limit";
import { isEmailAddress, isUuid, maxOrderPdfBytes, orderSourcePath, ownedDisplayStoragePath } from "@/lib/shop-order";
import { workshopOrdersBucket, workshopPdfPath, workshopImagePath, type WorkshopOrder } from "@/lib/workshop-orders";
import { createAdminSupabaseClient } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
type PendingOrder = Omit<WorkshopOrder, "status" | "submitted_at"> & {
  user_id: string; image_id: string; source_storage_path: string;
  status: "preparing" | WorkshopOrder["status"]; submitted_at: string | null;
};
type OrderBody = {
  action?: string; imageId?: unknown; imageUrl?: unknown; orderId?: unknown;
  referenceId?: unknown; customerName?: unknown; customerMobile?: unknown;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.profile.is_blocked) return NextResponse.json({ error: "Your account cannot submit handovers." }, { status: 403 });
    if (!isEmailAddress(auth.user.email)) throw new ApiInputError("A signed-in email address is required.");
    const rateLimit = requireRateLimit(auth.user.id, "/api/workshop-orders", 20);
    if (rateLimit) return rateLimit;
    const body = await parseJsonBody<OrderBody>(request);
    const admin = createAdminSupabaseClient()!;
    const storage = admin.storage.from(workshopOrdersBucket);

    if (body.action === "prepare") {
      if (!isUuid(body.imageId)) throw new ApiInputError("Choose a saved final image.");
      if (typeof body.referenceId !== "string" || !/^DIA-\d{4}-[A-Z0-9-]{1,48}$/i.test(body.referenceId)) throw new ApiInputError("A valid design reference is required.");
      const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
      const customerMobile = typeof body.customerMobile === "string" ? body.customerMobile.trim() : "";
      const digits = customerMobile.match(/\p{Number}/gu)?.length ?? 0;
      if (customerName.length < 2 || customerName.length > 100 || /[\r\n]/.test(customerName)) throw new ApiInputError("Enter the customer's full name.");
      if (customerMobile.length > 32 || digits < 7 || digits > 15 || /[^\p{Number}\s+().-]/u.test(customerMobile)) throw new ApiInputError("Enter a valid mobile number.");

      type SavedImage = { id: string; storage_path: string | null; variation_name: string | null };
      const selected = await admin.from("design_images").select("id,storage_path,variation_name")
        .eq("id", body.imageId).eq("user_id", auth.user.id).maybeSingle<SavedImage>();
      if (selected.error) throw selected.error;
      let image = selected.data;
      if (!image) {
        const displayPath = ownedDisplayStoragePath(body.imageUrl, auth.user.id, process.env.NEXT_PUBLIC_SUPABASE_URL);
        if (displayPath) {
          const recovered = await admin.from("design_images").select("id,storage_path,variation_name")
            .eq("storage_path", displayPath).eq("user_id", auth.user.id).maybeSingle<SavedImage>();
          if (recovered.error) throw recovered.error;
          image = recovered.data;
        }
      }
      if (!image) return NextResponse.json({ error: "The selected image was not found." }, { status: 404 });
      const existing = await admin.from("shop_orders").select("*").eq("user_id", auth.user.id)
        .eq("image_id", image.id).eq("reference_id", body.referenceId).maybeSingle<PendingOrder>();
      if (existing.error) throw existing.error;
      let order = existing.data;
      if (!order) {
        const sourcePath = orderSourcePath(image.storage_path, auth.user.id);
        if (!sourcePath) throw new ApiInputError("The original image is unavailable. Please choose a newly generated or uploaded image.");
        const inserted = await admin.from("shop_orders").insert({
          user_id: auth.user.id, image_id: image.id, reference_id: body.referenceId,
          customer_email: auth.user.email, customer_name: customerName, customer_mobile: customerMobile,
          image_name: image.variation_name || "Final design", source_storage_path: sourcePath
        }).select("*").single<PendingOrder>();
        if (inserted.error?.code === "23505") {
          const concurrent = await admin.from("shop_orders").select("*").eq("user_id", auth.user.id)
            .eq("image_id", image.id).eq("reference_id", body.referenceId).single<PendingOrder>();
          if (concurrent.error) throw concurrent.error;
          order = concurrent.data;
        } else {
          if (inserted.error) throw inserted.error;
          order = inserted.data;
        }
      }
      if (!order) throw new Error("Order could not be saved.");
      if (order.submitted_at) return receipt(order);

      const files = await storage.list(order.id, { limit: 10 });
      if (files.error) throw files.error;
      if (!files.data?.some((file) => file.name === "final-image.png")) {
        const source = await admin.storage.from("design-images").download(order.source_storage_path);
        if (source.error || !source.data) throw new ApiInputError("The original image without the app watermark is unavailable. Please choose a newly generated or uploaded image.");
        if (source.data.size > 25 * 1024 * 1024) throw new ApiInputError("The original image is too large to submit.");
        const bytes = await sharp(Buffer.from(await source.data.arrayBuffer())).png().toBuffer();
        const upload = await storage.upload(workshopImagePath(order.id), bytes, { contentType: "image/png", upsert: false });
        if (upload.error && !isAlreadyStored(upload.error)) throw upload.error;
      }
      // Use a fresh display URL for PDF rendering, including old wishlist links.
      const display = await admin.storage.from("design-images").createSignedUrl(image.storage_path!, 3600);
      if (display.error) throw display.error;
      const pdfUploaded = files.data?.some((file) => file.name === "handover.pdf") ?? false;
      let uploadToken: string | undefined;
      if (!pdfUploaded) {
        const signed = await storage.createSignedUploadUrl(workshopPdfPath(order.id), { upsert: false });
        if (signed.error) throw signed.error;
        uploadToken = signed.data.token;
      }
      return NextResponse.json({
        orderId: order.id, referenceId: order.reference_id, pdfUploaded,
        pdfPath: workshopPdfPath(order.id), uploadToken, imageUrl: display.data.signedUrl,
        customerContact: { name: order.customer_name, mobile: order.customer_mobile, email: order.customer_email }
      });
    }

    if (body.action !== "submit" || !isUuid(body.orderId)) throw new ApiInputError("A valid handover is required.");
    const selected = await admin.from("shop_orders").select("*").eq("id", body.orderId)
      .eq("user_id", auth.user.id).maybeSingle<PendingOrder>();
    if (selected.error) throw selected.error;
    const order = selected.data;
    if (!order) return NextResponse.json({ error: "Handover not found." }, { status: 404 });
    if (order.submitted_at) return receipt(order);
    const [pdf, image] = await Promise.all([
      storage.download(workshopPdfPath(order.id)), storage.download(workshopImagePath(order.id))
    ]);
    if (pdf.error || !pdf.data || image.error || !image.data) throw new ApiInputError("Both handover files must finish uploading. Please retry.");
    if (pdf.data.size > maxOrderPdfBytes || Buffer.from(await pdf.data.slice(0, 5).arrayBuffer()).toString() !== "%PDF-") throw new ApiInputError("A valid handover PDF is required.");
    const submittedAt = new Date().toISOString();
    const updated = await admin.from("shop_orders").update({ status: "new", submitted_at: submittedAt, updated_at: submittedAt })
      .eq("id", order.id).eq("status", "preparing").select("*").maybeSingle<PendingOrder>();
    if (updated.error) throw updated.error;
    if (updated.data) return receipt(updated.data);
    // A concurrent submit won. Return its receipt without resetting staff status.
    const concurrent = await admin.from("shop_orders").select("*").eq("id", order.id).eq("user_id", auth.user.id).single<PendingOrder>();
    if (concurrent.error || !concurrent.data?.submitted_at) throw concurrent.error || new Error("Submission was not confirmed.");
    return receipt(concurrent.data);
  } catch (error) {
    return handleApiError(error, "The handover could not be submitted. Please try again.");
  }
}

function receipt(order: PendingOrder) {
  return NextResponse.json({ submitted: true, orderId: order.id, referenceId: order.reference_id, submittedAt: order.submitted_at });
}
function isAlreadyStored(error: { message: string; statusCode?: string | number }) {
  return String(error.statusCode) === "409" || /already exists/i.test(error.message);
}
