"use client";

import { toast as sonnerToast } from "sonner";

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

function errorFromUnknown(error: unknown, fallback: string) {
  sonnerToast.error(getToastErrorMessage(error, fallback));
  if (error && typeof error === "object") {
    Object.defineProperty(error, TOAST_SHOWN, {
      value: true,
      configurable: true,
    });
  }
}

type ConfirmToastOptions = {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

function confirm(
  message: string,
  {
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

    const id = sonnerToast.warning(message, {
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
}

export const toast = {
  ...sonnerToast,
  confirm,
  errorFromUnknown,
};
