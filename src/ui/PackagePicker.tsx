"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface CommissionPackage {
  id: string;
  name: string;
  description?: string | null;
  /** Percent, 0–100. Fixed for every listing under this package. */
  rate: number;
}

export interface PackagePickerProps {
  packages: CommissionPackage[];
  value: string | null;
  onChange: (packageId: string) => void;
  /** The community's name, used in the copy so the ask reads as theirs. */
  communityName?: string;
  disabled?: boolean;
  /** Shown when the tier has nothing published. */
  emptyLabel?: string;
  /**
   * Cobuntu's own fee on the seller's share, disclosed alongside the
   * community's rate. Omit on surfaces where the viewer is not the one paying
   * it — a leader reviewing a request is not.
   */
  platformFee?: {
    /** Percent of the seller's share. */
    rate: number;
    /** Fixed part, in the smallest currency unit. */
    fixedCents: number;
    currencySymbol?: string;
  } | null;
}

/**
 * How a member chooses the terms they list under.
 *
 * ── Why a full-height card per option and not a dropdown ────────────────────
 *
 * The description is the whole reason a higher rate is acceptable. "PBN-run,
 * 22%" alone reads as a tax; "PBN-run, 22%, we take it end to end — venue,
 * promotion, ticketing and hosts on the day" reads as a price. A select would
 * collapse each option to its label and hide exactly the half that justifies
 * the number, so the member would be choosing between percentages.
 *
 * The rate sits beside the name rather than under the description, so the two
 * things being traded are readable in one line before any prose.
 *
 * Presentational only — no fetching. Both the community app (member requesting)
 * and the admin app (leader countering) render the same list from their own
 * data, which is the point: one component, so the two sides cannot drift into
 * describing the same arrangement differently.
 */
export function PackagePicker({
  packages,
  value,
  onChange,
  communityName,
  disabled = false,
  emptyLabel,
  platformFee,
}: PackagePickerProps) {
  if (packages.length === 0) {
    return (
      <p className="m-0 rounded-[11px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
        {emptyLabel ??
          `${communityName ?? "This community"} hasn't published any arrangements for your membership yet, so listing isn't open to you here.`}
      </p>
    );
  }

  const feeLine = platformFee
    ? `${formatRate(platformFee.rate)}% + ${platformFee.currencySymbol ?? "\u20ac"}${(platformFee.fixedCents / 100).toFixed(2)}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      {packages.map((pkg) => {
        const selected = pkg.id === value;
        return (
          <button
            key={pkg.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(pkg.id)}
            className={cn(
              "rounded-[11px] border px-3.5 py-3 text-left transition-all",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              selected
                ? "border-zinc-900 shadow-[0_0_0_1px_#18181b]"
                : "border-zinc-200 hover:border-zinc-300",
            )}
          >
            <span className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "relative mt-[3px] h-[15px] w-[15px] shrink-0 rounded-full border-2 transition-colors",
                  selected ? "border-zinc-900" : "border-zinc-300",
                )}
              >
                {selected && (
                  <span className="absolute inset-[3px] rounded-full bg-zinc-900" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[13.5px] font-semibold text-zinc-900">
                    {pkg.name}
                  </span>
                  <span className="text-[13.5px] font-bold tabular-nums tracking-tight text-zinc-900">
                    {pkg.rate}%
                  </span>
                </span>
                {pkg.description ? (
                  <span className="mt-1 block whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-500">
                    {pkg.description}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}

      {/*
        * Cobuntu's fee, said out loud at the moment the member is deciding.
        *
        * A fee disclosed only in the earnings breakdown is a fee discovered
        * after the fact, and a seller cannot price their product without it.
        * It sits BELOW the packages rather than inside each one because it is
        * the same on every option — repeating it per card would imply it varies
        * with the choice, which is the one thing it does not do.
        *
        * "Card processing included" is the load-bearing half. Without it a
        * seller assumes Stripe comes on top, which is what every other platform
        * they have used does.
        */}
      {feeLine && (
        <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-zinc-500">
          Cobuntu charges {feeLine} of your share on top, card processing
          included.
        </p>
      )}
    </div>
  );
}

/** 4 rather than 4.0, 2.5 stays 2.5 — a trailing zero reads as false precision. */
function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : String(rate);
}
