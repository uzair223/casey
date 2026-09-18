import { cn } from "@/lib/utils";

export function HeroGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 -bottom-1/3 top-0 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_0%,#000_58%,transparent)]",
        className,
      )}
    >
      <div className="hero-ring-glow" />
      <div className="hero-ring" />
    </div>
  );
}
