import { brand, brandWordmark } from "@/config/brand";
import { cn } from "@/lib/utils";

export function BrandWordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span role="img" dir="ltr" lang="en" aria-label={brand.name} className={cn("inline-flex shrink-0 flex-col items-center text-diamond-pearl", className)}>
      <span aria-hidden="true" className={cn(brandWordmark.className, "font-medium leading-none tracking-[0.1em]", compact ? "text-[1.2rem] min-[400px]:text-[1.5rem]" : "text-[1.9rem] sm:text-[2.4rem]")}>FORM</span>
      <span aria-hidden="true" className={cn("flex items-baseline text-diamond-champagne", compact ? "mt-1.5 gap-1.5" : "mt-2.5 gap-2")}>
        <span className={cn("font-sans font-normal uppercase tracking-[0.14em] text-diamond-champagne/70", compact ? "text-[0.45rem]" : "text-[0.55rem]")}>by</span>
        <span className={cn(brandWordmark.className, "font-semibold leading-none tracking-[0.16em]", compact ? "text-[0.65rem]" : "text-[0.95rem]")}>MNG</span>
      </span>
    </span>
  );
}
