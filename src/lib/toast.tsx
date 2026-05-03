"use client";

import React from "react";
import {
  CASEY_TOASTER_ID,
  PromiseToast,
  PromptToast,
  Toast,
  type ToastVariant,
} from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalToast as SonnerExternalToast,
  toast as sonnerToast,
} from "sonner";

const TOAST_SHOWN = "__caseyToastShown";

export function getToastErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function hasToastBeenShown(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as { [TOAST_SHOWN]?: boolean })[TOAST_SHOWN],
  );
}

type ConfirmToastOptions = {
  variant?: ToastVariant;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PromptToastOptions = {
  variant?: ToastVariant;
  description?: React.ReactNode;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  action?: {
    label: string;
    callback?: (message: string | null) => void;
  };
  cancel?: {
    label: string;
    callback?: () => void;
  };
};

type ExternalToast = Omit<
  SonnerExternalToast,
  | "cancelButtonStyle"
  | "actionButtonStyle"
  | "style"
  | "unstyled"
  | "className"
  | "classNames"
  | "descriptionClassName"
  | "richColors"
  | "invert"
  | "closeButton"
> & { children?: React.ReactNode | (() => React.ReactNode) };

function toastFor(variant: ToastVariant) {
  return function (
    message: React.ReactNode | (() => React.ReactNode),
    {
      action,
      cancel,
      description,
      icon,
      dismissible,
      children,
      ...data
    }: ExternalToast = {},
  ) {
    return sonnerToast.custom(
      (id) => {
        return (
          <Toast
            variant={variant}
            id={id}
            message={message}
            description={description}
            icon={icon}
            dismissible={dismissible}
            action={action}
            cancel={cancel}
          >
            {typeof children === "function" ? children() : children}
          </Toast>
        );
      },
      { ...data, toasterId: CASEY_TOASTER_ID },
    );
  };
}

export const toast = {
  ...sonnerToast,
  default: toastFor("default"),
  loading: toastFor("loading"),
  success: toastFor("success"),
  error: toastFor("error"),
  warning: toastFor("warning"),
  info: toastFor("info"),
  errorFromUnknown: function (error: unknown, fallback: string) {
    this.error(getToastErrorMessage(error, fallback));
    if (error && typeof error === "object") {
      Object.defineProperty(error, TOAST_SHOWN, {
        value: true,
        configurable: true,
      });
    }
  },
  confirm: function (
    message: React.ReactNode,
    {
      variant = "warning",
      description,
      confirmLabel = "Continue",
      cancelLabel = "Cancel",
    }: ConfirmToastOptions = {},
  ) {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (confirmed: boolean) => {
        if (settled) return;
        settled = true;
        sonnerToast.dismiss(id);
        resolve(confirmed);
      };

      const id = this[variant]?.(message, {
        description,
        duration: Infinity,
        action: {
          label: confirmLabel,
          onClick: () => finish(true),
        },
        cancel: {
          label: cancelLabel,
          onClick: () => finish(false),
        },
        onDismiss: () => finish(false),
        onAutoClose: () => finish(false),
      });
    });
  },
  prompt: function (message: React.ReactNode, opts: PromptToastOptions = {}) {
    return new Promise<
      | { status: "cancelled"; message: null }
      | { status: "confirmed"; message: string }
    >((resolve) => {
      let settled = false;
      const finish = (status: "cancelled" | "confirmed", message?: string) => {
        if (settled) return;
        settled = true;
        sonnerToast.dismiss(id);
        if (status === "cancelled") {
          resolve({ status, message: null });
        } else {
          resolve({ status, message: message ?? "" });
        }
      };

      const id = sonnerToast.custom(
        (id) => (
          <PromptToast id={id} message={message} finish={finish} {...opts} />
        ),
        {
          onDismiss: () => finish("cancelled"),
          onAutoClose: () => finish("cancelled"),
          duration: Infinity,
          toasterId: CASEY_TOASTER_ID,
        },
      );
    });
  },
  promise: function <T>(
    promise: Promise<T> | (() => Promise<T>),
    {
      loading,
      success,
      error,
      ...data
    }: Omit<
      ExternalToast,
      | "icon"
      | "message"
      | "description"
      | "action"
      | "cancel"
      | "duration"
      | "dismissible"
    > & {
      loading: React.ReactNode | (() => React.ReactNode);
      success: React.ReactNode | (() => React.ReactNode);
      error: React.ReactNode | (() => React.ReactNode);
    },
  ) {
    return sonnerToast.custom(
      (id) => {
        return (
          <PromiseToast
            id={id}
            promise={typeof promise === "function" ? promise() : promise}
            loading={loading}
            success={success}
            error={error}
          />
        );
      },
      { ...data, toasterId: CASEY_TOASTER_ID },
    );
  },
};
