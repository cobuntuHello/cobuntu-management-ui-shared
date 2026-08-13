"use client";

import * as React from "react";
import {
  type TierAccessValue,
  tierRowsLocked,
  tierIsIncluded,
  toggleTier,
} from "../lib/tierAccess";

/**
 * Who a listing is open to: everyone, every member, or named membership tiers.
 *
 * Public and All members are shortcuts, not peers of the tiers below them.
 * Picking either ticks and freezes the whole list, because both already imply
 * every tier and there must never be a state where the heading says "Public"
 * while the rows say something narrower.
 *
 * Frozen here means "already included", which is why the rows stay ticked and
 * visible rather than greying out to nothing. That is the opposite of the
 * card-level rule, where a capability the viewer cannot have is not rendered
 * at all: showing a control and refusing it is worse than not showing it. Here
 * the control is not refused, it is answered.
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
}

export function MembershipTierPicker({
  value,
  onChange,
  tiers,
  publicLabel = "Anyone, including people who are not members",
  disabled = false,
}: MembershipTierPickerProps) {
  const locked = tierRowsLocked(value.mode);
  const allIds = tiers.map((t) => t.id);

  return (
    <div className="space-y-0.5">
      <Row
        checked={value.mode === "public"}
        onToggle={() => onChange({ mode: value.mode === "public" ? "all" : "public", tierIds: [] })}
        disabled={disabled}
        title="Public"
        subtitle={publicLabel}
      />
      <Row
        checked={value.mode !== "public"}
        // Already implied by Public, so this cannot be unticked from there -
        // the way out is to untick Public itself.
        locked={value.mode === "public"}
        onToggle={() => onChange({ mode: "all", tierIds: [] })}
        disabled={disabled}
        title="All members"
        subtitle="Every membership tier in this community"
      />

      {tiers.length > 0 && (
        <div className="ml-[26px] pl-3 border-l border-zinc-200 py-0.5 space-y-0.5">
          {tiers.map((tier) => (
            <Row
              key={tier.id}
              indent
              checked={tierIsIncluded(value, tier.id)}
              locked={locked}
              disabled={disabled}
              onToggle={() => onChange(toggleTier(value, tier.id, allIds))}
              title={tier.name}
            />
          ))}
        </div>
      )}

      {tiers.length === 0 && (
        // Nothing to choose between. Saying so beats an empty rail that looks
        // like a failed load.
        <p className="text-[12px] text-zinc-400 px-2 pt-2">
          This community has no membership tiers yet.
        </p>
      )}
    </div>
  );
}

function Row({
  checked,
  locked = false,
  disabled = false,
  onToggle,
  title,
  subtitle,
  indent = false,
}: {
  checked: boolean;
  locked?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  indent?: boolean;
}) {
  const inert = locked || disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={inert || undefined}
      onClick={() => { if (!inert) onToggle(); }}
      className={`w-full flex items-center gap-2.5 ${indent ? "px-2.5 py-1.5" : "pl-2 pr-3 py-2"} rounded-lg text-left transition-colors ${
        inert ? "cursor-default" : "cursor-pointer hover:bg-zinc-50"
      }`}
    >
      <span
        className={`w-[17px] h-[17px] rounded-[5px] border-[1.5px] shrink-0 grid place-items-center transition-colors ${
          checked ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-200"
        } ${inert ? "opacity-45" : ""}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className={`min-w-0 flex-1 ${inert ? "opacity-60" : ""}`}>
        <span className={`block truncate ${indent ? "text-[13px] text-zinc-700" : "text-[13.5px] font-medium text-zinc-900"}`}>
          {title}
        </span>
        {subtitle && <span className="block text-[12px] text-zinc-400 truncate">{subtitle}</span>}
      </span>
    </button>
  );
}
