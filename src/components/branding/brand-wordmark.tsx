import { brand, brandDisplay } from "@/config/brand";
import { cn } from "@/lib/utils";

export function BrandWordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span role="img" dir="ltr" lang="en" aria-label={brand.name} className={cn("inline-flex shrink-0 flex-col items-center text-diamond-pearl", className)}>
      <span aria-hidden="true" className={cn(brandDisplay.className, "font-medium leading-[0.85] tracking-[0.16em]", compact ? "text-[1.25rem] min-[400px]:text-[1.65rem]" : "text-[2rem] sm:text-[2.7rem]")}>FORM</span>
      <span aria-hidden="true" className={cn("flex items-baseline text-diamond-champagne/85", compact ? "mt-1.5 gap-1 text-[0.5rem]" : "mt-2 gap-1.5 text-[0.6rem]")}>
        <span className={cn(brandDisplay.className, "text-[1.4em] italic leading-none")}>by</span>
        <span className="font-sans font-medium tracking-[0.25em]">MNG</span>
      </span>
    </span>
  );
}
