import * as React from "react";

import { cn } from "@/lib/utils";

function formatDelimitedFieldValue(
  value: string[] | null,
  separator: "newline" | "comma",
) {
  if (!value || value.length === 0) {
    return "";
  }

  return value.join(separator === "comma" ? ", " : "\n");
}

function parseDelimitedFieldValue(
  value: string,
  separator: "newline" | "comma",
) {
  const next = value
    .split(separator === "comma" ? "," : "\n")
    .map((item) => item.trim())
    .filter(Boolean);

  return next.length > 0 ? next : null;
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-15 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

type DelimitedTextareaFieldProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange" | "onBlur"
> & {
  value: string[] | null;
  separator?: "newline" | "comma";
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onCommit: (next: string[] | null) => void;
};
function DelimitedTextareaField({
  value,
  separator = "newline",
  onCommit,
  ...props
}: DelimitedTextareaFieldProps) {
  const [draft, setDraft] = React.useState(() =>
    formatDelimitedFieldValue(value, separator),
  );

  React.useEffect(() => {
    setDraft(formatDelimitedFieldValue(value, separator));
  }, [separator, value]);

  const commit = () => {
    onCommit(parseDelimitedFieldValue(draft, separator));
  };

  return (
    <Textarea
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      {...props}
    />
  );
}

export { DelimitedTextareaField, Textarea };
