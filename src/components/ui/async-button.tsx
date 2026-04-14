"use client";

import React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useFormContext, useFormState } from "react-hook-form";

export type AsyncButtonProps = Omit<ButtonProps, "onClick"> & {
  pendingText?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
};

const AsyncButtonBase = React.forwardRef<
  HTMLButtonElement,
  AsyncButtonProps & { isLoading?: boolean }
>(
  (
    {
      onClick,
      disabled,
      pendingText,
      children,
      isLoading: externalLoading,
      ...props
    },
    ref,
  ) => {
    const [internalLoading, setInternalLoading] = React.useState(false);
    const isLoading = externalLoading || internalLoading;

    const handleClick = React.useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) {
          event.preventDefault();
          return;
        }
        if (!onClick) return;
        setInternalLoading(true);
        try {
          await onClick(event);
        } finally {
          setInternalLoading(false);
        }
      },
      [onClick, disabled, isLoading],
    );

    const content = isLoading && pendingText ? pendingText : children;

    return (
      <Button
        ref={ref}
        {...props}
        disabled={disabled || isLoading}
        onClick={onClick ? handleClick : undefined}
        aria-busy={isLoading || undefined}
      >
        {content}
      </Button>
    );
  },
);
AsyncButtonBase.displayName = "AsyncButtonBase";

const AsyncButtonWithForm = React.forwardRef<
  HTMLButtonElement,
  AsyncButtonProps & { formContext: ReturnType<typeof useFormContext> }
>(({ formContext, ...props }, ref) => {
  const { isSubmitting } = useFormState({ control: formContext.control });
  return <AsyncButtonBase ref={ref} {...props} isLoading={isSubmitting} />;
});
AsyncButtonWithForm.displayName = "AsyncButtonWithForm";

const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (props, ref) => {
    const formContext = useFormContext();

    if (formContext && props.type === "submit") {
      return (
        <AsyncButtonWithForm ref={ref} formContext={formContext} {...props} />
      );
    }

    return <AsyncButtonBase ref={ref} {...props} />;
  },
);
AsyncButton.displayName = "AsyncButton";

export { AsyncButton };
