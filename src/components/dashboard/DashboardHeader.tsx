import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  role: string;
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    href: string;
    variant?: "default" | "outline";
  }>;
}

export function DashboardHeader({
  role,
  title,
  description,
  actions = [],
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          {role}
        </p>
        <h1 className="text-3xl font-semibold text-primary">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <Button key={action.href} asChild variant={action.variant}>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
