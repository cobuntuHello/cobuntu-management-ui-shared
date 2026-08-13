"use client";

import * as React from "react";
import {
  type TierAccessValue,
  type TierAccessCeiling,
  tierRowsImplied,
  tierIsIncluded,
  toggleTier,
} from "../lib/tierAccess";

/**
 * Who a listing is open to: everyone, every member, or named membership tiers.
 *
 * ── Layout: labels left, controls right ─────────────────────────────
 *
 * Leading checkboxes put the control between the reader and the words, and
 * every subtitle then starts at a different distance from its own tick. With
 * the boxes flush right the card has ONE column of questions and ONE column of
 * answers, so a nested tier can indent its label without dragging its control
 * along - which is what let the indent rail and its 26px offset go.
 *
 * ── Implied rows carry a tag, not a dead checkbox ───────────────────
 *
 * Public and All members are shortcuts, not peers of the tiers below them:
 * both already imply every tier, and there must never be a state where the
 * heading says "Public" while the rows say something narrower. That used to be
 * drawn as ticked-and-greyed checkboxes, which reads as BROKEN rather than as
 * included. An implied row is now a label with an "Included" tag; the checkbox
 * appears only where clicking it does something.
 *
 * ── The tier list hides below two tiers ─────────────────────────────
 *
 * With one tier, "All members" and that tier describe the same set of people.
 * Two rows and a group heading for one fact is noise, and most communities
 * have exactly one tier.
 *
 * "Membership tier" is written out in full on the heading. `product_tiers`
 * already means PRICE tiers, and this component frequently sits on the same
 * screen as a card headed "Pricing - 1 tier".
 */

export interface MembershipTier {
  id: string;
  name: string;
}

export interface MembershipTierPickerProps {
  value: TierAccessValue;
  onChange: (next: TierAccessValue) => void;
  tiers: MembershipTier[];
  /** Copy for the public row, which differs between seeing and buying. */
  publicLabel?: string;
  disabled?: boolean;
  /**
   * What the OTHER question already allows. Buying is a subset of seeing, so
   * the buy picker passes `ceilingFor(viewAccess)` and never offers an option
   * the view setting has already excluded. Omitted means no ceiling.
   */
  ceiling?: TierAccessCeiling;
}

export function MembershipTierPicker({
  value,
  onChange,
  tiers,
  publicLabel = "Anyone, including people who are not members",
  disabled = false,
  ceiling,
}: MembershipTierPickerProps) {
  const implied = tierRowsImplied(value.mode);

  // Only the tiers the ceiling still permits are choosable, and they are also
  // the set "every tier" means here - so toggling the last one collapses to
  // the ceiling rather than to something wider than the listing is visible to.
  const choosable = ceiling?.tierIds
    ? tiers.filter((t) => ceiling.tierIds!.includes(t.id))
    : tiers;
  const choosableIds = choosable.map((t) => t.id);

  const showPublic = ceiling ? ceiling.allowPublic : true;
  const showAll = ceiling ? ceiling.allowAll : true;
  // See the header note: one tier makes the list a restatement of "All members".
  const showTierList = choosable.length >= 2;

  return (
    <div>
      {showPublic && (
        <Row
          checked={value.mode === "public"}
          onToggle={() => onChange({ mode: value.mode === "public" ? "all" : "public", tierIds: [] })}
          disabled={disabled}
          title="Public"
          subtitle={publicLabel}
        />
      )}
      {showAll && (
        <Row
          /*
           * Ticked when it is TRUE, not merely when Public is off. An earlier
           * cut used `mode !== "public"`, which left this ticked while a single
           * tier was selected below - the row claimed "all members" while the
           * listing was granted to one.
           */
          checked={value.mode !== "tiers"}
          // Under Public this is already included, so it gets the tag rather
          // than a checkbox that would have to refuse the click. The way out
          // is to untick Public itself.
          implied={value.mode === "public"}
          onToggle={() => onChange({ mode: "all", tierIds: [] })}
          disabled={disabled}
          title="All members"
          subtitle="Every membership tier in this community"
          divider={showPublic}
        />
      )}

      {showTierList && (
        <div className="pt-0.5">
          {choosable.map((tier) => (
            <Row
              key={tier.id}
              indent
              checked={tierIsIncluded(value, tier.id)}
              implied={implied}
              disabled={disabled}
              onToggle={() => onChange(toggleTier(value, tier.id, choosableIds, ceiling))}
              title={tier.name}
            />
          ))}
        </div>
      )}

      {tiers.length === 0 && (
        // Nothing to choose between. Saying so beats an empty rail that looks
        // like a failed load.
        <p className="text-[12px] text-zinc-400 px-3 pt-2">
          This community has no membership tiers yet.
        </p>
      )}
    </div>
  );
}

function Row({
  checked,
  implied = false,
  disabled = false,
  onToggle,
  title,
  subtitle,
  indent = false,
  divider = false,
}: {
  checked: boolean;
  implied?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  indent?: boolean;
  divider?: boolean;
}) {
  const inert = implied || disabled;

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate ${
            indent
              ? `text-[13px] ${inert ? "text-zinc-400" : "text-zinc-700"}`
              : `text-[13.5px] font-medium ${inert ? "text-zinc-400" : "text-zinc-900"}`
          }`}
        >
          {title}
        </span>
        {subtitle && (
          <span className={`block text-[12px] truncate ${inert ? "text-zinc-300" : "text-zinc-400"}`}>
            {subtitle}
          </span>
        )}
      </span>

      {/* The control column. An implied row spends it on a word instead of a
          checkbox that would have to refuse the click. */}
      <span className="shrink-0 ml-4">
        {implied ? (
          <span className="text-[11px] font-medium text-zinc-400 whitespace-nowrap">Included</span>
        ) : (
          <span
            className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] grid place-items-center transition-colors ${
              checked ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-200"
            } ${disabled ? "opacity-45" : ""}`}
          >
            {checked && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        )}
      </span>
    </>
  );

  const shape = `w-full flex items-center text-left rounded-lg transition-colors ${
    indent ? "pl-8 pr-3 py-1.5" : "pl-3 pr-3 py-2"
  } ${divider ? "border-t border-zinc-100" : ""}`;

  // An implied row is not a control, so it must not be a button - nothing to
  // press, nothing to reach by keyboard, nothing to announce as a checkbox.
  if (implied) {
    return <div className={`${shape} cursor-default`}>{body}</div>;
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={() => { if (!disabled) onToggle(); }}
      className={`${shape} ${disabled ? "cursor-default" : "cursor-pointer hover:bg-zinc-50"}`}
    >
      {body}
    </button>
  );
}
