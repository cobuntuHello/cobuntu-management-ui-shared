"use client";

import {
  MembershipTierPicker,
  type MembershipTier,
} from "../ui/MembershipTierPicker";
import {
  ceilingFor,
  clampToCeiling,
  tierAccessConsequence,
  type TierAccessValue,
} from "../lib/tierAccess";

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
  const buyCeiling = ceilingFor(viewAccess);

  function changeView(next: TierAccessValue) {
    // Narrowing view can strand buy outside it; clamp in the same update so
    // the two are never briefly contradictory.
    onChange({ viewAccess: next, buyAccess: clampToCeiling(buyAccess, ceilingFor(next)) });
  }

  const consequence = tierAccessConsequence(
    viewAccess,
    buyAccess,
    tiers,
    isEvent ? "register" : "buy",
  );

  return (
    <div>
      {/*
        * No heading here.
        *
        * The page's header is the step's header now, and this component
        * rendering its own meant THREE stacked titles on the access step: the
        * page's, the step's, and this one. What is left is the two questions,
        * which are the actual controls.
        */}

      <div className="rounded-2xl bg-zinc-50 divide-y divide-zinc-100 overflow-hidden">
        <div className="px-4 py-4">
          <p className="text-[13.5px] font-semibold text-zinc-800 mb-2 px-3">Who can see it</p>
          <MembershipTierPicker
            value={viewAccess}
            onChange={changeView}
            tiers={tiers}
            publicLabel="Anyone, including people who are not members"
            disabled={disabled}
          />
        </div>

        <div className="px-4 py-4">
          <p className="text-[13.5px] font-semibold text-zinc-800 mb-2 px-3">
            {isEvent ? "Who can register" : "Who can buy it"}
          </p>
          <MembershipTierPicker
            value={buyAccess}
            onChange={(next) => onChange({ viewAccess, buyAccess: next })}
            tiers={tiers}
            publicLabel={
              isEvent ? "Anyone can register, members or not" : "Anyone can buy it, members or not"
            }
            disabled={disabled}
            ceiling={buyCeiling}
          />
        </div>
      </div>

      {/* The two answers read back as one rule. The step asks them separately
          and this is the only place they are stated together. Null for a fully
          public listing, which needs no narrating. */}
      {consequence && (
        <p className="mt-3 px-1 text-[12.5px] opacity-70 leading-relaxed">{consequence}</p>
      )}
    </div>
  );
}
