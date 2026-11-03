"use client";

import { useSharedT } from "../i18n";
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
    /*
     * What the payment processor takes out of the figure above.
     *
     * The charge is ALL-IN — Cobuntu pays Stripe out of it rather than
     * deducting separately — so a single "Cobuntu charges 4% + EUR 0.30"
     * overstates what Cobuntu keeps by roughly 60%: at Stripe's 1.5% + EUR
     * 0.25, Cobuntu's own take is 2.5% + EUR 0.05.
     *
     * Optional. Given, the fee renders as a breakdown; omitted, it stays the
     * single all-in line, so a caller that has not been updated is unchanged
     * rather than silently claiming a split it cannot substantiate.
     */
    processing?: { rate: number; fixedCents: number } | null;
  } | null;
  /**
   * Whether this submission needs a leader's review before it is visible to
   * anyone else — rendered as a banner ABOVE the packages/fees, so the
   * process is clear before the member even looks at the numbers. Omit when
   * the host has not resolved it yet; the banner simply does not render
   * rather than guessing.
   */
  approval?: ListingApprovalStatus;
}

export interface ListingApprovalStatus {
  requiresApproval: boolean;
  /** Who reviews it, if known — e.g. the community's name. Falls back to "a leader". */
  reviewerLabel?: string;
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
  approval,
}: PackagePickerProps) {
  const t = useSharedT("shared.managementUi.packagePicker");
  const sym = platformFee?.currencySymbol ?? "€";
  /*
   * Cobuntu's share is the all-in charge MINUS what the processor takes, which
   * is the only figure a premium subscription could ever remove — the processor
   * charges per transaction regardless.
   */
  const feeSplit =
    platformFee && platformFee.processing
      ? {
          processing: `${formatRate(platformFee.processing.rate)}% + ${sym}${(platformFee.processing.fixedCents / 100).toFixed(2)}`,
          platform: `${formatRate(platformFee.rate - platformFee.processing.rate)}% + ${sym}${((platformFee.fixedCents - platformFee.processing.fixedCents) / 100).toFixed(2)}`,
        }
      : null;
  const feeLine = platformFee
    ? `${formatRate(platformFee.rate)}% + ${sym}${(platformFee.fixedCents / 100).toFixed(2)}`
    : null;

  /*
   * Cobuntu's cut (and Stripe's, split out of it) is owed on every sale
   * REGARDLESS of whether the community has published a package yet — it is
   * not a property of the community's own arrangement, so a seller must see
   * it even while there is nothing from the community side to pick. Used to
   * return before any of this rendered, the moment `packages` was empty: a
   * seller with no published package saw the "nothing to pick" note and
   * NOTHING else, as if listing here cost nothing at all.
   */
  if (packages.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <ApprovalBanner approval={approval} t={t} />
        <p className="m-0 rounded-[11px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
          {emptyLabel ??
            t("empty", { community: communityName ?? t("thisCommunity") })}
        </p>
        <FeeBreakdown feeLine={feeLine} feeSplit={feeSplit} t={t} />
      </div>
    );
  }

  /*
   * ONE package is not a choice.
   *
   * Rendering it as a pre-selected radio asks someone to pick from a list of
   * one, which is friction pretending to be consent. But the terms still have
   * to be SHOWN — they are agreeing to them, and the description is the reason
   * the rate is acceptable — so it becomes a statement rather than a control.
   *
   * The value is still reported through onChange on mount by the host, so
   * nothing downstream has to special-case it.
   */
  if (packages.length === 1) {
    const only = packages[0];
    return (
      <div className="flex flex-col gap-2">
        <ApprovalBanner approval={approval} t={t} />
        <div className="rounded-[11px] border border-zinc-200 bg-zinc-50 px-3.5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[13.5px] font-semibold text-zinc-900">{only.name}</span>
            <span className="text-[13.5px] font-bold tabular-nums text-zinc-900">
              {only.rate}%
            </span>
          </div>
          {only.description ? (
            <p className="m-0 mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-500">
              {only.description}
            </p>
          ) : null}
        </div>
        <FeeBreakdown feeLine={feeLine} feeSplit={feeSplit} t={t} sellerRate={only.rate} platformFeeRate={platformFee?.rate} />
      </div>
    );
  }

  const selectedPkg = packages.find((p) => p.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <ApprovalBanner approval={approval} t={t} />
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
              // An offer, not a list row: room to breathe, and a selected
              // state that reads without relying on the 1px border alone.
              "rounded-[14px] border px-4 py-4 text-left transition-all",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              selected
                ? "border-zinc-900 bg-zinc-50 shadow-[0_0_0_1px_#18181b]"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60",
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
                  <span className="text-[14.5px] font-semibold text-zinc-900">
                    {pkg.name}
                  </span>
                  <span className="text-[17px] font-bold tabular-nums tracking-tight text-zinc-900">
                    {pkg.rate}%
                  </span>
                </span>
                {pkg.description ? (
                  <span className="mt-1.5 block whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-500">
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
      <FeeBreakdown feeLine={feeLine} feeSplit={feeSplit} t={t} sellerRate={selectedPkg?.rate} platformFeeRate={platformFee?.rate} />
    </div>
  );
}

/**
 * Cobuntu's cut and Stripe's processing fee, split apart when known or
 * stated as one all-in line otherwise. Shared by every branch of
 * PackagePicker — including the zero- and one-package cases — so the fee is
 * never a thing you only see once a community has published a real choice.
 */
function FeeBreakdown({
  feeLine,
  feeSplit,
  t,
  sellerRate,
  platformFeeRate,
}: {
  feeLine: string | null;
  feeSplit: { processing: string; platform: string } | null;
  t: ReturnType<typeof useSharedT>;
  /** The chosen package's own rate — what the COMMUNITY takes, separate from Cobuntu's cut below. Omit when nothing is chosen yet. */
  sellerRate?: number;
  /** Cobuntu's all-in rate (processing included) as a plain percent, e.g. 4 for 4%. */
  platformFeeRate?: number;
}) {
  if (!feeLine) return null;
  /*
   * "You keep ~X%" is the number everyone is actually asking for when they
   * see a fee breakdown — the two lines below answer "what gets taken" but
   * not "so what's left", and a seller pricing an item has to do that
   * subtraction themselves otherwise. Only shown once a rate is on the
   * table: with `platformFee` alone (no tier rate selected) there is
   * nothing to total yet. Rounded to one decimal — the inputs are whole
   * percents, so anything past that is noise, not precision.
   */
  const keepsLine = sellerRate !== undefined && platformFeeRate !== undefined
    ? t("youKeep", { pct: formatRate(Math.round((100 - sellerRate - platformFeeRate) * 10) / 10) })
    : null;
  if (feeSplit) {
    /*
     * Split, because only one of these two lines is ours and only one of
     * them could ever go away. Lumping them together overstates Cobuntu's
     * take and makes any future "we waive our fee" claim unreadable.
     */
    return (
      <div className="mt-1 rounded-[11px] border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          {t("onTopHeading")}
        </p>
        <dl className="m-0 mt-1.5 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="m-0 text-[12px] text-zinc-500">{t("cardProcessing")}</dt>
            <dd className="m-0 text-[12px] font-semibold tabular-nums text-zinc-700">{feeSplit.processing}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="m-0 text-[12px] text-zinc-500">Cobuntu</dt>
            <dd className="m-0 text-[12px] font-semibold tabular-nums text-zinc-700">{feeSplit.platform}</dd>
          </div>
        </dl>
        {keepsLine && (
          <p className="m-0 mt-2 border-t border-zinc-200 pt-2 text-[12.5px] font-semibold text-zinc-900">
            {keepsLine}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <p className="m-0 text-[11.5px] leading-relaxed text-zinc-500">
        {t("feeLine", { fee: feeLine })}
      </p>
      {keepsLine && (
        <p className="m-0 text-[12.5px] font-semibold text-zinc-900">{keepsLine}</p>
      )}
    </div>
  );
}

/**
 * Whether this submission needs a leader's review, said before the fees so
 * the whole process reads in order: what happens to my submission, then
 * what it costs. Amber for "someone has to say yes first", green for "goes
 * live the moment you submit" — the same color vocabulary this app already
 * uses for pending vs. live elsewhere, not a new one invented here.
 */
function ApprovalBanner({
  approval,
  t,
}: {
  approval?: ListingApprovalStatus;
  t: ReturnType<typeof useSharedT>;
}) {
  if (!approval) return null;
  return approval.requiresApproval ? (
    <p className="m-0 flex items-center gap-2 rounded-[11px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-amber-900">
      <ClockIcon />
      {t("approvalRequired", { reviewer: approval.reviewerLabel ?? t("aLeader") })}
    </p>
  ) : (
    <p className="m-0 flex items-center gap-2 rounded-[11px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-emerald-900">
      <BoltIcon />
      {t("goesLiveImmediately")}
    </p>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

/** 4 rather than 4.0, 2.5 stays 2.5 — a trailing zero reads as false precision. */
function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : String(rate);
}
