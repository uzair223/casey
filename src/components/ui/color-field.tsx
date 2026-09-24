"use client";

import type { ChangeEvent, Ref } from "react";

import { Input } from "@/components/ui/input";
import { leadHexColor } from "@/lib/leads/schema";

type ColorFieldProps = {
  id: string;
  value?: string | number | readonly string[];
  fallback: string;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
  onChange?: (...event: unknown[]) => void;
  ref?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  hexAriaLabel?: string;
};

function toColorString(value: ColorFieldProps["value"]) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function ColorField({
  id,
  value,
  fallback,
  disabled,
  name,
  onBlur,
  onChange,
  ref,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  hexAriaLabel,
}: ColorFieldProps) {
  const text = toColorString(value);
  const pickerValue = leadHexColor(text, fallback);

  const setColor = (next: string) => {
    onChange?.(next);
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="color"
        className="h-9 w-14 shrink-0 p-1"
        value={pickerValue}
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setColor(event.target.value);
        }}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      <Input
        value={text}
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setColor(event.target.value);
        }}
        ref={ref}
        aria-label={hexAriaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}
