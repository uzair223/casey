"use client";

import type { ReactNode } from "react";
import {
  get,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
  type UseFormRegisterReturn,
  type UseFormReturn,
} from "react-hook-form";
import { Label } from "@/components/ui/label";

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
    registration: UseFormRegisterReturn<TName>,
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
  const registration = form.register(name, registerOptions);
  const required = hasRequiredRule(registerOptions);
  const fieldError = get(form.formState.errors, name);
  const message = fieldError?.message ? String(fieldError.message) : "";

  return (
    <div className="flex flex-col gap-1">
      {renderControl(registration, required)}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
      <Label className="order-first" htmlFor={controlId || registration.name}>
        {label}
      </Label>
    </div>
  );
}
