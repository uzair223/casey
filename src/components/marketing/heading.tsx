import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type MarketingHeadingProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  titleTag?: ElementType;
  align?: "center" | "left";
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function MarketingHeading({
  eyebrow,
  title,
  description,
  titleTag: TitleTag = "h2",
  align = "center",
  className,
  titleClassName,
  descriptionClassName,
}: MarketingHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        centered ? "mx-auto max-w-4xl text-center" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-[14px] uppercase tracking-[0.15em] text-brand">
          {eyebrow}
        </p>
      ) : null}
      <TitleTag
        className={cn(
          "font-display text-[2.5rem] font-normal leading-[1.1] tracking-tight text-primary sm:text-5xl sm:leading-[1.1]",
          eyebrow && "mt-2",
          titleClassName,
        )}
      >
        {title}
      </TitleTag>
      {description ? (
        <p
          className={cn(
            "mt-6 text-lg leading-8 text-muted-foreground",
            centered && "mx-auto max-w-2xl",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
