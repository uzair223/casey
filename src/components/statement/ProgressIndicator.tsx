"use client";

import { ProgressData } from "@/lib/types";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { Badge } from "../ui/badge";

interface ProgressIndicatorProps {
  progress: ProgressData;
  minStartProgress?: number;
  minCompletionProgress?: number;
}

export function ProgressIndicator({
  progress,
  minStartProgress = 20,
  minCompletionProgress = 70,
}: ProgressIndicatorProps) {
  // Use phases from config, sorted by order
  const phases = [...PERSONAL_INJURY_CONFIG.phases].sort(
    (a, b) => a.order - b.order,
  );

  // Count completed phases from phaseCompleteness
  const completed = phases.filter((phase) => {
    const phaseKey =
      `phase${phase.order}` as keyof typeof progress.phaseCompleteness;
    return progress.phaseCompleteness[phaseKey] >= minCompletionProgress;
  }).length;

  const total = phases.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {phases.map((phase) => {
        const phaseKey =
          `phase${phase.order}` as keyof typeof progress.phaseCompleteness;
        const completionPercent = progress.phaseCompleteness[phaseKey] || 0;
        const isCompleted = completionPercent >= minCompletionProgress;
        const isStarted = completionPercent >= minStartProgress;

        return (
          <Badge
            key={phase.id}
            title={`${phase.title}: ${completionPercent}%`}
            className="capitalize"
            variant={
              isCompleted ? "accent" : isStarted ? "secondary" : "outline"
            }
          >
            {isCompleted ? "✓" : "○"} {phase.title.split(" ")[0].toLowerCase()}
          </Badge>
        );
      })}
      <span className="text-xs px-2 py-1 text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}
