"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-sm", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, style, ...props }, ref) => {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const contentRef = React.useCallback((element: HTMLDivElement | null) => {
    setNode(element);
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }, [ref]);

  React.useLayoutEffect(() => {
    if (!node) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      // Preserve browser pinch zoom. Keyboard resizing normally stays at scale 1.
      if (viewport && viewport.scale > 1.05) return;
      node.style.setProperty("--dialog-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      node.style.setProperty("--dialog-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      node.dataset.compact = String((viewport?.height ?? window.innerHeight) < 480);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [node]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        className={cn(
          "fixed left-1/2 z-50 grid min-h-0 min-w-0 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-[1.5rem] bg-[#10100f] p-4 sm:p-6 shadow-[inset_0_1px_0_rgba(215,196,154,0.12),0_34px_120px_rgba(0,0,0,0.55)]",
          className
        )}
        style={{
          top: "calc(var(--dialog-viewport-top, 0px) + var(--dialog-viewport-height, 100dvh) / 2)",
          maxHeight: "calc(var(--dialog-viewport-height, 100dvh) - max(1rem, env(safe-area-inset-top)) - max(1rem, env(safe-area-inset-bottom)))",
          ...style
        }}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close asChild>
            <Button className="absolute end-4 top-4" size="icon" variant="ghost" aria-label="Close dialog">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex min-w-0 flex-col space-y-2 pe-8 text-start", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("font-display text-2xl font-medium text-white", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
};
