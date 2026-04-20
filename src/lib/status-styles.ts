import { BadgeProps } from "@/components/ui/badge";
import { StatementStatus, TemplateStatus } from "@/types";

type VariantRecord<T extends string | number | symbol> = Record<
  T,
  BadgeProps["variant"]
>;

export const statementStatusVariant: VariantRecord<StatementStatus> = {
  draft: "secondary",
  in_progress: "default",
  submitted: "accent",
  finalized: "warning",
  completed: "accent",
  locked: "outline",
  demo: "warning",
  demo_published: "accent",
};

export const statementStatusLabel: Record<StatementStatus, string> = {
  draft: "Draft",
  in_progress: "Collecting",
  submitted: "Review",
  finalized: "Final Review",
  completed: "Completed",
  locked: "Locked",
  demo: "Demo",
  demo_published: "Demo Published",
};

export const templateStatusVariant: VariantRecord<TemplateStatus> = {
  draft: "secondary",
  published: "accent",
  archived: "secondary",
};

export const templateStatusLabel: Record<TemplateStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
