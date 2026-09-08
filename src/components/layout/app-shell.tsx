"use client";

import Image from "next/image";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isArabic, t } = useLanguage();

  return (
    <div className="min-h-dvh bg-[#050505]">
      <Sidebar />
      <div className={cn("flex min-h-dvh min-w-0 flex-col", isArabic ? "lg:pr-72" : "lg:pl-72")}>
        <Header />
        <main className="mx-auto min-w-0 w-full max-w-[1500px] flex-1 px-4 py-6 md:px-7 md:py-8">{children}</main>
        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-5 pt-1 md:px-7">
          <a
            href="https://queuesolutions.org/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-[0.72rem] text-muted-foreground transition hover:text-diamond-pearl"
          >
            <Image
              src="/queue-solutions-logo.png"
              alt="Queue Solutions logo"
              width={22}
              height={22}
              className="h-5 w-5 object-contain invert opacity-75"
            />
            <span>
              {t("This website was created by", "تم إنشاء هذا الموقع بواسطة")} <span className="font-medium text-diamond-pearl">Queue Solutions</span>
            </span>
          </a>
        </footer>
      </div>
    </div>
  );
}
