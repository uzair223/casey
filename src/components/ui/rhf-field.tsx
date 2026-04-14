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

type RhfFieldControlProps<TName extends FieldPath<FieldValues>> = Pick<
  ControllerRenderProps<FieldValues, TName>,
  "name" | "onBlur" | "onChange" | "ref" | "value"
>;

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
    registration: RhfFieldControlProps<TName>,
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
        const registration: RhfFieldControlProps<TName> = {
          name: field.name as TName,
          onBlur: field.onBlur,
          onChange: field.onChange,
          ref: field.ref,
          value: field.value ?? "",
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
