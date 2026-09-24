import type { CSSProperties } from "react";

import { leadColorWithAlpha } from "@/lib/leads/schema";

export function SelectorChoice({
  children,
  primaryColor,
  textColor,
  onClick,
}: {
  children: string;
  primaryColor: string;
  textColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md border bg-transparent px-4 text-sm font-medium transition-colors hover:bg-[var(--choice-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={
        {
          color: textColor,
          borderColor: leadColorWithAlpha(textColor, 0.1),
          "--choice-hover": leadColorWithAlpha(primaryColor, 0.5),
        } as CSSProperties
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}
