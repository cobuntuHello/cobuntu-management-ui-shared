/**
 * The listing state machine, mirrored from the server that enforces it.
 *
 * ── Why a mirror and not a rule of its own ──────────────────────────────────
 *
 * The backend answers this question already, in
 * `services/core/src/shared/listings/listingTransitions.ts`, and the same pure
 * function it exposes to the UI (`availableTransitions`) is the one its own
 * enforcement calls. That file exists because products and events used to
 * decide this twice and drifted six ways. Writing a THIRD implementation here,
 * in the shape of "show Pause when the listing is active", restarts exactly the
 * failure that module was built to end: the button set and the guard agree
 * today because someone read both, and disagree the first week nobody does.
 *
 * So the table below is a transcription, not a design. It is arranged the way
 * the server arranges it (per target state: which states it may come from, and
 * who may ask), so the two can be diffed side by side rather than reasoned
 * about. `__tests__/listing-transitions-parity.test.ts` pins the full decision
 * matrix as data, which is what makes a drift on either side fail out loud
 * instead of shipping a button that 400s.
 *
 * ── What is deliberately NOT mirrored ───────────────────────────────────────
 *
 * `TransitionWrites` (approvedByUserId, closedByUserId, isHidden) is the
 * server's persistence, and the client never writes those columns. Copying them
 * here would create a second place to keep them right for no reader.
 *
 * The refusal SENTENCES are not copied either. The client never has to explain
 * a refusal it predicted, because it does not render the control at all; and
 * when the server refuses something this mirror thought was allowed, the honest
 * words are the ones in that response, not a stale copy of them. The detail
 * panel already surfaces `error` from the body for exactly that case.
 */

import type { ListingState } from "./manageListingRows";

export type { ListingState };

/**
 * Who is asking, as a relationship rather than a person.
 *
 * `isOwner` is the seller of the item; `canReview` is *_MANAGE_LISTINGS in the
 * community carrying it. Both are true for a leader listing their own item,
 * which is the case that makes them two flags instead of one role.
 */
export interface ListingActor {
  isOwner: boolean;
  canReview: boolean;
}

/** Every state, in the server's order, which is the order results come back in. */
export const ALL_STATES: readonly ListingState[] = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "REVOKED",
];

/** Closed for good. Nothing moves out of these without a fresh request. */
export const TERMINAL: readonly ListingState[] = ["CANCELLED", "REVOKED"];

interface Rule {
  from: readonly ListingState[];
  who: (actor: ListingActor) => boolean;
}

/**
 * Read as: to reach this state, come from one of `from`, and be `who`.
 *
 * PAUSED being owner-only is the load-bearing line. It settles an old argument:
 * PAUSED and the legacy `isHidden` meant the same thing while enforcing
 * different rules, so a leader who could not hide a listing could pause it and
 * get the same result. Taking a listing off the shelf is the seller's call; a
 * leader's equivalent power is REVOKED, which is a different state because it
 * is a different act.
 */
export const TRANSITIONS: Record<ListingState, Rule> = {
  /*
   * Nothing enters PENDING except reopening terms that were already agreed,
   * which either side may do. A first request is not a transition at all: the
   * row is created PENDING.
   */
  PENDING: {
    from: ["ACTIVE", "PAUSED"],
    who: (a) => a.isOwner || a.canReview,
  },

  /*
   * Two different moves land on ACTIVE: a reviewer APPROVING a pending listing,
   * and an owner RESUMING one they paused. The rule admits either actor and the
   * server narrows by the state it passes in. That is why a UI cannot read
   * "ACTIVE is available" as "offer this person a button" without narrowing it
   * the same way -- see ownerListingActions.
   */
  ACTIVE: {
    from: ["PENDING", "PAUSED"],
    who: (a) => a.isOwner || a.canReview,
  },

  PAUSED: {
    from: ["ACTIVE"],
    who: (a) => a.isOwner,
  },

  /** The seller withdrew it. */
  CANCELLED: {
    from: ["PENDING", "ACTIVE", "PAUSED"],
    who: (a) => a.isOwner,
  },

  /** The community dropped it: declined at review, or removed after approval. */
  REVOKED: {
    from: ["PENDING", "ACTIVE", "PAUSED"],
    who: (a) => a.canReview,
  },
};

