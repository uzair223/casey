import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("group rounded-xl border shadow", {
  variants: {
    variant: {
      default: "text-card-foreground bg-card/(--card-opacity)",
      secondary:
        "text-secondary-foreground border-secondary bg-secondary/(--card-opacity)",
      destructive:
        "text-destructive-foreground bg-destructive/(--card-opacity)",
      accent: "text-accent-foreground bg-accent/(--card-opacity)",
    },
    size: {
      lg: "card-lg",
      md: "card-md",
      sm: "card-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "lg",
  },
});

const CARD_PADDING =
  "group-[.card-lg]:p-6 group-[.card-md]:p-4 group-[.card-sm]:py-2 group-[.card-sm]:px-4";

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  opacity?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, opacity = 50, ...props }, ref) => {
    const style = {
      "--card-opacity": `${opacity}%`,
    } as React.CSSProperties;

    return (
      <div
        ref={ref}
        className={cardVariants({ className, variant, size })}
        style={style}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(CARD_PADDING, "flex flex-col space-y-1.5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_PADDING, "pt-0!", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(CARD_PADDING, "flex items-center pt-0! gap-2", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
