export const publicEnv = {
  // Public OAuth identifier for the existing Diamond Design Google sign-in project.
  // Deployments using a different Google project can override it.
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "117527990586-g5k431amvi0lhpoi9531tjd86eqr9fll.apps.googleusercontent.com",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? ""
};

export function getPublicSiteUrl() {
  if (publicEnv.siteUrl) {
    return publicEnv.siteUrl.replace(/\/+$/g, "");
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/g, "");
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";
}