/** May this actor move a listing from `from` to `to`? */
export function isTransitionAllowed(
  from: ListingState,
  to: ListingState,
  actor: ListingActor,
): boolean {
  if (from === to) return false;
  const rule = TRANSITIONS[to];
  if (!rule) return false;
  if (!rule.from.includes(from)) return false;
  return rule.who(actor);
}

/**
 * Every state this actor could move this listing to from here.
 *
 * The mirror of the server's `availableTransitions`, down to the result order,
 * so the parity test can compare arrays rather than sets and catch a
 * transcription that is right by accident.
 */
export function availableTransitions(from: ListingState, actor: ListingActor): ListingState[] {
  return ALL_STATES.filter((to) => isTransitionAllowed(from, to, actor));
}

/** The levers a listing's own page can hand the person who owns it. */
export type OwnerListingAction = "pause" | "resume" | "withdraw";

/** On their own listing's page, the viewer owns it and does not review it. */
const OWNER: ListingActor = { isOwner: true, canReview: false };
const REVIEWER: ListingActor = { isOwner: false, canReview: true };

/**
 * What to offer the owner, in the order it should be offered.
 *
 * Derived from the machine rather than from the state, with ONE narrowing that
 * the server also applies and that a naive mirror would miss: an owner looking
 * at a PENDING listing has ACTIVE in their available set, because the rule for
 * ACTIVE admits `isOwner || canReview` and leaves the from-state to the domain.
 * That ACTIVE is the reviewer's approval, not the owner's resume. Reading it as
 * a lever would put "Put back on the shelf" on a listing that is still in
 * review, and pressing it would be a seller trying to approve themselves.
 *
 * Resume is therefore ACTIVE-from-PAUSED only. Everything else is a straight
 * read of what the machine allows, which is what keeps a state added later from
 * silently inheriting the wrong buttons.
 */
export function ownerListingActions(state: ListingState | null): OwnerListingAction[] {
  if (!state) return [];
  const reachable = availableTransitions(state, OWNER);
  const actions: OwnerListingAction[] = [];
  if (reachable.includes("PAUSED")) actions.push("pause");
  if (reachable.includes("ACTIVE") && state === "PAUSED") actions.push("resume");
  if (reachable.includes("CANCELLED")) actions.push("withdraw");
  return actions;
}

/**
 * Is the ball in the community's court?
 *
 * PENDING is the only state where the owner has done everything they can and
 * is waiting on somebody else. The page says so out loud, because this is where
 * "Follow the review" lands and the question it was clicked to answer is "what
 * is happening with my request".
 */
export function isAwaitingReview(state: ListingState | null): boolean {
  return state === "PENDING";
}


/** What a REVIEWING leader may do, in the order it should be offered. */
export type ReviewerListingAction = "approve" | "decline" | "revoke";

/**
 * What to offer the leader reviewing this listing.
 *
 * The sibling of `ownerListingActions`, asked with the reviewer actor instead
 * of the owner one — the same table, a different `who`. That is the whole
 * reason the actor is a first-class idea here: the two sides are one machine
 * seen from two seats, not two rule sets that have to be kept in agreement.
 *
 * WITHDRAW IS ABSENT, AND CANNOT BE ADDED. CANCELLED is owner-only in the
 * table above, so a leader closing a seller's request goes to REVOKED instead.
 * They are different states because they are different acts, and recording a
 * leader's decision as the seller's withdrawal would put the wrong name on it
 * forever — the same category of mistake as calling a lapsed request declined.
 */
export function reviewerListingActions(state: ListingState | null): ReviewerListingAction[] {
  if (!state) return [];
  const reachable = availableTransitions(state, REVIEWER);
  const actions: ReviewerListingAction[] = [];
  // Approving is only meaningful on something still being asked for.
  if (state === "PENDING" && reachable.includes("ACTIVE")) actions.push("approve");
  if (reachable.includes("REVOKED")) actions.push(state === "PENDING" ? "decline" : "revoke");
  return actions;
}
