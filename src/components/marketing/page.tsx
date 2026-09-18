"use client";

import { Check } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { BentoCard } from "@/components/marketing/bento";
import { CtaPair } from "@/components/marketing/cta-pair";
import { MarketingHeading } from "@/components/marketing/heading";
import { HeroGlow } from "@/components/marketing/hero-glow";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection } from "@/components/marketing/shell";
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
        "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2",
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
    <section className="relative isolate flex min-h-[70svh] flex-col items-center justify-center px-6 pb-20 pt-24 text-center sm:pt-32">
      <HeroGlow />
      <Reveal eager>
        <MarketingHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          titleTag="h1"
          titleClassName="text-4xl sm:text-6xl lg:text-7xl"
        />
      </Reveal>
      {children ? (
        <Reveal eager delay={140}>
          {children}
        </Reveal>
      ) : (
        <Reveal eager delay={140}>
          <CtaPair className="mt-10 justify-center" />
        </Reveal>
      )}
      {footer ? (
        <Reveal eager delay={200}>
          {footer}
        </Reveal>
      ) : null}
    </section>
  );
}

export function MarketingPageSection({
  id,
  eyebrow,
  title,
  description,
  titleTag,
  align = "center",
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
        <div className="rounded-[2rem] border border-primary/10 bg-primary/[0.03] px-6 py-16 text-center sm:px-12 sm:py-24">
          <MarketingHeading
            title={title}
            description={description}
            titleClassName="text-4xl sm:text-6xl"
          />
          <CtaPair className="mt-10 justify-center" />
          {children}
        </div>
      </Reveal>
    </MarketingSection>
  );
}

export function MarketingFeatureCard({
  label,
  icon,
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
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/40 text-brand">
          {icon}
        </div>
      ) : null}
      {label ? (
        <p className={cn("text-sm text-brand", icon && "mt-6")}>{label}</p>
      ) : null}
      <h3
        className={cn(
          "text-2xl leading-snug text-primary",
          icon ? "mt-6" : label ? "mt-4" : undefined,
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
