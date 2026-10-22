"use client";

import { AccessAxisControl } from "../ui/AccessAxisControl";
import {
  ceilingFor,
  clampToCeiling,
  tierAccessConsequence,
  type TierAccessValue,
} from "../lib/tierAccess";
import type { MembershipTier } from "../ui/MembershipTierPicker";

/**
 * Who can see this listing, and who can buy it — as its own step.
 *
 * This card used to sit inside the create form, between the pricing tiers and
 * the media uploader, where two decisions about a community's shelf read as
 * two more fields. It is now the step AFTER the listing's own details, which
 * is also the order the questions actually depend on each other in: what the
 * thing is, then who it is for.
 *
 * Community-owned listings only. `viewability` and `accessibility` are
 * community-scoped (the server 403s them on a personal listing), so the step
 * itself does not exist for a personal one — see resolveCreateSteps. This
 * component never has to ask whether it should render.
 *
 * ── Buying is a subset of seeing ────────────────────────────────────
 *
 * The buy picker takes its ceiling from the view value and cannot offer what
 * view excludes, and narrowing view drags buy back with it. Without that,
 * "visible to Founding only" plus "anyone can buy it" is saveable — not a
 * hole, since the view gate runs first, but a card asserting something it
 * cannot do.
 *
 * ── Redesigned (2026-10): the outcome is read before the controls, and the
 *    controls are tap rows, not a wall of checkboxes
 *
 * The two questions used to be two full tier-picker cards, each always
 * showing every tier row whether or not there was anything to choose between
 * — and the one sentence that read the two answers back together
 * (tierAccessConsequence) sat in small type below both, easy to miss. Most
 * communities have zero or one extra tier, so in the common case this was
 * two bare Public/All-members toggles with no stated outcome.
 *
 * It is now the sentence first — live, prominent — then two AccessAxisControl
 * groups, each three full-width rows (Public / All members / Specific tiers)
 * in the mobile-settings-list shape, radios because the three are mutually
 * exclusive. Picking "Specific tiers" expands a nested CHECKBOX list — a
 * deliberately different shape, because that part IS multi-select — instead
 * of every tier being on screen for every community by default.
 */

export interface ListingAccessStepProps {
  viewAccess: TierAccessValue;
  buyAccess: TierAccessValue;
  onChange: (next: { viewAccess: TierAccessValue; buyAccess: TierAccessValue }) => void;
  tiers: MembershipTier[];
  communityName: string;
  /** Events register, products are bought. Drives every verb on the step. */
  kind: "product" | "event";
  disabled?: boolean;
}

export function ListingAccessStep({
  viewAccess,
  buyAccess,
  onChange,
  tiers,
  communityName,
  kind,
  disabled = false,
}: ListingAccessStepProps) {
  const isEvent = kind === "event";
  const verb = isEvent ? "register" : "buy";
  const buyCeiling = ceilingFor(viewAccess);

  function changeView(next: TierAccessValue) {
    // Narrowing view can strand buy outside it; clamp in the same update so
    // the two are never briefly contradictory.
    onChange({ viewAccess: next, buyAccess: clampToCeiling(buyAccess, ceilingFor(next)) });
  }

  const consequence = tierAccessConsequence(viewAccess, buyAccess, tiers, isEvent ? "register" : "buy");

  return (
    <div>
      {/*
       * The live outcome. Computed from the exact same values the two rows
       * below edit, so it can never drift from what is actually stored —
       * there is only ever one answer, read two ways.
       */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <span className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-blue-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <p className="pt-0.5 text-[13.5px] font-semibold leading-relaxed text-blue-900">
          {consequence ?? `Anyone can find and ${verb} this — fully open.`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AccessAxisControl
          label="Who can find this"
          value={viewAccess}
          onChange={changeView}
          tiers={tiers}
          publicLabel="Anyone, including people who are not members"
          disabled={disabled}
        />

        <AccessAxisControl
          label={isEvent ? "Who can register" : "Who can buy it"}
          value={buyAccess}
          onChange={(next) => onChange({ viewAccess, buyAccess: next })}
          tiers={tiers}
          publicLabel={isEvent ? "Anyone can register, members or not" : "Anyone can buy it, members or not"}
          disabled={disabled}
          ceiling={buyCeiling}
        />
      </div>
    </div>
  );
}
