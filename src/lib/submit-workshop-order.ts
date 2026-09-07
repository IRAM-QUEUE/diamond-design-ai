import type { SupabaseClient } from "@supabase/supabase-js";
import { createDesignPdfBlob } from "@/lib/export-design";
import { maxOrderPdfBytes } from "@/lib/shop-order";
import { workshopOrdersBucket } from "@/lib/workshop-orders";
import type { CustomerContactDetails, DesignBrief, GeneratedConcept } from "@/types/design";

export type HandoffReceipt = { orderId: string; referenceId: string; submittedAt: string };
type PreparedOrder = HandoffReceipt & {
  submitted?: boolean; pdfUploaded?: boolean; pdfPath: string; uploadToken: string;
  imageUrl: string; customerContact: CustomerContactDetails; error?: string;
};

export async function submitWorkshopOrder(
  handoff: { concept: GeneratedConcept; brief: DesignBrief },
  supabase: SupabaseClient,
  getAccessToken: () => Promise<string>,
  onProgress: (message: string) => void
): Promise<HandoffReceipt> {
  async function call(body: object): Promise<PreparedOrder> {
    const token = await getAccessToken();
    if (!token) throw new Error("Sign in again before submitting your handover.");
    const response = await fetch("/api/workshop-orders", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const result = await response.json() as PreparedOrder;
    if (!response.ok) throw new Error(result.error || "The handover could not be submitted.");
    return result;
  }
  const contact = handoff.brief.customerContact!;
  onProgress("Saving your final image...");
  const order = await call({
    action: "prepare", imageId: handoff.concept.storedImageId ?? handoff.concept.id,
    imageUrl: handoff.concept.url, referenceId: handoff.brief.referenceId,
    customerName: contact.name, customerMobile: contact.mobile
  });
  if (order.submitted) return order;
  if (!order.pdfUploaded) {
    onProgress("Preparing your handover PDF...");
    const pdf = await createDesignPdfBlob({
      concept: { ...handoff.concept, url: order.imageUrl },
      brief: { ...handoff.brief, customerContact: order.customerContact }
    });
    if (pdf.size > maxOrderPdfBytes) throw new Error("The handover PDF is too large to submit.");
    onProgress("Uploading your handover PDF...");
    const { error } = await supabase.storage.from(workshopOrdersBucket).uploadToSignedUrl(order.pdfPath, order.uploadToken, pdf, { contentType: "application/pdf" });
    if (error && String(error.statusCode) !== "409" && !/already exists/i.test(error.message)) throw new Error("The PDF could not be uploaded. Please retry; your handover will not be duplicated.");
  }
  onProgress("Submitting to the shop...");
  const result = await call({ action: "submit", orderId: order.orderId });
  if (!result.submitted) throw new Error("Submission was not confirmed. Please retry.");
  return result;
}
