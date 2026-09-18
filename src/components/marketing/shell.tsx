import { cn } from "@/lib/utils";

export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1536px] px-6 sm:px-10 lg:px-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MarketingSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 lg:py-32", className)}>
      <MarketingShell>{children}</MarketingShell>
    </section>
  );
}
