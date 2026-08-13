/**
 * Who a listing is open to, as the editor models it.
 *
 * The stored shape is two things — a `viewability` / `accessibility` enum plus
 * rows in `product_segment_access` / `event_segment_access` — and the editor
 * shows one list. This is the translation between them, kept out of the
 * component so both packages and both apps share one interpretation.
 *
 * The three modes are NOT three independent checkboxes. Public and All members
 * are shortcuts that imply every tier below them, which is why selecting one
 * checks and locks the rest: there must never be a state where the summary
 * says "Public" and the tier list says something narrower.
 *
 * Mapping (see docs/features/tier-access.md):
 *
 *   public → PUBLIC       + no rows   (rows are ignored on a PUBLIC listing)
 *   all    → MEMBERS_ONLY + no rows   (absence means every tier)
 *   tiers  → MEMBERS_ONLY + one row per selected tier
 */

export type TierAccessMode = "public" | "all" | "tiers";

export interface TierAccessValue {
  mode: TierAccessMode;
  /** Only meaningful in `tiers` mode; ignored otherwise. */
  tierIds: string[];
}

export type Visibility = "PUBLIC" | "MEMBERS_ONLY";

/**
 * What the editor should show, given what is stored.
 *
 * No rows on a MEMBERS_ONLY listing is `all`, never an empty `tiers` — that is
 * the no-backfill rule surfacing in the UI. Every listing that predates this
 * feature has no rows, and each must open as "All members" rather than as a
 * broken picker with nothing ticked.
 */
export function toTierAccessValue(
  visibility: Visibility | null | undefined,
  grantedTierIds: string[] | null | undefined,
): TierAccessValue {
  if (visibility !== "MEMBERS_ONLY") return { mode: "public", tierIds: [] };
  const ids = grantedTierIds ?? [];
  if (ids.length === 0) return { mode: "all", tierIds: [] };
  return { mode: "tiers", tierIds: [...ids] };
}

/** What to send, given what the editor shows. */
export function fromTierAccessValue(value: TierAccessValue): {
  visibility: Visibility;
  tierIds: string[];
} {
  if (value.mode === "public") return { visibility: "PUBLIC", tierIds: [] };
  if (value.mode === "all") return { visibility: "MEMBERS_ONLY", tierIds: [] };
  return { visibility: "MEMBERS_ONLY", tierIds: [...value.tierIds] };
}

/**
 * Is the whole tier list implied by a shortcut above it?
 *
 * Implied means "already included", never "not available to you". The rows
 * used to render as ticked-and-greyed checkboxes to say so, which read as
 * broken rather than as included — a control that refuses to move is worse
 * than no control. They now render as labels carrying an "Included" tag, and
 * the checkbox appears only where clicking it does something.
 *
 * A capability the user cannot have is not rendered at all; that is a
 * different rule and lives in the card-level gate.
 */
export function tierRowsImplied(mode: TierAccessMode): boolean {
  return mode !== "tiers";
}

/** @deprecated Renamed to `tierRowsImplied`. Kept so consumers can catch up. */
export const tierRowsLocked = tierRowsImplied;

/**
 * ── Buying is always a subset of seeing ─────────────────────────────
 *
 * The two questions were independent state, so "visible to Founding only" +
 * "anyone can buy it" was reachable and saveable. Not a hole — the view gate
 * runs first, so a non-member never reaches the buy button — but the card
 * asserted something untrue, and whoever set it believed they had opened
 * sales to the public.
 *
 * Rather than validate the contradiction after the fact, the buy picker is
 * given a CEILING and simply cannot offer what view already excludes. An
 * option that cannot be honoured is not shown.
 */
export interface TierAccessCeiling {
  /** May the buy side offer "Public"? Only when view is public. */
  allowPublic: boolean;
  /** May it offer "All members"? Not once view names specific tiers. */
  allowAll: boolean;
  /**
   * Tiers the buy side may choose between. `null` means "no restriction,
   * offer them all" — not "offer none", which is why this is not `[]`.
   */
  tierIds: string[] | null;
}

/** What a buy picker may offer, given what the view picker is set to. */
export function ceilingFor(view: TierAccessValue): TierAccessCeiling {
  if (view.mode === "public") return { allowPublic: true, allowAll: true, tierIds: null };
  if (view.mode === "all") return { allowPublic: false, allowAll: true, tierIds: null };
  return { allowPublic: false, allowAll: false, tierIds: [...view.tierIds] };
}

/**
 * Pull a value back inside a ceiling.
 *
 * Called when the VIEW picker changes, because narrowing view can strand buy
 * outside it — set both to Public, then restrict view to Founding, and buy is
 * still "Public" until something drags it back.
 *
 * Narrowing lands on the widest state the ceiling still permits, which is the
 * ceiling itself. That is the least surprising answer: the seller narrowed who
 * can SEE it and said nothing about buying, so buying stays as open as seeing.
 */
