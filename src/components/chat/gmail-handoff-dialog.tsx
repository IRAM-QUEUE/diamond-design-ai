"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Mail } from "lucide-react";
import { publicEnv } from "@/config/public-env";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDesignPdfBlob } from "@/lib/export-design";
import { maxOrderPdfBytes, shopOrderFilesBucket } from "@/lib/shop-order";
import type { DesignBrief, GeneratedConcept } from "@/types/design";

type GoogleToken = { access_token?: string; expires_in?: number; error?: string };
type GoogleOAuth = { accounts: { oauth2: { initTokenClient: (options: {
  client_id: string; scope: string; hint: string;
  callback: (response: GoogleToken) => void;
  error_callback: () => void;
}) => { requestAccessToken: (options: { prompt: string }) => void } } } };
let googleScriptPromise: Promise<void> | null = null;
function loadGoogleIdentity() {
  googleScriptPromise ??= new Promise<void>((resolve, reject) => {
    if ((window as Window & { google?: GoogleOAuth }).google?.accounts.oauth2) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { googleScriptPromise = null; script.remove(); reject(new Error("Google sign-in could not be loaded. Please reopen this dialog.")); };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export function GmailHandoffDialog({ handoff, onClose }: {
  handoff: { concept: GeneratedConcept; brief: DesignBrief } | null;
  onClose: () => void;
}) {
  const { user, supabase, getAccessToken } = useAuth();
  const [googleReady, setGoogleReady] = useState(false);
  const [token, setToken] = useState<{ value: string; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [gmailUrl, setGmailUrl] = useState("");
  const [ready, setReady] = useState(false);
  const busyRef = useRef(false);
  const clientId = publicEnv.googleClientId;

  useEffect(() => { setToken(null); }, [user?.id]);
  useEffect(() => {
    setError(""); setStatus(""); setGmailUrl(""); setReady(false);
    if (!handoff || !clientId) return;
    let active = true;
    void loadGoogleIdentity().then(() => { if (active) setGoogleReady(true); }).catch((issue: Error) => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, [handoff, clientId]);

  function connectGmail() {
    if (busyRef.current || !googleReady || !clientId || !user?.email) return;
    const google = (window as Window & { google?: GoogleOAuth }).google;
    if (!google) return;
    busyRef.current = true; setBusy(true); setError(""); setStatus("Waiting for Google permission...");
    const finish = () => { busyRef.current = false; setBusy(false); setStatus(""); };
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email https://www.googleapis.com/auth/gmail.compose",
      hint: user.email,
      callback: (response) => {
        finish();
        if (response.error || !response.access_token) { setError("Gmail permission was not granted. Connect Gmail to continue."); return; }
        setToken({ value: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 - 60_000 });
        setStatus("Gmail connected. You can now prepare your draft.");
      },
      error_callback: () => { finish(); setError("Google sign-in was closed or blocked. Please try connecting again."); }
    });
    client.requestAccessToken({ prompt: "" });
  }

  async function prepareDraft() {
    if (!handoff || !supabase || busyRef.current || !token || token.expiresAt <= Date.now()) {
      if (token && token.expiresAt <= Date.now()) setToken(null);
      return;
    }
    busyRef.current = true; setBusy(true); setError(""); setGmailUrl(""); setStatus("Preparing your order...");
    // Reserve a tab during the click so browser popup blocking does not interrupt a completed draft.
    const gmailWindow = window.open("about:blank", "_blank");
    if (gmailWindow) {
      gmailWindow.opener = null;
      gmailWindow.document.title = "Preparing New Order";
      gmailWindow.document.body.textContent = "Preparing your Gmail draft with the handover PDF and final image...";
    }
    try {
      const authToken = await getAccessToken();
      const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", "X-Gmail-Token": token.value };
      const contact = handoff.brief.customerContact!;
      const prepared = await fetch("/api/shop-orders", { method: "POST", headers, body: JSON.stringify({
        action: "prepare", imageId: handoff.concept.storedImageId ?? handoff.concept.id,
        imageUrl: handoff.concept.url, referenceId: handoff.brief.referenceId,
        customerName: contact.name, customerMobile: contact.mobile
      }) });
      const order = await prepared.json();
      if (!prepared.ok) throw new Error(order.error || "The order could not be prepared.");
      if (!order.ready && !order.pdfUploaded) {
        setStatus("Preparing and uploading the handover PDF...");
        const pdf = await createDesignPdfBlob(handoff);
        if (pdf.size > maxOrderPdfBytes) throw new Error("The handover PDF is too large to attach.");
        const { error: uploadError } = await supabase.storage.from(shopOrderFilesBucket).uploadToSignedUrl(order.pdfPath, order.uploadToken, pdf, { contentType: "application/pdf" });
        // A concurrent attempt may already have completed this immutable upload.
        if (uploadError && String(uploadError.statusCode) !== "409" && !/already exists/i.test(uploadError.message)) throw new Error("The handover PDF could not be uploaded. Please try again.");
      }
      let result = order;
      if (!order.ready) {
        setStatus("Adding both attachments to your Gmail draft...");
        const response = await fetch("/api/shop-orders", { method: "POST", headers, body: JSON.stringify({ action: "create", orderId: order.orderId }) });
        result = await response.json();
        if (!response.ok) {
          if (result.code === "GMAIL_CONNECT_REQUIRED") setToken(null);
          if (result.gmailUrl) setGmailUrl(result.gmailUrl);
          throw new Error(result.error || "The Gmail draft could not be prepared.");
        }
      }
      setGmailUrl(result.gmailUrl); setReady(true); setStatus("Your draft is ready with both attachments. Review it in Gmail and click Send.");
      if (gmailWindow && !gmailWindow.closed) gmailWindow.location.replace(result.gmailUrl);
    } catch (issue) {
      gmailWindow?.close(); setStatus(""); setError(issue instanceof Error ? issue.message : "The draft could not be prepared.");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(handoff)} onOpenChange={(open) => { if (!open && !busyRef.current) onClose(); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Send to shop with Gmail</DialogTitle>
          <DialogDescription>Prepare a “New Order” draft in your Gmail account, addressed to the shop, with the handover PDF and final image without the app watermark. You review the draft and click Send in Gmail.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
          <p className="text-white">{user?.email}</p>
          <p className="mt-2">{handoff?.brief.referenceId}</p>
          <p className="mt-2">Attachments: handover PDF + final image</p>
        </div>
        {!clientId ? <p role="alert" className="text-sm text-diamond-champagne">Gmail draft preparation needs to be connected by the administrator first.</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive-foreground">{error}</p> : null}
        {status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
        {gmailUrl ? <Button asChild><a href={gmailUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{ready ? "Open Gmail draft" : "Check Gmail Drafts"}</a></Button> : null}
        {!ready ? <Button disabled={busy || !clientId || !googleReady} onClick={token && token.expiresAt > Date.now() ? () => void prepareDraft() : connectGmail}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {busy ? "Preparing..." : token && token.expiresAt > Date.now() ? "Prepare and open Gmail" : "Connect Gmail"}
        </Button> : null}
      </DialogContent>
    </Dialog>
  );
}
