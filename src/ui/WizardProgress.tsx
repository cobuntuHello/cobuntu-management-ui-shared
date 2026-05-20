"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";

export interface WizardStep {
  id: string;
  label: string;
  /** Optional skip flag — renders the dot greyed and lets the parent jump past it. */
  optional?: boolean;
}

export interface WizardProgressProps {
  steps: WizardStep[];
  currentIndex: number;
  /** Indexes the user has already completed at least once (lets the user jump back). */
  completedIndexes?: number[];
  onStepClick?: (index: number) => void;
}

export function WizardProgress({
  steps,
  currentIndex,
  completedIndexes = [],
  onStepClick,
}: WizardProgressProps) {
  const completed = new Set(completedIndexes);
  return (
    <ol className="flex items-center gap-1" aria-label="Progress">
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isCompleted = completed.has(i) && !isCurrent;
        const isReachable = isCurrent || isCompleted || i < currentIndex;
        const interactive = onStepClick && isReachable;
        return (
          <li key={step.id} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onStepClick?.(i)}
              className={cn(
                "flex items-center gap-2 flex-1 min-w-0 group",
                interactive && "cursor-pointer",
                !interactive && "cursor-default",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "shrink-0 size-5 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors",
                  isCurrent && "bg-zinc-900 text-white",
                  isCompleted && "bg-emerald-500 text-white",
                  !isCurrent && !isCompleted && "bg-zinc-100 text-zinc-400",
                )}
              >
                {isCompleted ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] truncate",
                  isCurrent && "text-zinc-900 font-medium",
                  !isCurrent && "text-zinc-500",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 min-w-2",
                  isCompleted ? "bg-emerald-300" : "bg-zinc-200",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
