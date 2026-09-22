"use client";

import { Check } from "@/components/icons";
import type { ElementType, ReactNode } from "react";

import { BentoCard } from "@/components/marketing/bento";
import { CtaPair } from "@/components/marketing/cta-pair";
import { MarketingHeading } from "@/components/marketing/heading";
import { Reveal } from "@/components/marketing/reveal";
import { HeroGlow } from "@/components/marketing/hero-glow";
import { MarketingSection, MarketingShell } from "@/components/marketing/shell";
import { cn } from "@/lib/utils";

export function MarketingPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "marketing-grain relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MarketingPageHero({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="relative pb-8 pt-16 sm:pt-24">
      <HeroGlow />
      <MarketingShell className="relative">
        <Reveal eager>
          <MarketingHeading
            eyebrow={eyebrow}
            title={title}
            description={description}
            titleTag="h1"
            titleClassName="text-4xl sm:text-6xl"
          />
        </Reveal>
        {children ? (
          <Reveal eager>{children}</Reveal>
        ) : (
          <Reveal eager>
            <CtaPair className="mt-10" />
          </Reveal>
        )}
        {footer ? <Reveal eager>{footer}</Reveal> : null}
      </MarketingShell>
    </section>
  );
}

export function MarketingPageSection({
  id,
  eyebrow,
  title,
  description,
  titleTag,
  align = "left",
  children,
  className,
  headingClassName,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  titleTag?: ElementType;
  align?: "center" | "left";
  children?: ReactNode;
  className?: string;
  headingClassName?: string;
}) {
  return (
    <MarketingSection id={id} className={className}>
      {title ? (
        <Reveal>
          <MarketingHeading
            eyebrow={eyebrow}
            title={title}
            description={description}
            titleTag={titleTag}
            align={align}
            className={headingClassName}
          />
        </Reveal>
      ) : null}
      {children ? (
        <div className={title ? "mt-14" : undefined}>{children}</div>
      ) : null}
    </MarketingSection>
  );
}

export function MarketingPageCta({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <MarketingSection>
      <Reveal>
        <div className="rounded-[2rem] border border-primary/10 bg-primary/[0.03] px-6 py-16 sm:px-12 sm:py-20">
          <MarketingHeading
            title={title}
            description={description}
            titleClassName="text-4xl sm:text-5xl"
          />
          <CtaPair className="mt-10" />
          {children}
        </div>
      </Reveal>
    </MarketingSection>
  );
}

export function MarketingFeatureCard({
  label,
  title,
  body,
  className,
  children,
}: {
  label?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <BentoCard className={cn("flex h-full flex-col p-8 sm:p-10", className)}>
      {label ? <p className="font-display text-lg italic text-brand">{label}</p> : null}
      <h3
        className={cn(
          "text-2xl leading-snug text-primary",
          label ? "mt-3" : undefined,
        )}
      >
        {title}
      </h3>
      {body ? (
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
      ) : null}
      {children}
    </BentoCard>
  );
}

export function MarketingCheckList({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
