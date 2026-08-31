"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Amiri,
  Cairo,
  Cinzel,
  Cormorant_Garamond,
  Dancing_Script,
  Great_Vibes,
  Lora,
  Montserrat,
  Noto_Kufi_Arabic,
  Noto_Naskh_Arabic,
  Reem_Kufi,
  Scheherazade_New
} from "next/font/google";
import { ArrowRight, Gem, LetterText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jewelryLetteringStyles } from "@/config/jewelry-lettering-styles";
import { cn } from "@/lib/utils";
import { jewelryFonts, type JewelryFontCategory } from "@/config/jewelry-fonts";

const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], display: "swap" });
const notoNaskhArabic = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["400", "600", "700"], display: "swap" });
const scheherazadeNew = Scheherazade_New({ subsets: ["arabic"], weight: ["400", "700"], display: "swap" });
const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700"], display: "swap" });
const notoKufiArabic = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["400", "600", "700"], display: "swap" });
const reemKufi = Reem_Kufi({ subsets: ["arabic"], weight: ["400", "600"], display: "swap" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });
const dancingScript = Dancing_Script({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const lora = Lora({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

const fontClassById: Record<string, string> = {
  amiri: amiri.className,
  "noto-naskh-arabic": notoNaskhArabic.className,
  "scheherazade-new": scheherazadeNew.className,
  cairo: cairo.className,
  "noto-kufi-arabic": notoKufiArabic.className,
  "reem-kufi": reemKufi.className,
  "great-vibes": greatVibes.className,
  "dancing-script": dancingScript.className,
  "cormorant-garamond": cormorantGaramond.className,
  cinzel: cinzel.className,
  montserrat: montserrat.className,
  lora: lora.className
};

const categories: JewelryFontCategory[] = [
  "Arabic Elegant",
  "Arabic Modern",
  "English Script",
  "English Luxury Serif",
  "Minimal / Modern"
];

export default function FontsPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#0c0c0b] p-6 shadow-[inset_0_1px_0_rgba(215,196,154,0.14),0_30px_100px_rgba(0,0,0,0.42)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(215,196,154,0.14),transparent_26rem)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/[0.035] px-4 py-2 text-xs uppercase tracking-[0.24em] text-diamond-champagne/75 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.10)]">
              <LetterText className="h-3.5 w-3.5" />
              Fonts &amp; Styles for personalized jewelry
            </div>
            <h1 className="font-display text-4xl font-medium leading-tight text-diamond-pearl md:text-5xl">
              Choose the letterforms and the way they become jewelry.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Pair a curated Arabic or Latin font with a jewelry construction style for name pendants, bracelets, rings,
              and engraved pieces. Each selection becomes part of the agent&apos;s design direction.
            </p>
          </div>
          <div className="rounded-2xl bg-diamond-champagne/10 p-4 text-sm leading-6 text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.18)] lg:max-w-sm">
            For Arabic names, provide the exact Arabic spelling. The Arabic text is the source of truth; English transliteration
            is only a helper.
          </div>
        </div>
      </section>

      <section id="styles" className="space-y-5 scroll-mt-24">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <Gem className="h-4 w-4 text-diamond-champagne" />
            <h2 className="font-display text-3xl font-medium text-diamond-pearl">Styles</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
            Choose how the lettering is constructed as a physical piece—from flowing calligraphy to pavé or framed
            openwork. This choice is independent from the font.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jewelryLetteringStyles.map((style) => (
            <article
              key={style.id}
              className="group overflow-hidden rounded-[1.55rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] shadow-[inset_0_1px_0_rgba(215,196,154,0.10),0_24px_80px_rgba(0,0,0,0.34)]"
            >
              <div className="relative aspect-square overflow-hidden bg-[#080808]">
                <Image
                  src={style.previewImage}
                  alt={`${style.name} jewelry lettering style preview`}
                  fill
                  sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 bg-gradient-to-b from-black/70 to-transparent p-4 pb-10">
                  {style.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-black/55 px-3 py-1 text-xs text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.18)] backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <h3 className="font-display text-2xl font-medium text-diamond-pearl">{style.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{style.note}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {style.supportsArabic ? <span>Arabic</span> : null}
                  {style.supportsLatin ? <span>Latin</span> : null}
                </div>
                <Button asChild className="w-full">
                  <Link href={`/chat?letteringStyle=${encodeURIComponent(style.id)}`}>
                    <Sparkles className="h-4 w-4" />
                    Design with this style
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="fonts" className="scroll-mt-24 rounded-[1.6rem] bg-white/[0.025] p-5 shadow-[inset_0_0_0_1px_rgba(215,196,154,0.08)] md:p-6">
        <div className="flex items-center gap-3">
          <LetterText className="h-4 w-4 text-diamond-champagne" />
          <h2 className="font-display text-3xl font-medium text-diamond-pearl">Fonts</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          Choose the exact letterform family. The font controls the character shapes; the style above controls how those
          shapes are built into wearable jewelry.
        </p>
      </section>

      {categories.map((category) => {
        const fonts = jewelryFonts.filter((font) => font.category === category);
        return (
          <section key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <Gem className="h-4 w-4 text-diamond-champagne" />
              <h2 className="font-display text-3xl font-medium text-diamond-pearl">{category}</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {fonts.map((font) => (
                <article
                  key={font.id}
                  className="group overflow-hidden rounded-[1.55rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] shadow-[inset_0_1px_0_rgba(215,196,154,0.10),0_24px_80px_rgba(0,0,0,0.34)]"
                >
                  <div className="relative min-h-64 overflow-hidden bg-[#080808] p-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(215,196,154,0.15),transparent_18rem)]" />
                    <div className="relative flex min-h-52 flex-col justify-between">
                      <div className="flex flex-wrap gap-2">
                        {font.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-black/45 px-3 py-1 text-xs text-diamond-champagne shadow-[inset_0_0_0_1px_rgba(215,196,154,0.14)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-3 py-6 text-center">
                        <p
                          dir={font.supportsArabic ? "rtl" : "ltr"}
                          className={cn(
                            "text-6xl leading-tight text-diamond-pearl md:text-7xl",
                            fontClassById[font.id]
                          )}
                        >
                          {font.supportsArabic ? font.arabicSample : font.latinSample}
                        </p>
                        <p
                          className={cn(
                            "text-3xl leading-tight text-diamond-champagne/85",
                            fontClassById[font.id]
                          )}
                        >
                          {font.supportsLatin ? font.latinSample : font.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <h3 className="font-display text-2xl font-medium text-diamond-pearl">{font.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{font.note}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {font.supportsArabic ? <span>Arabic</span> : null}
                      {font.supportsLatin ? <span>Latin</span> : null}
                    </div>
                    <Button asChild className="w-full">
                      <Link href={`/chat?font=${encodeURIComponent(font.id)}`}>
                        <Sparkles className="h-4 w-4" />
                        Design with this font
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
