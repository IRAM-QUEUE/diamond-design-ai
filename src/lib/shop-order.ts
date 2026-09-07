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

// Recover older references that only retained their display URL. The URL is a
// lookup hint, never a fetch target; the database must also confirm ownership.
export function ownedDisplayStoragePath(imageUrl: unknown, userId: string, supabaseUrl: string | undefined) {
  if (typeof imageUrl !== "string" || !supabaseUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const match = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/design-images\/(.+)$/);
    const path = match?.[1];
    if (!path?.startsWith(`users/${userId}/sessions/`)) return null;
    if (!/^users\/[^/]+\/sessions\/[^/]+\/(?:images|uploads)\/[^/]+$/.test(path)) return null;
    if (path.split("/").some((part) => part === "." || part === ".." || part.includes("\\"))) return null;
    if ([...path].some((character) => character.charCodeAt(0) < 32)) return null;
    return path;
  } catch {
    return null;
  }
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
