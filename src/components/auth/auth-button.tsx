"use client";

import { FormEvent, useState } from "react";
import { ChevronDown, LogOut, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language";
import { useAuth } from "./auth-provider";

export function AuthButton() {
  const { user, isConfigured, isLoading, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setStatus("");
    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim());
      setStatus(t("Check your email for the magic sign-in link.", "تحقق من بريدك الإلكتروني للحصول على رابط الدخول."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("Sign-in email could not be sent.", "تعذر إرسال بريد تسجيل الدخول."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (isGoogleSubmitting) return;

    setStatus("");
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("Google sign-in could not be started.", "تعذر بدء تسجيل الدخول عبر Google."));
      setIsGoogleSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <Button variant="secondary" disabled>
        {t("Supabase not configured", "لم يتم إعداد Supabase")}
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden max-w-48 truncate text-sm text-muted-foreground 2xl:inline">{user.email}</span>
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          {t("Sign Out", "تسجيل الخروج")}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isLoading}>
          <Sparkles className="h-4 w-4" />
          {t("Sign In", "تسجيل الدخول")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-diamond-champagne/10 text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.18)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>{t("Enter your private studio", "ادخل الاستوديو الخاص بك")}</DialogTitle>
          <DialogDescription>
            {t(
              "Access your private design studio and save your diamond concepts.",
              "ادخل إلى استوديو التصميم الخاص بك واحفظ تصورات الألماس."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button className="h-12 w-full" onClick={() => void continueWithGoogle()} disabled={isGoogleSubmitting}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">G</span>
            {isGoogleSubmitting ? t("Opening Google...", "جارٍ فتح Google...") : t("Continue with Google", "المتابعة باستخدام Google")}
          </Button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl bg-white/[0.025] px-4 py-3 text-sm text-muted-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] transition hover:bg-white/[0.04] hover:text-diamond-pearl"
            onClick={() => setEmailOpen((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-diamond-champagne" />
              {t("Continue with Email", "المتابعة بالبريد الإلكتروني")}
            </span>
            <ChevronDown className={`h-4 w-4 transition ${emailOpen ? "rotate-180" : ""}`} />
          </button>

          {emailOpen ? (
            <form className="space-y-4 rounded-2xl bg-black/20 p-4 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)]" onSubmit={submit}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl bg-background/70 px-4 py-3 text-sm text-white outline-none placeholder:text-muted-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.10)] focus-visible:shadow-[0_0_0_3px_rgba(215,196,154,0.16)]"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t(
                  "Open the email link on the same device where you requested access.",
                  "افتح رابط البريد الإلكتروني على نفس الجهاز الذي طلبت منه الدخول."
                )}
              </p>
              <Button className="w-full" type="submit" variant="secondary" disabled={isSubmitting || !email.trim()}>
                {isSubmitting ? t("Sending Link...", "جارٍ إرسال الرابط...") : t("Send Magic Link", "إرسال رابط الدخول")}
              </Button>
            </form>
          ) : null}

          {status ? <p className="text-sm leading-6 text-muted-foreground">{status}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
