/**
 * Which submit buttons a create form should offer.
 *
 * Two apps ask this question — the community app and the admin backoffice —
 * about two things, products and events. Four places to get it wrong, so the
 * rule lives here once and each caller passes the same three facts.
 *
 * The decision is NOT about who you are. It is about the state the listing
 * will actually land in, which is a property of the COMMUNITY's policy:
 *
 *   ACTIVE  → the creator owns the shelf decision, so offer both:
 *             Save (off-shelf, publish later) and Save & Publish (live now).
 *   PENDING → someone else decides, so there is one honest button:
 *             Save & Request Listing.
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

export type SubmitActionKind = "save" | "savePublish" | "saveRequest";

export interface SubmitAction {
  kind: SubmitActionKind;
  label: string;
  /** `publish` to send to the create endpoint. Undefined where it has no meaning. */
  publish?: boolean;
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
}

/**
 * True when the listing will land ACTIVE rather than in a review queue.
 *
 * DYNAMIC always reviews: the commission comes from a proposal, so the
 * negotiation IS the approval and there is no rate to charge until someone
 * agrees one. That is also why the backend refuses to store DYNAMIC with
 * approval switched off — the combination has no meaning.
 */
export function willAutoApprove(input: SubmitActionsInput): boolean {
  if (input.canSelfList) return true;
  if (input.feeModel === "DYNAMIC") return false;
  return !input.requireApproval;
}

export function resolveSubmitActions(input: SubmitActionsInput): SubmitAction[] {
  if (!willAutoApprove(input)) {
    return [{ kind: "saveRequest", label: "Save & Request Listing", primary: true }];
  }
  return [
    // Save is deliberately the SECONDARY action. Both are safe, but the
    // common intent when someone has just filled in a whole form is to put
    // the thing live, and a primary "Save" would quietly bury that behind an
    // extra step on /manage — which is the papercut this replaces.
    { kind: "save", label: "Save", publish: false, primary: false },
    { kind: "savePublish", label: "Save & Publish", publish: true, primary: true },
  ];
}
