"use client";

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useEffect, useState } from "react";
import { Check, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CustomerContactDetails, GeneratedConcept } from "@/types/design";

type HandoffIntent = "prepare_brief" | "send_to_shop";

export function CustomerDetailsDialog({
  concept,
  intent,
  email,
  initialContact,
  isSubmitting,
  progress,
  error,
  onOpenChange,
  onConfirm,
  onImageError
}: {
  concept: GeneratedConcept | null;
  intent: HandoffIntent;
  email: string;
  initialContact?: CustomerContactDetails;
  isSubmitting: boolean;
  progress: string;
  error: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (customerContact: CustomerContactDetails) => void;
  onImageError: () => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!concept) return;
    setName(initialContact?.name ?? "");
    setMobile(initialContact?.mobile ?? "");
    setValidationError("");
  }, [concept, initialContact?.mobile, initialContact?.name]);

  function submitCustomerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedMobile = mobile.trim();
    const digitCount = normalizedMobile.match(/\p{Number}/gu)?.length ?? 0;

    if (normalizedName.length < 2) {
      setValidationError("Enter the customer's full name.");
      return;
    }

    if (digitCount < 7 || digitCount > 15 || /[^\p{Number}\s+().-]/u.test(normalizedMobile)) {
      setValidationError("Enter a valid mobile number containing 7 to 15 digits.");
      return;
    }

    if (!email.trim()) {
      setValidationError("A signed-in email address is required.");
      return;
    }

    setValidationError("");
    onConfirm({ name: normalizedName, mobile: normalizedMobile, email: email.trim() });
  }

  const isShopHandoff = intent === "send_to_shop";

  return (
    <Dialog open={Boolean(concept)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>{isShopHandoff ? "Confirm shop handover" : "Customer Details for the Brief"}</DialogTitle>
          <DialogDescription>
            {isShopHandoff ? "Confirm your details to submit the handover PDF and final image directly to the shop." : "Enter the customer name and mobile number. The signed-in email is added automatically to the workshop PDF."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitCustomerDetails}>
          {concept ? (
            <div className="overflow-hidden rounded-2xl border border-diamond-champagne/15 bg-black/30">
              <img src={concept.url} alt={concept.variationName} onError={onImageError} className="h-40 w-full object-contain" />
              <div className="p-4">
                <p className="text-sm font-medium text-white">
                  V{concept.version} - {concept.variationName}
                </p>
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <p className="break-all text-sm text-muted-foreground">Email: {email}</p>
            <label className="block space-y-2 text-sm text-muted-foreground">
              <span>Customer name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={100}
                disabled={isSubmitting}
                className="w-full rounded-2xl border bg-background/70 px-4 py-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-diamond-champagne/50 disabled:opacity-60"
                placeholder="Enter the full name"
                autoFocus
              />
            </label>
            <label className="block space-y-2 text-sm text-muted-foreground">
              <span>Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                autoComplete="tel"
                maxLength={32}
                disabled={isSubmitting}
                className="w-full rounded-2xl border bg-background/70 px-4 py-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-diamond-champagne/50 disabled:opacity-60"
                placeholder="e.g. +20 10 1234 5678"
              />
            </label>
          </div>
          {validationError || error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground" role="alert">
              {validationError || error}
            </p>
          ) : null}
          {isSubmitting && progress ? <p role="status" className="text-sm text-muted-foreground">{progress}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isShopHandoff ? <Store className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {isSubmitting ? "Preparing..." : isShopHandoff ? "Confirm handover" : "Prepare Brief"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

