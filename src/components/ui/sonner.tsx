"use client";

import { useTheme } from "next-themes";
import { Action, Toaster as Sonner, toast as sonnerToast } from "sonner";
import { Card, CardDescription, CardProps, CardTitle } from "./card";
import { cn } from "@/lib/utils";
import React from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "./button";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const CASEY_TOASTER_ID = "casey-app-toaster";

export const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      id={CASEY_TOASTER_ID}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      {...props}
    />
  );
};

export type ToastVariant =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading";
type ToastProps = {
  variant?: ToastVariant;
  id: string | number;
  message: React.ReactNode | (() => React.ReactNode);
  description?: React.ReactNode | (() => React.ReactNode);
  icon?: React.ReactNode;
  dismissible?: boolean;
  action?: Action | React.ReactNode;
  cancel?: Action | React.ReactNode;
};

function isAction(obj: React.ReactNode | Action): obj is Action {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "onClick" in obj &&
    "label" in obj
  );
}

const VARIANTS_CARD: Record<ToastVariant, CardProps["variant"]> = {
  default: "default",
  loading: "default",
  success: "accent",
  error: "destructive",
  warning: "warning",
  info: "secondary",
};

export const Toast = ({
  variant,
  id,
  message,
  description,
  icon,
  dismissible = true,
  action,
  cancel,
}: ToastProps) => {
  const iconProps = {
    strokeWidth: 3,
    width: 18,
    height: 18,
    className: "shrink-0",
  };
  const VARIANTS_ICON: Record<ToastVariant, React.ReactNode> = {
    default: null,
    success: <CircleCheck {...iconProps} />,
    error: <CircleAlert {...iconProps} />,
    warning: <TriangleAlert {...iconProps} />,
    info: <Info {...iconProps} />,
    loading: <Loader2 {...iconProps} className="animate-spin" />,
  };
  const hasActions = !!action || !!cancel;
  return (
    <Card
      size={null}
      variant={VARIANTS_CARD[variant ?? "default"]}
      className={cn(
        `relative toast toast-${variant} rounded-md! w-80`,
        "[--card-padding:calc(var(--spacing)*3)_calc(var(--spacing)*3)] [--card-opacity:100%]",
        "transition slide-in-from-top-2",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-full group-hover:translate-x-0",
      )}
    >
      {dismissible && (
        <button
          className="absolute top-2 right-2 opacity-50 transition hover:opacity-80 cursor-pointer"
          onClick={() => sonnerToast.dismiss(id)}
        >
          <X width={12} height={12} />
        </button>
      )}

      <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-3 gap-y-2 p-(--card-padding)">
        {/* Icon aligned with content only */}
        <div className="row-start-1 row-end-2 self-center pt-0.5">
          {icon ?? VARIANTS_ICON[variant ?? "default"]}
        </div>

        {/* Content */}
        <div className="row-start-1 row-end-2 min-w-0">
          <CardTitle className="text-sm">
            {typeof message === "function" ? message() : message}
          </CardTitle>

          {description && (
            <CardDescription className="text-inherit mt-1">
              {typeof description === "function" ? description() : description}
            </CardDescription>
          )}
        </div>

        {/* Actions (separate row, does NOT affect icon alignment) */}
        {hasActions && (
          <div className="col-start-2 row-start-2 flex gap-1">
            {isAction(action) ? (
              <Button
                variant="outline"
                className="bg-background/10"
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : (
              action
            )}

            {isAction(cancel) ? (
              <Button
                variant="outline"
                className="bg-background/10"
                size="sm"
                onClick={cancel.onClick}
              >
                {cancel.label}
              </Button>
            ) : (
              cancel
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

type PromiseToastProps<T> = {
  promise: Promise<T>;
} & Omit<
  ToastProps,
  "variant" | "icon" | "message" | "description" | "dismissible"
> & {
    loading: React.ReactNode | (() => React.ReactNode);
    success: React.ReactNode | (() => React.ReactNode);
    error: React.ReactNode | (() => React.ReactNode);
  };

export function PromiseToast<T>({
  promise,
  loading,
  success,
  error,
  ...props
}: PromiseToastProps<T>) {
  const [state, setState] = React.useState<"loading" | "success" | "error">(
    "loading",
  );

  React.useEffect(() => {
    let isMounted = true;
    promise
      .then(() => {
        if (isMounted) setState("success");
      })
      .catch(() => {
        if (isMounted) setState("error");
      });
    return () => {
      isMounted = false;
    };
  }, [promise]);

  const content =
    state === "loading"
      ? typeof loading === "function"
        ? loading()
        : loading
      : state === "success"
        ? typeof success === "function"
          ? success()
          : success
        : typeof error === "function"
          ? error()
          : error;

  return <Toast {...props} message={content} dismissible={false} />;
}