export function clampToCeiling(value: TierAccessValue, ceiling: TierAccessCeiling): TierAccessValue {
  if (value.mode === "public" && !ceiling.allowPublic) {
    return ceiling.tierIds ? { mode: "tiers", tierIds: [...ceiling.tierIds] } : { mode: "all", tierIds: [] };
  }
  if (value.mode === "all" && !ceiling.allowAll) {
    return ceiling.tierIds ? { mode: "tiers", tierIds: [...ceiling.tierIds] } : { mode: "all", tierIds: [] };
  }
  if (value.mode === "tiers" && ceiling.tierIds) {
    const kept = value.tierIds.filter((id) => ceiling.tierIds!.includes(id));
    // Everything it named is now invisible, so the choice carries no meaning.
    // Fall back to the ceiling rather than to an empty list nobody can buy.
    if (kept.length === 0) return { mode: "tiers", tierIds: [...ceiling.tierIds] };
    return { mode: "tiers", tierIds: kept };
  }
  return value;
}

/** Is a given tier included, accounting for the shortcuts? */
export function tierIsIncluded(value: TierAccessValue, tierId: string): boolean {
  if (value.mode !== "tiers") return true;
  return value.tierIds.includes(tierId);
}

/**
 * Toggling a single tier.
 *
 * Untick the last one and the listing would be visible to nobody, which is
 * never what someone means — it falls back to `all`, the nearest sensible
 * state, rather than saving something that hides the listing from everyone
 * including the people who were meant to see it.
 */
export function toggleTier(
  value: TierAccessValue,
  tierId: string,
  allTierIds: string[],
  ceiling?: TierAccessCeiling,
): TierAccessValue {
  // Coming from a shortcut, the visible state is "everything included", so the
  // first click means "everything except this one".
  const base = value.mode === "tiers" ? value.tierIds : allTierIds;
  const next = base.includes(tierId) ? base.filter((id) => id !== tierId) : [...base, tierId];

  /*
   * "Every tier" is stored as `all` (no rows), not as a full list — one shape
   * per state. But when a ceiling forbids `all`, collapsing to it would jump
   * ABOVE the ceiling, so the explicit list is the correct resting place.
   */
  const collapses = next.length === 0 || next.length === allTierIds.length;
  if (collapses) {
    if (ceiling && !ceiling.allowAll) return { mode: "tiers", tierIds: [...allTierIds] };
    return { mode: "all", tierIds: [] };
  }
  return { mode: "tiers", tierIds: next };
}

/**
 * What the two settings MEAN together, in one sentence.
 *
 * The card asks two questions in two groups and never reads them back as one
 * rule, which is exactly where the see/buy contradiction hid. Returns null
 * when there is nothing worth saying — a fully public listing does not need
 * narrating.
 */
export function tierAccessConsequence(
  view: TierAccessValue,
  buy: TierAccessValue,
  tiers: Array<{ id: string; name: string }>,
  /*
   * Events register, products are bought. The same card renders for both, and
   * a sentence reading "only Founding can buy it" under an event's access
   * settings is wrong in the one place the whole line exists to be right.
   */
  verb: "buy" | "register" = "buy",
): string | null {
  const V = verb === "register" ? "register" : "buy it";
  const nameOf = (ids: string[]) =>
    tiers.filter((t) => ids.includes(t.id)).map((t) => t.name);
  const list = (names: string[]) =>
    names.length <= 1
      ? names[0] ?? ""
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  if (view.mode === "public" && buy.mode === "public") return null;

  if (view.mode === "public" && buy.mode === "all") {
    return `Anyone can find it, but only members can ${V}.`;
  }
  if (view.mode === "public" && buy.mode === "tiers") {
    const names = list(nameOf(buy.tierIds));
    return `Anyone can find it. Only ${names} can ${V} — everyone else is offered the tier.`;
  }
  if (view.mode === "all" && buy.mode === "all") {
    return "Members only, at any tier. Nobody outside the community will find it.";
  }
  if (view.mode === "all" && buy.mode === "tiers") {
    const buyers = nameOf(buy.tierIds);
    const others = tiers.filter((t) => !buy.tierIds.includes(t.id)).map((t) => t.name);
    const tail = others.length > 0 ? ` ${list(others)} will see it but not be able to ${verb === "register" ? "register" : "buy"}.` : "";
    return `Every member can find it. Only ${list(buyers)} can ${V}.${tail}`;
  }
  if (view.mode === "tiers") {
    const viewers = list(nameOf(view.tierIds));
    if (buy.mode === "tiers" && buy.tierIds.length < view.tierIds.length) {
      return `Only ${viewers} can find it, and only ${list(nameOf(buy.tierIds))} can ${V}.`;
    }
    return `Only ${viewers} can find it. Nobody else sees it anywhere in the community.`;
  }
  return null;
}

/** One-line summary for a collapsed row, e.g. a settings-drawer entry. */
export function tierAccessSummary(
  value: TierAccessValue,
  tiers: Array<{ id: string; name: string }>,
): string {
  if (value.mode === "public") return "Everyone";
  if (value.mode === "all") return "All members";
  const names = tiers.filter((t) => value.tierIds.includes(t.id)).map((t) => t.name);
  if (names.length === 0) return "All members";
  if (names.length <= 2) return names.join(" and ");
  return `${names.length} membership tiers`;
}
