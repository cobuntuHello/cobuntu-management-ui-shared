"use client";

import type { ReactNode } from "react";
import {
  tierIsIncluded,
  toggleTier,
  type TierAccessValue,
  type TierAccessCeiling,
} from "../lib/tierAccess";
import type { MembershipTier } from "./MembershipTierPicker";

/**
 * One axis of listing access — "Who can find this" or "Who can register" —
 * as a single group of full-width tap rows: the mobile-settings-list
 * pattern (iOS, Android, Gmail's label picker), deliberately NOT a dropdown
 * and NOT a wall of always-visible tier checkboxes.
 *
 * Three rows, each a real choice: Public / All members / Specific tiers,
 * rendered as RADIOS (a filled dot) because the three are mutually
 * exclusive. Picking "Specific tiers" expands a nested list of CHECKBOXES
 * (a square with a tick) directly beneath it — deliberately a different
 * shape from the radios above, because that list IS multi-select, and a
 * checkmark next to a mutually-exclusive option would misstate the control.
 * A faint rail ties the nested rows back to "Specific tiers" so the group
 * reads as nested rather than as more top-level options.
 *
 * Replaces `MembershipTierPicker`'s always-expanded card, which put every
 * tier row on screen for every community whether or not there was anything
 * to choose between — the common case (0-1 extra tiers) showed two bare
 * Public/All-members toggles with no stated outcome, and a multi-tier
 * community got a full checklist it had to scan even to leave on its
 * default. The underlying rules are unchanged (`ceilingFor`/`clampToCeiling`
 * still own the "register can never be wider than see" invariant; this
 * component only decides how much of that state is visible at once).
 *
 * docs/features/access-axis-control.md
 */

export interface AccessAxisControlProps {
  /** "Who can find this" / "Who can register" / "Who can buy it". */
  label: string;
  value: TierAccessValue;
  onChange: (next: TierAccessValue) => void;
  tiers: MembershipTier[];
  /** Subtitle under the Public row. */
  publicLabel: string;
  /** Subtitle under the All members row. Sensible default covers both axes. */
  allLabel?: string;
  /**
   * What the OTHER axis already allows. The register picker passes
   * `ceilingFor(viewAccess)` and can never offer more than view does.
   */
  ceiling?: TierAccessCeiling;
  disabled?: boolean;
}

