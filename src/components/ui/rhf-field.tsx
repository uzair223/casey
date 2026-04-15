"use client";

import type { ReactNode } from "react";
import {
  Controller,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
  type UseFormReturn,
} from "react-hook-form";
import { Label } from "@/components/ui/label";

type RhfDomControlValue = string | number | readonly string[] | undefined;

type RhfFieldControlProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Pick<
  ControllerRenderProps<TFieldValues, TName>,
  "name" | "onBlur" | "onChange" | "ref"
> & {
  value: RhfDomControlValue;
};

type RhfFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  form: UseFormReturn<TFieldValues>;
  name: TName;
  controlId?: string;
  label: ReactNode;
  registerOptions?: RegisterOptions<TFieldValues, TName>;
  renderControl: (
    registration: RhfFieldControlProps<TFieldValues, TName>,
    required: boolean,
  ) => ReactNode;
};

function hasRequiredRule<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(options?: RegisterOptions<TFieldValues, TName>) {
  if (!options || options.required === undefined) {
    return false;
  }

  if (typeof options.required === "boolean") {
    return options.required;
  }

  return true;
}

function toDomControlValue(value: unknown): RhfDomControlValue {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return String(value);
}

export function RhfField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  form,
  name,
  controlId,
  label,
  registerOptions,
  renderControl,
}: RhfFieldProps<TFieldValues, TName>) {
  const required = hasRequiredRule(registerOptions);

  return (
    <Controller
      control={form.control}
      name={name}
      rules={registerOptions}
      render={({ field, fieldState }) => {
        const registration: RhfFieldControlProps<TFieldValues, TName> = {
          name: field.name,
          onBlur: field.onBlur,
          onChange: field.onChange,
          ref: field.ref,
          value: toDomControlValue(field.value),
        };
        const message = fieldState.error?.message
          ? String(fieldState.error.message)
          : "";

        return (
          <div className="flex flex-col gap-1">
            {renderControl(registration, required)}
            {message ? (
              <p className="text-xs text-destructive">{message}</p>
            ) : null}
            <Label
              className="order-first"
              htmlFor={controlId || registration.name}
            >
              {label}
            </Label>
          </div>
        );
      }}
    />
  );
}
