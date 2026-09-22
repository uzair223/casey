import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  eager?: boolean;
};

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: RevealProps) {
  return <Tag className={cn(className)}>{children}</Tag>;
}
