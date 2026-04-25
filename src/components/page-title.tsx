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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {subtitle && (
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            {subtitle}
          </p>
        )}
        <TitleTag className="text-2xl leading-tight font-display font-medium text-primary sm:text-3xl">
          {title}
        </TitleTag>
        {description && (
          <p className="mt-2 text-muted-foreground sm:max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          {actions.map((action, idx) => (
            <React.Fragment key={idx}>
              {action.href ? (
                <Button
                  asChild
                  className="w-full sm:w-auto"
                  variant={action.variant}
                  disabled={action.disabled}
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button
                  className="w-full sm:w-auto"
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
