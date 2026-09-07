"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ShopEmailSettings() {
  const { getAccessToken } = useAuth();
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        const response = await fetch("/api/admin/shop-settings", { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Shop email settings could not be loaded.");
        if (active) {
          setEmail(data.recipientEmail);
          setSavedEmail(data.recipientEmail);
        }
      } catch (issue) {
        if (active) setError(issue instanceof Error ? issue.message : "Shop email settings could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [getAccessToken]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/shop-settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The shop email could not be saved.");
      setEmail(data.recipientEmail);
      setSavedEmail(data.recipientEmail);
      setNotice("Shop email saved. New order drafts will use this address.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The shop email could not be saved.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-3"><Mail className="h-5 w-5" />Shop order email</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">Choose the shop email address for “New Order” drafts. Each draft includes the handover PDF and final image without the app watermark; the customer sends it from their own email app.</p>
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-2 text-sm text-muted-foreground">
            <span>Recipient email</span>
            <input type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setNotice(""); }} disabled={loading || saving} placeholder="orders@yourshop.com" className="w-full rounded-xl border bg-background/70 px-4 py-3 text-white outline-none focus:border-diamond-champagne/50 disabled:opacity-60" />
          </label>
          <Button type="submit" disabled={loading || saving || !email.trim() || email.trim() === savedEmail}>
            {loading || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Loading..." : saving ? "Saving..." : "Save email"}
          </Button>
        </form>
        {error ? <p role="alert" className="text-sm text-destructive-foreground">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-diamond-champagne">{notice}</p> : null}
      </CardContent>
    </Card>
  );
}
