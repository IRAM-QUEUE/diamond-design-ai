"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gem } from "lucide-react";
import { navigationItems } from "@/config/navigation";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { isArabic, t } = useLanguage();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 z-40 hidden w-72 bg-[#050505]/96 overflow-y-auto p-7 lg:block",
        isArabic ? "right-0 shadow-[inset_1px_0_0_rgba(215,196,154,0.08)]" : "left-0 shadow-[inset_-1px_0_0_rgba(215,196,154,0.08)]"
      )}
    >
      <Link href="/" className="block px-1 py-3">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.28),0_16px_34px_rgba(0,0,0,0.24)]">
          <Gem className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-3xl font-medium leading-none text-diamond-pearl">Maison DIA</p>
          <p className="mt-2 text-[0.68rem] uppercase tracking-[0.34em] text-diamond-champagne/70">{t("Private Atelier", "أتيليه خاص")}</p>
        </div>
      </Link>

      <div className="atelier-line my-10 h-px" />

      <nav className="space-y-1">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm text-muted-foreground transition duration-300 aria-[current=page]:bg-diamond-champagne/10 aria-[current=page]:text-diamond-pearl hover:bg-diamond-champagne/[0.08] hover:text-diamond-pearl"
          >
            <item.icon className="h-4 w-4 text-diamond-champagne/70" />
            {isArabic ? item.titleAr : item.title}
          </Link>
        ))}
      </nav>

    </aside>
  );
}
