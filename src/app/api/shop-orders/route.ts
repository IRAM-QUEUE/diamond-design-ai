import { NextResponse } from "next/server";
import sharp from "sharp";
import { ApiInputError, handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { requireRateLimit } from "@/lib/rate-limit";
import { isEmailAddress, isUuid, maxOrderPdfBytes, orderPdfPath, orderSourcePath, ownedDisplayStoragePath, shopOrderFilesBucket, gmailDraftUrl } from "@/lib/shop-order";
import { createAdminSupabaseClient } from "@/services/supabase/admin";
import { createGmailDraft, findGmailDraft, verifyGmailAccess, GmailAccessError, buildOrderMime, type OrderEmail } from "@/services/email/shop-order";

export const runtime = "nodejs";
export const maxDuration = 60;

type Order = OrderEmail & {
  user_id: string;
  image_id: string;
  source_storage_path: string;
  status: "pending" | "creating" | "ready" | "unknown";
  gmail_draft_id: string | null;
  gmail_message_id: string | null;
  created_at: string;
};
type OrderBody = {
  action?: "prepare" | "create";
  imageId?: unknown;
  imageUrl?: unknown;
  orderId?: unknown;
  referenceId?: unknown;
  customerName?: unknown;
  customerMobile?: unknown;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.profile.is_blocked) return NextResponse.json({ error: "Your account cannot prepare orders." }, { status: 403 });
    if (!isEmailAddress(auth.user.email)) throw new ApiInputError("A signed-in email address is required.");
    const rateLimit = requireRateLimit(auth.user.id, "/api/shop-orders", 10);
    if (rateLimit) return rateLimit;
    const body = await parseJsonBody<OrderBody>(request);
    const admin = createAdminSupabaseClient()!;

    if (body.action === "prepare") {
      if (!isUuid(body.imageId)) throw new ApiInputError("Choose a saved final image.");
      type SavedImage = { id: string; storage_path: string | null };
      const { data: savedImage, error: imageError } = await admin.from("design_images").select("id,storage_path")
        .eq("id", body.imageId).eq("user_id", auth.user.id).maybeSingle<SavedImage>();
      if (imageError) throw imageError;
      let image = savedImage;
      if (!image) {
        const displayPath = ownedDisplayStoragePath(body.imageUrl, auth.user.id, process.env.NEXT_PUBLIC_SUPABASE_URL);
        if (displayPath) {
          const recovered = await admin.from("design_images").select("id,storage_path")
            .eq("storage_path", displayPath).eq("user_id", auth.user.id).maybeSingle<SavedImage>();
          if (recovered.error) throw recovered.error;
          image = recovered.data;
        }
      }
      if (!image) return NextResponse.json({ error: "The selected image was not found." }, { status: 404 });
      const imageId = image.id;
      const { data: existing, error: existingError } = await admin.from("shop_order_drafts").select("*")
        .eq("user_id", auth.user.id).eq("image_id", imageId).maybeSingle<Order>();
      if (existingError) throw existingError;
      if (existing) return await prepareResponse(existing);

      const { data: settings, error: settingsError } = await admin.from("shop_settings").select("recipient_email").eq("id", true).single();
      if (settingsError) throw settingsError;
      if (!isEmailAddress(settings.recipient_email)) {
        return NextResponse.json({ error: "The administrator needs to save a shop recipient email before drafts can be prepared." }, { status: 503 });
      }
      const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
      const customerMobile = typeof body.customerMobile === "string" ? body.customerMobile.trim() : "";
      const digits = customerMobile.match(/\p{Number}/gu)?.length ?? 0;
      if (customerName.length < 2 || customerName.length > 100 || /[\r\n]/.test(customerName)) throw new ApiInputError("Enter the customer's full name.");
      if (customerMobile.length > 32 || digits < 7 || digits > 15 || /[^\p{Number}\s+().-]/u.test(customerMobile) || /[\r\n]/.test(customerMobile)) throw new ApiInputError("Enter a valid mobile number.");
      if (typeof body.referenceId !== "string" || !/^DIA-\d{4}-[A-Z0-9-]{1,48}$/i.test(body.referenceId)) throw new ApiInputError("A valid design reference is required.");

      const sourcePath = orderSourcePath(image.storage_path, auth.user.id);
      if (!sourcePath) throw new ApiInputError("The original image is unavailable. Please choose a newly generated or uploaded image.");
      // Check the original now, before creating an order or asking the browser to render its PDF.
      const { data: source, error: sourceError } = await admin.storage.from("design-images").download(sourcePath);
      if (sourceError || !source) throw new ApiInputError("The original image without the app watermark is unavailable. Please choose a newly generated or uploaded image.");

      const { data: inserted, error: insertError } = await admin.from("shop_order_drafts").insert({
        user_id: auth.user.id, image_id: imageId, reference_id: body.referenceId,
        recipient_email: settings.recipient_email, customer_email: auth.user.email,
        customer_name: customerName, customer_mobile: customerMobile, source_storage_path: sourcePath
      }).select("*").single<Order>();
      if (insertError?.code === "23505") {
        const { data: concurrent, error } = await admin.from("shop_order_drafts").select("*")
          .eq("user_id", auth.user.id).eq("image_id", imageId).single<Order>();
        if (error || !concurrent) throw error;
        return await prepareResponse(concurrent);
      }
      if (insertError || !inserted) throw insertError;
      return await prepareResponse(inserted);
    }

    if (body.action !== "create" || !isUuid(body.orderId)) throw new ApiInputError("A valid order is required.");
    const { data: order, error } = await admin.from("shop_order_drafts").select("*")
      .eq("id", body.orderId).eq("user_id", auth.user.id).maybeSingle<Order>();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "ready") return draftResponse(order);
    const gmailToken = request.headers.get("x-gmail-token") ?? "";
    if (!gmailToken || gmailToken.length > 4096) throw new GmailAccessError("Connect Gmail to prepare your draft.", "GMAIL_CONNECT_REQUIRED");
    await verifyGmailAccess(gmailToken, auth.user.email);
    if (order.status === "creating" || order.status === "unknown") {
      const existing = await findGmailDraft(gmailToken, order.id);
      if (existing) {
        const { error: saveError } = await admin.from("shop_order_drafts").update({ status: "ready", gmail_draft_id: existing.id, gmail_message_id: existing.message.id }).eq("id", order.id);
        if (saveError) throw saveError;
        return draftResponse({ ...order, gmail_message_id: existing.message.id });
      }
      return NextResponse.json({ error: "Gmail has not confirmed this draft yet. Check Gmail Drafts before trying again; we will not create a duplicate.", gmailUrl: gmailDraftUrl(order.customer_email) }, { status: 409 });
    }

    const [pdfResult, imageResult] = await Promise.all([
      admin.storage.from(shopOrderFilesBucket).download(orderPdfPath(order.id)),
      admin.storage.from("design-images").download(order.source_storage_path)
    ]);
    if (pdfResult.error || !pdfResult.data) throw new ApiInputError("The handover PDF has not finished uploading. Please retry.");
    if (imageResult.error || !imageResult.data) throw new ApiInputError("The original image is unavailable. The draft has not been created.");
    if (pdfResult.data.size > maxOrderPdfBytes) throw new ApiInputError("The PDF is too large to email.");
    const pdf = Buffer.from(await pdfResult.data.arrayBuffer());
    if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new ApiInputError("A valid handover PDF is required.");
    const image = await sharp(Buffer.from(await imageResult.data.arrayBuffer())).png().toBuffer();
    if (pdf.length + image.length > 25 * 1024 * 1024) throw new ApiInputError("The attachments are too large to email.");

    const { data: claimed, error: claimError } = await admin.from("shop_order_drafts").update({ status: "creating" })
      .eq("id", order.id).eq("status", "pending").select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return NextResponse.json({ error: "This draft is already being prepared. Please wait, then try again." }, { status: 409 });
    try {
      const draft = await createGmailDraft(gmailToken, buildOrderMime(order, pdf, image));
      const { error: savedError } = await admin.from("shop_order_drafts").update({ status: "ready", gmail_draft_id: draft.draftId, gmail_message_id: draft.messageId }).eq("id", order.id);
      if (savedError) throw savedError;
      return draftResponse({ ...order, gmail_message_id: draft.messageId });
    } catch {
      await admin.from("shop_order_drafts").update({ status: "unknown" }).eq("id", order.id).eq("status", "creating");
      return NextResponse.json({ error: "Gmail could not confirm the draft. Check Gmail Drafts or retry to check the same draft.", gmailUrl: gmailDraftUrl(order.customer_email) }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof GmailAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    return handleApiError(error, "The Gmail draft could not be prepared. Please try again.");
  }
}

function draftResponse(order: Order) {
  return NextResponse.json({ ready: true, orderId: order.id, gmailUrl: gmailDraftUrl(order.customer_email, order.gmail_message_id ?? undefined) });
}
async function prepareResponse(order: Order) {
  if (order.status === "ready") return draftResponse(order);
  const storage = createAdminSupabaseClient()!.storage.from(shopOrderFilesBucket);
  const pdfPath = orderPdfPath(order.id);
  const { data: files, error: listError } = await storage.list(order.id, { search: "handover.pdf", limit: 1 });
  if (listError) throw listError;
  if (files?.some((file) => file.name === "handover.pdf")) return NextResponse.json({ orderId: order.id, pdfUploaded: true });
  const { data, error } = await storage.createSignedUploadUrl(pdfPath, { upsert: false });
  if (error) throw error;
  return NextResponse.json({ orderId: order.id, pdfPath, uploadToken: data.token, pdfUploaded: false });
}
