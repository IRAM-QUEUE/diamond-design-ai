"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Settings2, X } from "lucide-react";
import { imageModelOptions, getImageModelOption } from "@/config/image-model-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ImageModelPreference } from "@/types/design";

type AdvancedImageSettingsProps = {
  value: ImageModelPreference;
  onChange: (value: ImageModelPreference) => void;
  arabicOverride: boolean;
};

export function AdvancedImageSettings({ value, onChange, arabicOverride }: AdvancedImageSettingsProps) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const effectivePreference = arabicOverride ? "names_lettering" : value;
  const effectiveOption = getImageModelOption(effectivePreference);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 640px)");
    const closeHiddenPanel = () => {
      if (desktop.matches) setMobileOpen(false);
      else setDesktopOpen(false);
    };
    desktop.addEventListener("change", closeHiddenPanel);
    return () => desktop.removeEventListener("change", closeHiddenPanel);
  }, []);

  useEffect(() => {
    if (!desktopOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!desktopContainerRef.current?.contains(event.target as Node)) {
        setDesktopOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDesktopOpen(false);
        desktopTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [desktopOpen]);

  const triggerContent = (
    <>
      <Settings2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Advanced settings · {effectiveOption.name}</span>
    </>
  );

  return (
    <>
      <div ref={desktopContainerRef} className="relative hidden sm:block">
        <Button
          ref={desktopTriggerRef}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 max-w-full px-2.5 text-[0.7rem] text-diamond-smoke hover:text-diamond-pearl"
          aria-expanded={desktopOpen}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={() => setDesktopOpen((current) => !current)}
        >
          {triggerContent}
        </Button>

        {desktopOpen ? (
          <div
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${panelId}-title`}
            className="absolute bottom-[calc(100%+0.65rem)] start-0 z-40 max-h-[75dvh] w-[25rem] max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain rounded-[1.35rem] bg-[#11100f] p-4 shadow-[inset_0_1px_0_rgba(215,196,154,0.14),0_28px_90px_rgba(0,0,0,0.62)]"
          >
            <button
              type="button"
              aria-label="Close advanced settings"
              className="absolute end-3 top-3 rounded-full p-2 text-diamond-smoke transition hover:bg-white/5 hover:text-diamond-pearl focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(215,196,154,0.18)]"
              onClick={() => setDesktopOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <SettingsPanel
              headingId={`${panelId}-title`}
              value={value}
              onChange={onChange}
              arabicOverride={arabicOverride}
            />
          </div>
        ) : null}
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 max-w-full px-2.5 text-[0.7rem] text-diamond-smoke hover:text-diamond-pearl sm:hidden"
            aria-expanded={mobileOpen}
          >
            {triggerContent}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:hidden">
          <SettingsPanel value={value} onChange={onChange} arabicOverride={arabicOverride} dialogHeading />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SettingsPanel({
  headingId,
  value,
  onChange,
  arabicOverride,
  dialogHeading = false
}: {
  headingId?: string;
  value: ImageModelPreference;
  onChange: (value: ImageModelPreference) => void;
  arabicOverride: boolean;
  dialogHeading?: boolean;
}) {
  const effectivePreference = arabicOverride ? "names_lettering" : value;

  return (
    <div>
      <div className="pe-10">
        {dialogHeading ? (
          <>
            <DialogTitle className="text-xl">Image model</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5">
              Your selection is used for both new images and edits.
            </DialogDescription>
          </>
        ) : (
          <>
            <h2 id={headingId} className="font-display text-xl font-medium text-diamond-pearl">
              Image model
            </h2>
            <p className="mt-1 text-xs leading-5 text-diamond-smoke">
              Your selection is used for both new images and edits.
            </p>
          </>
        )}
      </div>

      {arabicOverride ? (
        <p className="mt-3 rounded-xl bg-diamond-champagne/[0.08] px-3 py-2 text-xs leading-5 text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.16)]">
          Arabic lettering detected. Names &amp; Lettering will be used automatically for improved text accuracy.
        </p>
      ) : null}

      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Image model">
        {imageModelOptions.map((option) => {
          const selected = option.preference === effectivePreference;
          return (
            <button
              key={option.preference}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={arabicOverride}
              className={cn(
                "w-full rounded-xl p-3 text-left transition focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(215,196,154,0.18)] disabled:cursor-not-allowed disabled:opacity-65",
                selected
                  ? "bg-diamond-champagne/[0.09] shadow-[inset_0_0_0_1px_rgba(215,196,154,0.32)]"
                  : "bg-black/25 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] hover:bg-white/[0.035]"
              )}
              onClick={() => onChange(option.preference)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-diamond-pearl">{option.name}</span>
                    <span className="rounded-full bg-white/[0.045] px-2 py-0.5 text-[0.62rem] text-diamond-champagne/80">
                      {option.badge}
                    </span>
                  </span>
                  <span className="mt-1 block text-[0.72rem] leading-5 text-diamond-smoke">{option.description}</span>
                  <span className="mt-1 block text-[0.68rem] font-medium uppercase tracking-[0.12em] text-diamond-champagne/65">
                    {option.modelLabel}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-diamond-champagne bg-diamond-champagne text-black"
                      : "border-diamond-champagne/25 text-transparent"
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
