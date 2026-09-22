import { cn } from "@/lib/utils";

type BentoCardProps = {
  className?: string;
  children: React.ReactNode;
};

export function BentoCard({ className, children }: BentoCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoMedia({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
