import Link from "next/link";
import { Button } from "@/components/ui/button";
import React from "react";
import type { ReactNode } from "react";

type PageTitleAction = {
  label: ReactNode;
  href?: string;
  action?: () => void;
  variant?: "default" | "outline";
  disabled?: boolean;
};

type PageTitleProps = {
  subtitle?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: PageTitleAction[];
  titleTag?: React.ElementType;
};

export function PageTitle({
  subtitle,
  title,
  description,
  actions = [],
  titleTag: TitleTag = "h1",
}: PageTitleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        {subtitle && (
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            {subtitle}
          </p>
        )}
        <TitleTag className="text-3xl font-display font-medium text-primary">
          {title}
        </TitleTag>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action, idx) => (
            <React.Fragment key={idx}>
              {action.href ? (
                <Button
                  asChild
                  variant={action.variant}
                  disabled={action.disabled}
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button
                  onClick={action.action}
                  variant={action.variant}
                  disabled={action.disabled}
                >
                  {action.label}
                </Button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
