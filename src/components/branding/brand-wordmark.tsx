import { brand, brandWordmark } from "@/config/brand";
import { cn } from "@/lib/utils";

export function BrandWordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span role="img" dir="ltr" lang="en" aria-label={brand.name} className={cn("inline-grid shrink-0 justify-items-center text-diamond-pearl", className)}>
      <span aria-hidden="true" className={cn(brandWordmark.className, "font-medium leading-none tracking-[0.065em]", compact ? "text-[1.2rem] min-[400px]:text-[1.45rem]" : "text-[1.9rem] sm:text-[2.35rem]")}>FORM</span>
      <span aria-hidden="true" className={cn("relative block w-full text-center text-diamond-champagne", compact ? "mt-2" : "mt-3")}>
        <span className={cn(brandWordmark.className, "block font-semibold leading-none tracking-[0.22em] text-diamond-champagne/95", compact ? "text-[0.68rem]" : "text-[0.9rem]")}>MNG</span>
        <span className={cn("absolute top-[0.12em] font-sans font-normal uppercase leading-none tracking-[0.18em] text-diamond-champagne/55", compact ? "right-[calc(50%+1.35rem)] text-[0.38rem]" : "right-[calc(50%+1.75rem)] text-[0.46rem]")}>by</span>
      </span>
    </span>
  );
}