export function AccessAxisControl({
  label,
  value,
  onChange,
  tiers,
  publicLabel,
  allLabel = "Every tier in this community",
  ceiling,
  disabled = false,
}: AccessAxisControlProps) {
  const showPublic = ceiling ? ceiling.allowPublic : true;
  const showAll = ceiling ? ceiling.allowAll : true;
  const choosable = ceiling?.tierIds ? tiers.filter((t) => ceiling.tierIds!.includes(t.id)) : tiers;
  const choosableIds = choosable.map((t) => t.id);
  // Same rule MembershipTierPicker used: with under two tiers to choose
  // between, "All members" and the tier list describe the same set, so
  // offering a picker for it is noise rather than a real choice.
  const canChooseTiers = choosable.length >= 2;

  function pickTiers() {
    // Coming from a shortcut, the visible state is "everything included" —
    // starting the checklist fully ticked and letting the person UNCHECK
    // the ones to exclude ("A and B, not C") is the same convention
    // toggleTier already uses when a tier row is unticked directly from a
    // shortcut.
    onChange({ mode: "tiers", tierIds: value.tierIds.length ? value.tierIds : [...choosableIds] });
  }

  return (
    <div className="rounded-2xl border border-zinc-100 p-1.5">
      <div className="px-2.5 pb-1 pt-2.5 text-[12.5px] font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </div>

      <div className="flex flex-col gap-1">
      <Row
        title="Public"
        subtitle={publicLabel}
        selected={value.mode === "public"}
        disabled={disabled || !showPublic}
        onClick={() => onChange({ mode: "public", tierIds: [] })}
      />
      <Row
        title="All members"
        subtitle={allLabel}
        selected={value.mode === "all"}
        disabled={disabled || !showAll}
        onClick={() => onChange({ mode: "all", tierIds: [] })}
      />
      {canChooseTiers && (
        <Row
          title="Specific tiers"
          subtitle="Choose which ones"
          selected={value.mode === "tiers"}
          disabled={disabled}
          onClick={pickTiers}
          trailing={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={`shrink-0 text-zinc-300 transition-transform ${value.mode === "tiers" ? "rotate-90" : ""}`}
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          }
        />
      )}
      </div>

      {value.mode === "tiers" && canChooseTiers && (
        <div className="mt-1">
          {choosable.map((tier, i) => {
            const checked = tierIsIncluded(value, tier.id);
            return (
              <button
                key={tier.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => onChange(toggleTier(value, tier.id, choosableIds, ceiling))}
                className={`relative flex w-full items-center gap-3 rounded-[9px] py-[9px] pl-[30px] pr-3.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 disabled:cursor-default ${
                  // A faint rail from the parent row down to the last child —
                  // the visual tie that makes this read as nested.
                  i === choosable.length - 1 ? "before:bottom-1/2" : "before:bottom-0"
                } before:absolute before:left-6 before:top-0 before:w-[1.5px] before:bg-zinc-100 before:content-['']`}
              >
                <span className="min-w-0 flex-1 text-[13.5px] text-zinc-700">{tier.name}</span>
                {/* Brand rather than pure black. Four stacked zinc-900 squares
                    were the heaviest marks in the control, which put the most
                    weight on its least important rows -- these are children of
                    a choice already made above them. */}
                <span
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors"
                  style={{
                    borderColor: checked ? "var(--brand-color, #18181b)" : "rgba(128,128,128,0.30)",
                    background: checked ? "var(--brand-color, #18181b)" : "transparent",
                  }}
                >
                  {checked && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
          {ceiling?.tierIds && ceiling.tierIds.length < tiers.length && (
            <div className="px-3.5 py-1.5 pl-[30px] text-[11px] text-zinc-300">
              Only tiers that can already find it are listed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  title,
  subtitle,
  selected,
  disabled,
  onClick,
  trailing,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      /*
        * A RESTING SURFACE, and a selected state readable from the left edge.
        *
        * These rows had no fill and no hover -- only `active:`, a press state
        * -- so at rest they were bare text on white and did not read as the
        * choices they are. Selection was carried entirely by a 20px dot at the
        * far right, which on a wide card is a long way from the label it
        * answers: the chosen row looked identical to the other two until the
        * eye travelled to the end of it.
        *
        * Now the row itself carries the answer. Selected takes a brand-tinted
        * plate and ring; the rest take the muted plate used for every other
        * settings row in these forms, and deepen on hover.
        */
      style={selected && !disabled ? { boxShadow: undefined, ["--tw-ring-color" as string]: "color-mix(in srgb, var(--brand-color, #18181b) 30%, transparent)" } : undefined}
      className={`flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all disabled:cursor-default ${
        /*
          * Selected LIFTS: white plate, ring, soft shadow. Unselected is the
          * muted plate.
          *
          * The first attempt tinted the selected row with the brand colour at
          * 7%. Rendered with no brand token -- which is the admin's case, and
          * the fallback is near-black -- that tint came out a grey within a
          * hair of the zinc-50 beneath it, so the chosen row was once again
          * indistinguishable from the other two. White against zinc-50 is a
          * difference that survives having no hue at all, and the ring takes
          * the brand colour where there is one.
          */
        disabled
          ? "bg-zinc-50/60"
          : selected
            ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-14px_rgba(0,0,0,0.5)] ring-[1.5px]"
            : "bg-zinc-50 hover:bg-zinc-100 cursor-pointer"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block text-[14.5px] font-semibold ${disabled ? "text-zinc-300" : "text-zinc-900"}`}>
          {title}
        </span>
        <span className="block text-[11.5px] text-zinc-400">{subtitle}</span>
      </span>
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
        style={{
          borderColor: disabled
            ? "rgba(128,128,128,0.18)"
            : selected
              ? "var(--brand-color, #18181b)"
              : "rgba(128,128,128,0.30)",
        }}
      >
        {selected && (
          <span
            className="h-[9px] w-[9px] rounded-full"
            style={{ background: disabled ? "rgba(128,128,128,0.25)" : "var(--brand-color, #18181b)" }}
          />
        )}
      </span>
      {trailing}
    </button>
  );
}
