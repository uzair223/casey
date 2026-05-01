import Link from "next/link";
import { Button } from "@/components/ui/button";
import React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  className?: string;
  subtitleClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function PageTitle({
  subtitle,
  title,
  description,
  actions = [],
  titleTag: TitleTag = "h1",
  className,
  subtitleClassName,
  titleClassName,
  descriptionClassName,
}: PageTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {subtitle && (
          <p
            className={cn(
              "text-sm uppercase tracking-[0.2em] text-accent-foreground",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        )}
        <TitleTag
          className={cn(
            "text-2xl leading-tight font-display font-medium text-primary sm:text-3xl",
            titleClassName,
          )}
        >
          {title}
        </TitleTag>
        {description && (
          <p
            className={cn(
              "mt-2 text-muted-foreground sm:max-w-3xl",
              descriptionClassName,
            )}
          >
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
