"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DynamicFieldsEditorProps<T> = {
  title: string;
  description?: string;
  fields: T[];
  disabled?: boolean;
  addLabel?: string;
  renderSummary: (item: T, index: number) => ReactNode;
  renderDropdown: (item: T, index: number) => ReactNode;
  onAdd: () => void;
  onChange: (fields: T[]) => void;
};

export function DynamicFieldsEditor<T>({
  title,
  description,
  fields,
  disabled,
  addLabel = "Add field",
  renderSummary,
  renderDropdown,
  onAdd,
  onChange,
}: DynamicFieldsEditorProps<T>) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{fields.length}</Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onAdd}
          >
            {addLabel}
          </Button>
        </div>
      </div>

      {fields.map((field, index) => (
        <details
          key={`dynamic-field-${index}`}
          className="rounded-md border bg-muted/10"
        >
          <summary className="cursor-pointer list-none px-3 py-2">
            {renderSummary(field, index)}
          </summary>

          <div className="flex flex-col gap-2 border-t px-3 py-3">
            {renderDropdown(field, index)}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                onChange(fields.filter((_, i) => i !== index) as T[]);
              }}
            >
              Remove
            </Button>
          </div>
        </details>
      ))}
    </div>
  );
}
