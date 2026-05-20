"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export type BillingMode = "ONE_TIME" | "RECURRING" | "INSTALLMENT_PLAN";

export interface BillingOption {
  value: BillingMode;
  label: string;
  description?: string;
  /** Hide the option (e.g. event tiers don't expose RECURRING). */
  hidden?: boolean;
}

export interface BillingRadioProps {
  value: BillingMode;
  onChange: (next: BillingMode) => void;
  /** Override the default labels/descriptions or hide options per surface. */
  options?: BillingOption[];
  disabled?: boolean;
}

const DEFAULT_OPTIONS: BillingOption[] = [
  {
    value: "ONE_TIME",
    label: "One-time",
    description: "Single charge at checkout.",
  },
  {
    value: "RECURRING",
    label: "Recurring",
    description: "Charges on a fixed interval until cancelled.",
  },
  {
    value: "INSTALLMENT_PLAN",
    label: "Installment plan",
    description: "Charges on a fixed schedule, then stops automatically.",
  },
];

/**
 * Mutually exclusive billing mode selector. Recurring + installment never
 * combine because Stripe checkout cannot satisfy both subscription_data
 * shapes in one session.
 */
export function BillingRadio({
  value,
  onChange,
  options,
  disabled,
}: BillingRadioProps) {
  const visible = (options ?? DEFAULT_OPTIONS).filter((o) => !o.hidden);
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Billing mode</legend>
      {visible.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              checked
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200 hover:bg-zinc-50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <input
              type="radio"
              name="billing-mode"
              checked={checked}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="mt-0.5 size-4 accent-zinc-900 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-zinc-900">
                {opt.label}
              </div>
              {opt.description && (
                <div className="text-[12px] text-zinc-500 mt-0.5">
                  {opt.description}
                </div>
              )}
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
