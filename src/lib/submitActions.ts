/**
 * Which submit buttons a create form should offer.
 *
 * Two apps ask this question — the community app and the admin backoffice —
 * about two things, products and events. Four places to get it wrong, so the
 * rule lives here once and each caller passes the same facts.
 *
 * ── First: was a listing even asked for? ───────────────────────────────────
 *
 * The create wizard's Listing step asks whether the seller wants a community
 * to carry this item at all, and that answer outranks everything below. A
 * "no" produces ONE button, "Create", because there is no shelf to publish
 * onto and no queue to join: the item is real, complete and theirs, visible
 * only to its owner until they ask a community to carry it later.
 *
 * That question did not exist when this rule was written, so
 * `wantsListing` is optional and its absence means "not asked" — a caller
 * that predates the step keeps exactly the behaviour it had.
 *
 * ── Then: the state the listing will land in ───────────────────────────────
 *
 * The rest is NOT about who you are. It is about where the listing actually
 * lands, which is a property of the COMMUNITY's policy:
 *
 *   ACTIVE  → the creator owns the shelf decision, so offer both:
 *             Save (off-shelf, publish later) and Save & Publish (live now).
 *   PENDING → someone else decides, so there is one honest button:
 *             Create & Request Listing.
 *
 * Deriving it from the outcome rather than the role is what keeps the admin
 * app correct without a special case: a backoffice user necessarily holds the
 * create permission, so they always resolve to ACTIVE and always see both
 * buttons — from the same rule everyone else runs, not a hardcode.
 *
 * The backend computes the identical fork in
 * `EventCommunityService.createMemberSubmissionRow` and
 * `ProductService.createMemberSubmissionListing`. Keep them in step: if this
 * says "Save & Publish" and the backend lands the row PENDING, the button
 * promises something that will not happen.
 */

/** How a community prices member-driven listings. */
export type MemberFeeModel = "FLAT" | "DYNAMIC";

/**
 * `create` and `createRequest` are the wizard-era pair; `saveRequest` is what
 * a caller that never asks the listing question still gets.
 *
 * They are separate KINDS rather than one kind with two labels because the
 * community app renders each button through `t(action.kind)` — the kind is
 * the i18n key, so copy that differs must be a kind that differs.
 */
export type SubmitActionKind =
  | "save"
  | "savePublish"
  | "saveRequest"
  | "create"
  | "createRequest"
  | "createList";

export interface SubmitAction {
  kind: SubmitActionKind;
  label: string;
  /** `publish` to send to the create endpoint. Undefined where it has no meaning. */
  publish?: boolean;
  /**
   * Whether this action asks for a listing at all.
   *
   * The wizard used to ask this as a separate question, on a step with two
   * cards. It was the same question the buttons already answer -- "create it"
   * versus "create it and put it on a shelf" -- so the cards asked it twice and
   * could contradict the footer. The answer now rides on the action.
   *
   * false on `create`, true on everything that lists.
   */
  requestListing: boolean;
  /** Whether this is the visually primary action. Exactly one is. */
  primary: boolean;
}

export interface SubmitActionsInput {
  /**
   * Does this person hold the domain's CREATE permission in this community?
   * `EVENTS_CREATE` / `MARKETPLACE_CREATE`. A holder self-lists and is never
   * reviewed, whatever the member policy says — the policy governs MEMBER
   * submissions, and theirs is not one.
   */
  canSelfList: boolean;
  /**
   * The community's fee model for this content type, or null when member
   * listing is switched off entirely.
   */
  feeModel: MemberFeeModel | null;
  /** Whether member submissions of this type are reviewed before going live. */
  requireApproval: boolean;
  /**
   * Did the seller ask a community to carry this item?
   *
   * The answer to the wizard's Listing step. OMIT it where that step was never
   * shown — a leader creating something the community itself owns has no
   * request to make, and a caller written before the step existed never asked.
   * Undefined therefore means "not asked", and preserves the old buttons.
   *
   * Passing `false` is the seller declining a listing for now, which is not a
   * draft and not a failure: the item is created, it simply has no listing
   * anywhere yet.
   */
  wantsListing?: boolean;
}

/**
 * True when the listing will land ACTIVE rather than in a review queue.
 *
 * DYNAMIC always reviews: the commission comes from a proposal, so the
 * negotiation IS the approval and there is no rate to charge until someone
 * agrees one. That is also why the backend refuses to store DYNAMIC with
 * approval switched off — the combination has no meaning.
 *
 * Deliberately ignores `wantsListing`: this answers what the community's
 * policy would do WITH a listing, which stays true whether or not one was
 * asked for. Callers wanting "and was one asked for" read the actions.
 */
export function willAutoApprove(input: SubmitActionsInput): boolean {
  if (input.canSelfList) return true;
  if (input.feeModel === "DYNAMIC") return false;
  return !input.requireApproval;
}

export function resolveSubmitActions(input: SubmitActionsInput): SubmitAction[] {
  /*
   * Two buttons, always: make it, or make it and put it on a shelf.
   *
   * ── Why the shape changed ──────────────────────────────────────────────
   *
   * This used to return a different SET per policy: one button for a member
   * awaiting review, two ("Save" / "Save & Publish") for anyone auto-approved,
   * and a lone "Create" when a separate step had asked whether to list at all.
   *
   * That step is gone, because it asked the same question these buttons
   * answer. Which meant the wizard could contradict itself: the cards said
   * "just create it for now" while the only button said "Request Listing".
   *
   * So the pair is now constant and only the SECOND label varies, on one fact:
   * can this person put it on the shelf themselves, or must they ask?
   *
   *   auto-approved  ->  Create & List      (it goes up now)
   *   reviewed       ->  Create & Request Listing  (a leader decides)
   *
   * `create` is identical in every flow -- the item is made, listed nowhere,
   * visible only to its owner. A leader's Create and a member's Create do the
   * same thing; being a leader changes what the OTHER button does.
   */
  const create: SubmitAction = {
    kind: "create",
    label: "Create",
    // No `publish`: that is a listing's state, and this makes no listing.
    requestListing: false,
    primary: false,
  };

  /*
   * "List", not "Publish".
   *
   * Publish describes a shelf appearing out of nowhere. Listing is the word
   * this domain already uses everywhere else -- listing requests, the Listings
   * tab, community_listings -- and the act really is "put it on a shelf",
   * which is what a listing IS.
   */
  const second: SubmitAction = willAutoApprove(input)
    ? { kind: "createList", label: "Create & List", publish: true, requestListing: true, primary: true }
    : { kind: "createRequest", label: "Create & Request Listing", publish: false, requestListing: true, primary: true };

  return [create, second];
}
