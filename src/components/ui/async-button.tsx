"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useFormContext } from "react-hook-form";

export type AsyncButtonProps = Omit<ButtonProps, "onClick"> & {
  pendingText?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
};

const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ onClick, disabled, pendingText, children, ...props }, ref) => {
    const [isPending, setIsPending] = React.useState(false);
    const formContext = useFormContext();

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isPending) {
        event.preventDefault();
        return;
      }

      if (!onClick) {
        return;
      }

      setIsPending(true);
      try {
        await onClick(event);
      } finally {
        setIsPending(false);
      }
    };

    // Use form's isSubmitting state if available and this is a submit button
    const isFormSubmitting =
      formContext?.formState?.isSubmitting && props.type === "submit";
    const isLoading = isPending || isFormSubmitting;
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

AsyncButton.displayName = "AsyncButton";

export { AsyncButton };
