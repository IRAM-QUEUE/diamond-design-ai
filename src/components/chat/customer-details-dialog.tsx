"use client";

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useEffect, useRef, useState } from "react";
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
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!concept) return;
    setName(initialContact?.name ?? "");
    setMobile(initialContact?.mobile ?? "");
    setValidationError("");
  }, [concept, initialContact?.mobile, initialContact?.name]);

  function submitCustomerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
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
      <DialogContent className="handoff-dialog flex max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0" showCloseButton={!isSubmitting}
        onOpenAutoFocus={(event) => {
          if (window.matchMedia("(max-width: 767px)").matches) {
            event.preventDefault();
            titleRef.current?.focus();
          }
        }}>
        <DialogHeader className="shrink-0 border-b p-4 pe-14 sm:p-5 sm:pe-14">
          <DialogTitle className="text-xl sm:text-2xl" ref={titleRef} tabIndex={-1}>{isShopHandoff ? "Confirm shop handover" : "Customer Details for the Brief"}</DialogTitle>
          <DialogDescription className="handoff-description">
            {isShopHandoff ? "Confirm your details to submit the handover PDF and final image directly to the shop." : "Enter the customer name and mobile number. The signed-in email is added automatically to the workshop PDF."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={submitCustomerDetails}>
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
            {concept ? (
              <div className="flex items-center gap-3 rounded-2xl border border-diamond-champagne/15 bg-black/30 p-3">
                <img src={concept.url} alt={concept.variationName} onError={onImageError} className="h-16 w-16 shrink-0 rounded-lg object-contain sm:h-24 sm:w-24" />
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-white">
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
          </div>
          <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-3 border-t bg-[#10100f] p-4 sm:p-5">
            <Button className="min-h-11 px-4" type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button className="h-auto min-h-11 min-w-0 whitespace-normal px-3 py-2" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isShopHandoff ? <Store className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {isSubmitting ? "Preparing..." : isShopHandoff ? "Confirm handover" : "Prepare Brief"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
