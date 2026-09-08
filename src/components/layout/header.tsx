"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gem, Menu, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { navigationItems } from "@/config/navigation";
import { AuthButton } from "@/components/auth/auth-button";
import { useAuth } from "@/components/auth/auth-provider";
import { useLanguage } from "@/lib/language";
import { clearDiamondSession } from "@/lib/session-store";

export function Header() {
  const { isArabic, toggleLanguage, t } = useLanguage();
  const { supabase, user } = useAuth();
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobileNavigation = () => { if (desktop.matches) setNavigationOpen(false); };
    desktop.addEventListener("change", closeMobileNavigation);
    return () => desktop.removeEventListener("change", closeMobileNavigation);
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setIsAdmin(false);
      return;
    }

    let mounted = true;
    void supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: "customer" | "admin" }>()
      .then(({ data }) => {
        if (mounted) setIsAdmin(data?.role === "admin");
      });

    return () => {
      mounted = false;
    };
  }, [supabase, user]);

  function startNewDesign() {
    clearDiamondSession(user?.id);
    window.location.assign(`/chat?newDesign=${Date.now()}`);
  }

  return (
    <header className="sticky top-0 z-30 bg-[#050505]/82 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 w-full flex-wrap py-3 max-w-[1500px] items-center justify-between gap-2 px-4 md:px-7">
        <div className="flex min-w-0 items-center gap-1 lg:hidden">
          <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("Navigation", "التنقل")}</DialogTitle>
                <DialogDescription className="sr-only">{t("Choose a page in your design studio.", "اختر صفحة في استوديو التصميم.")}</DialogDescription>
              </DialogHeader>
              <nav className="grid gap-2 pt-2">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={() => setNavigationOpen(false)}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 text-sm text-muted-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] transition aria-[current=page]:text-diamond-champagne hover:bg-white/[0.07] hover:text-white"
                  >
                    <item.icon className="h-4 w-4" />
                    {isArabic ? item.titleAr : item.title}
                  </Link>
                ))}
                {isAdmin ? <Link href="/admin" onClick={() => setNavigationOpen(false)} aria-current={pathname === "/admin" ? "page" : undefined} className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 text-sm text-muted-foreground"><Shield className="h-4 w-4" />{t("Admin Dashboard", "لوحة الإدارة")}</Link> : null}
                <Button variant="secondary" className="min-h-11" onClick={startNewDesign}>{t("New Chat", "محادثة جديدة")}</Button>
              </nav>
            </DialogContent>
          </Dialog>
          <Link href="/" aria-label="Maison DIA home" className="flex items-center gap-2 font-semibold text-white">
            <Gem className="h-5 w-5 text-diamond-champagne" />
            <span className="font-display hidden text-xl font-medium min-[400px]:inline">Maison DIA</span>
          </Link>
        </div>
        <div className="hidden min-w-0 flex-1 items-center rounded-full bg-white/[0.035] px-5 py-3 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] xl:flex xl:max-w-md">
          <Sparkles className="h-4 w-4 text-diamond-champagne/70 ltr:mr-3 rtl:ml-3" />
          <span className="truncate text-sm">{t("Private diamond design studio", "استوديو خاص لتصميم المجوهرات")}</span>
        </div>
        <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={toggleLanguage} aria-label={t("Switch to Arabic", "التبديل إلى الإنجليزية")}>
            {isArabic ? "EN" : "عربي"}
          </Button>
          <Button asChild variant="secondary" className="hidden lg:inline-flex">
            <Link href="/gallery">{t("My Wishlist", "قائمة أمنياتي")}</Link>
          </Button>
          {isAdmin ? (
            <Button asChild variant="secondary" className="hidden lg:inline-flex">
              <Link href="/admin">{t("Admin Dashboard", "لوحة الإدارة")}</Link>
            </Button>
          ) : null}
          <Button className="hidden lg:inline-flex" onClick={startNewDesign}>
            {t("New Chat", "محادثة جديدة")}
          </Button>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
