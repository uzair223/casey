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

export type RhfFieldControlProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Pick<
  ControllerRenderProps<TFieldValues, TName>,
  "name" | "onBlur" | "onChange" | "ref"
> & {
  value: RhfDomControlValue;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
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
        const id = controlId || field.name;
        const errorId = `${id}-error`;
        const message = fieldState.error?.message
          ? String(fieldState.error.message)
          : "";
        const registration: RhfFieldControlProps<TFieldValues, TName> = {
          name: field.name,
          onBlur: field.onBlur,
          onChange: field.onChange,
          ref: field.ref,
          value: toDomControlValue(field.value),
          "aria-invalid": fieldState.invalid || undefined,
          "aria-describedby": message ? errorId : undefined,
        };

        return (
          <div className="flex flex-col gap-1">
            {renderControl(registration, required)}
            {message ? (
              <p
                id={errorId}
                role="alert"
                className="text-xs text-destructive"
              >
                {message}
              </p>
            ) : null}
            <Label className="order-first" htmlFor={id}>
              {label}
            </Label>
          </div>
        );
      }}
    />
  );
}
