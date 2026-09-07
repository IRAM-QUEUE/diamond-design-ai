export const shopOrderFilesBucket = "shop-order-files";
export const maxOrderPdfBytes = 15 * 1024 * 1024;

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function orderPdfPath(orderId: string) {
  return `${orderId}/handover.pdf`;
}

// Generated images must use the preserved source, never silently fall back to a watermark.
export function orderSourcePath(storagePath: string | null, userId: string) {
  if (!storagePath?.startsWith(`users/${userId}/sessions/`)) return null;
  if (storagePath.includes("/images/")) return storagePath.replace("/images/", "/sources/");
  if (storagePath.includes("/uploads/")) return storagePath;
  return null;
}

export function gmailDraftUrl(email: string, messageId?: string) {
  const url = new URL("https://mail.google.com/mail/u/");
  url.searchParams.set("authuser", email);
  url.hash = messageId ? `drafts?compose=${encodeURIComponent(messageId)}` : "drafts";
  return url.toString();
}
