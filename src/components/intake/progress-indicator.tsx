"use client";

import { useWitnessStatement } from "@/components/intake/intake-context";
import { Badge } from "../ui/badge";
import type { MetadataProgress } from "@/types/common";

type ProgressIndicatorProps = {
  progress: MetadataProgress;
  minStartProgress?: number;
  minCompletionProgress?: number;
};

export function ProgressIndicator({
  progress,
  minStartProgress = 10,
  minCompletionProgress = 70,
}: ProgressIndicatorProps) {
  const {
    data: {
      statement: {
        statement_config: { phases },
      },
    },
  } = useWitnessStatement();

  const currentPhaseIndex = phases.findIndex(
    (phase) => phase.id === progress.currentPhase,
  );
  const sliceMin = Math.max(0, currentPhaseIndex - 2);
  const sliceMax = Math.min(phases.length, sliceMin + 4);

  // Count completed phases from phaseCompleteness
  const completed = phases.filter((phase) => {
    const phaseKey = phase.id as keyof typeof progress.phaseCompleteness;
    return progress.phaseCompleteness[phaseKey] >= minCompletionProgress;
  }).length;

  const total = phases.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {phases.map((phase, index) => {
        const phaseKey = phase.id as keyof typeof progress.phaseCompleteness;
        const completionPercent = progress.phaseCompleteness[phaseKey] || 0;
        const isCompleted = completionPercent >= minCompletionProgress;
        const isCurrentPhase = progress.currentPhase === phase.id;
        const isStarted =
          isCurrentPhase || completionPercent >= minStartProgress;

        return index >= sliceMin && index < sliceMax ? (
          <Badge
            key={phase.id}
            title={`${phase.title}: ${completionPercent}%`}
            className="capitalize select-none"
            variant={
              isCompleted ? "accent" : isStarted ? "secondary" : "outline"
            }
            style={{
              opacity: Math.pow(
                1 - Math.abs(index - Math.max(0, currentPhaseIndex)) / 5,
                2,
              ),
            }}
          >
            {isCompleted ? "✓" : "○"} {phase.title}
          </Badge>
        ) : null;
      })}
      <span className="text-xs px-2 py-1 text-muted-foreground select-none">
        {completed + 1}/{total}
      </span>
    </div>
  );
}
