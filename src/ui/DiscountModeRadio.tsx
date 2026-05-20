"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Mirrors `MemberPricingMode` on the backend. Kept as a string union here
 * to avoid pulling the prisma schema into a shared UI package.
 */
export type DiscountMode = "FREE" | "PERCENT_OFF" | "FLAT_OFF" | "FIXED_PRICE";

export interface DiscountOption {
  value: DiscountMode;
  label: string;
  description?: string;
}

export interface DiscountModeRadioProps {
  value: DiscountMode;
  onChange: (next: DiscountMode) => void;
  options?: DiscountOption[];
  disabled?: boolean;
}

const DEFAULT_OPTIONS: DiscountOption[] = [
  { value: "FREE", label: "Free for members", description: "Override the price to 0." },
  { value: "PERCENT_OFF", label: "Percent off", description: "e.g. 20% off the list price." },
  { value: "FLAT_OFF", label: "Flat amount off", description: "e.g. €10 off the list price." },
  { value: "FIXED_PRICE", label: "Fixed price", description: "Members always pay this exact amount." },
];

export function DiscountModeRadio({
  value,
  onChange,
  options,
  disabled,
}: DiscountModeRadioProps) {
  const opts = options ?? DEFAULT_OPTIONS;
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {opts.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={cn(
              "text-left p-3 rounded-lg border transition-colors",
              checked
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200 hover:bg-zinc-50",
              disabled
                ? "opacity-60 cursor-not-allowed"
                : "cursor-pointer",
            )}
          >
            <div className="text-[13px] font-medium text-zinc-900">
              {opt.label}
            </div>
            {opt.description && (
              <div className="text-[12px] text-zinc-500 mt-0.5">
                {opt.description}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
