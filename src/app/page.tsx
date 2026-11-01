/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { BrandWordmark } from "@/components/branding/brand-wordmark";
import { Button } from "@/components/ui/button";
import { brandDisplay } from "@/config/brand";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import styles from "./home.module.css";

export default function LandingPage() {
  const { isArabic, toggleLanguage, t } = useLanguage();
  const notes = [
    {
      title: t("A personal beginning", "بداية تعبّر عنك"),
      description: t("Share an idea, a story, or an image that speaks to you.", "شارك فكرة أو قصة أو صورة تحمل لك معنى.")
    },
    {
      title: t("Every detail, considered", "عناية بكل تفصيل"),
      description: t("Explore the stones, metal, and proportions that make it yours.", "اكتشف الأحجار والمعدن والتفاصيل التي تمنح قطعتك طابعها الخاص.")
    },
    {
      title: t("A vision to take further", "رؤية جاهزة للخطوة التالية"),
      description: t("Bring your chosen design and a clear brief to your jeweler.", "خذ تصميمك المختار وملخصه الواضح إلى صائغك.")
    }
  ];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" aria-label="FORM by MNG home" className={styles.brandLink}>
            <BrandWordmark />
          </Link>
          <nav aria-label={t("Studio navigation", "التنقل إلى الاستوديو")} className={styles.navigation}>
            <Button variant="ghost" size="sm" onClick={toggleLanguage} aria-label={t("Switch to Arabic", "التبديل إلى الإنجليزية")}>
              {isArabic ? "EN" : "عربي"}
            </Button>
            <span aria-hidden="true" className={styles.navigationDivider} />
            <Button asChild variant="outline" className={styles.enterButton}>
              <Link href="/chat">{t("Enter studio", "دخول الاستوديو")}</Link>
            </Button>
          </nav>
        </header>

        <section className={styles.hero} aria-labelledby="home-headline">
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{t("A private jewelry design studio", "استوديو خاص لتصميم المجوهرات")}</p>
            <h1 id="home-headline" className={cn(styles.headline, isArabic ? styles.arabicHeadline : brandDisplay.className)}>
              <span>{t("Your vision,", "رؤيتك،")}</span>
              <em>{t("beautifully formed.", "بصياغة تليق بك.")}</em>
            </h1>
            <p className={styles.description}>
              {t(
                "An idea, a reference, a detail you love. Explore diamond jewelry shaped around you, then take your design to your jeweler.",
                "فكرة، صورة مرجعية، أو تفصيل تحبه. اكتشف تصميماً ألماسياً يعبّر عنك، ثم خذ رؤيتك إلى صائغك."
              )}
            </p>
            <div className={styles.actions}>
              <Button asChild size="lg" className={styles.primaryAction}>
                <Link href="/chat">
                  {t("Start your design", "ابدأ تصميمك")}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Link href="/chat?mode=upload" className={styles.referenceAction}>
                <Upload aria-hidden="true" className="h-4 w-4" />
                {t("Bring a reference", "أضف صورة مرجعية")}
              </Link>
            </div>
            <p className={styles.signature}>{t("Imagined by you. Refined with AI.", "من خيالك، وبمساعدة الذكاء الاصطناعي.")}</p>
          </div>

          <figure className={styles.visual}>
            <div className={styles.imageFrame}>
              <img
                src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1400&q=85"
                alt={t("A diamond ring, seen in detail", "تفاصيل خاتم ألماسي")}
                width={1200}
                height={1200}
                fetchPriority="high"
                decoding="async"
                className={styles.image}
              />
              <div aria-hidden="true" className={styles.imageShade} />
            </div>
            <figcaption className={styles.caption}>
              <span>{t("An expression of you.", "قطعة تعبّر عنك.")}</span>
              <span aria-hidden="true" className={styles.captionLine} />
              <span className={styles.captionLabel}>{t("The art of personal design", "فن التصميم الشخصي")}</span>
            </figcaption>
          </figure>
        </section>

        <section aria-label={t("Your design journey", "رحلة تصميمك")} className={styles.notes}>
          {notes.map((note) => (
            <div key={note.title} className={styles.note}>
              <h2 className={cn(styles.noteTitle, !isArabic && brandDisplay.className)}>{note.title}</h2>
              <p>{note.description}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
