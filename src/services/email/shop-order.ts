import { isEmailAddress } from "@/lib/shop-order";

export type OrderEmail = {
  id: string;
  recipient_email: string;
  customer_email: string;
  customer_name: string;
  customer_mobile: string;
  reference_id: string;
};

function encodePart(content: Buffer) {
  return content.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export function buildOrderMime(order: OrderEmail, pdf: Buffer, image: Buffer) {
  if (!isEmailAddress(order.customer_email) || !isEmailAddress(order.recipient_email)) throw new Error("Invalid order email address.");
  const boundary = `order_${order.id.replace(/[^a-z0-9]/gi, "")}`;
  const reference = order.reference_id.replace(/[^a-z0-9-]/gi, "");
  const text = ["New Order", `Reference: ${order.reference_id}`, `Customer: ${order.customer_name}`,
    `Email: ${order.customer_email}`, `Mobile: ${order.customer_mobile}`, "",
    "Attached: the workshop handover PDF and the chosen image without the app watermark."].join("\n");
  return [
    `From: ${order.customer_email}`, `To: ${order.recipient_email}`, "Subject: New Order",
    `Message-ID: <shop-order-${order.id}@diamond-design.invalid>`, "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", encodePart(Buffer.from(text)),
    `--${boundary}`, `Content-Type: application/pdf; name="${reference}-handover.pdf"`,
    `Content-Disposition: attachment; filename="${reference}-handover.pdf"`, "Content-Transfer-Encoding: base64", "", encodePart(pdf),
    `--${boundary}`, `Content-Type: image/png; name="${reference}-final-image.png"`,
    `Content-Disposition: attachment; filename="${reference}-final-image.png"`, "Content-Transfer-Encoding: base64", "", encodePart(image),
    `--${boundary}--`, ""
  ].join("\r\n");
}

export class GmailAccessError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

export async function verifyGmailAccess(token: string, expectedEmail: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers, signal: AbortSignal.timeout(10_000) });
  const account = await response.json() as { email?: string; email_verified?: boolean };
  if (!response.ok || !account.email_verified || account.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new GmailAccessError("Connect the Gmail account that matches your signed-in email.", "GMAIL_CONNECT_REQUIRED");
  }
  // Check permission and API availability without changing the mailbox.
  const access = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=1", { headers, signal: AbortSignal.timeout(10_000) });
  if (!access.ok) {
    const details = await access.json() as { error?: { details?: Array<{ reason?: string }> } };
    if (details.error?.details?.some((detail) => detail.reason === "SERVICE_DISABLED")) {
      throw new GmailAccessError("Gmail access needs to be enabled by the administrator before drafts can be prepared.", "GMAIL_SETUP_REQUIRED");
    }
    throw new GmailAccessError("Reconnect Gmail and allow draft access to continue.", "GMAIL_CONNECT_REQUIRED");
  }
}

export async function createGmailDraft(token: string, mime: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: Buffer.from(mime).toString("base64url") } }),
    signal: AbortSignal.timeout(25_000)
  });
  const result = await response.json() as { id?: string; message?: { id?: string } };
  if (!response.ok || !result.id || !result.message?.id) throw new Error("Gmail did not confirm the draft.");
  return { draftId: result.id, messageId: result.message.id };
}

export async function findGmailDraft(token: string, orderId: string) {
  const query = encodeURIComponent(`rfc822msgid:shop-order-${orderId}@diamond-design.invalid`);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts?q=${query}&maxResults=1`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("The Gmail draft status could not be checked.");
  const result = await response.json() as { drafts?: Array<{ id: string; message: { id: string } }> };
  return result.drafts?.[0];
}
