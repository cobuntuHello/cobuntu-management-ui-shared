/**
 * Which steps a create flow actually has.
 *
 * The create page used to be one long scroll with the ownership picker pinned
 * to the top and the community-access card buried in the middle of the form.
 * Two decisions that change what the rest of the page MEANS were presented as
 * two more fields among thirty.
 *
 * ── The step list is derived, never fixed ───────────────────────────
 *
 * In the community app a member cannot choose ownership: the backend refuses
 * community ownership for a non-leader whatever the client sends, so their
 * listing is always their own. Rendering a step whose only answer is already
 * decided would be the same mistake as a disabled control that explains a
 * capability you cannot have.
 *
 * And access only exists for a COMMUNITY-owned listing. `viewability` and
 * `accessibility` are community-scoped (COMMUNITY_SCOPED_PRODUCT_FIELDS - the
 * server 403s them on a personal one), so a flow that ends up personal has
 * nothing to configure and gets no access step.
 *
 * That gives four real shapes:
 *
 *   member                     details -> listing
 *   leader, personal           ownership -> details -> listing
 *   leader, community          ownership -> details -> access
 *   admin (always community)   details -> access
 *
 * The admin app is the fourth: it creates only community-owned products, offers
 * no ownership choice and no listing/packages step (a community listing its own
 * item has no second party to agree terms with), and it DOES get the access
 * step. That is the whole reason the access gate keys on the effective
 * ownership rather than on whether ownership was a choice - see below.
 *
 * The listing step no longer depends on packages. The question it asks is "do
 * you want a community to carry this", which exists for every personal item;
 * packages only decide what the step CONTAINS once the answer is yes.
 *
 * `requiresApproval` deliberately does NOT move to the access step. It is not
 * community-scoped - a member selling their own product can require approval,
 * and the backend allows it - so it stays with the listing's own settings in
 * the details step for both flows.
 */

/*
 * "done" is a REAL step, not a screen that replaces the wizard.
 *
 * The confirmation used to unmount the whole flow — header, rail and all — so
 * the progress bar someone had been following for three steps simply vanished
 * at the moment it should have read complete. It is the last step of the same
 * wizard; it just cannot be navigated away from backwards.
 */
export type CreateStepId = "ownership" | "details" | "listing" | "access" | "done";

export interface CreateStepsInput {
    /** Does this person have a real ownership choice? Leaders in the community app. */
    canChooseOwnership: boolean;
    /** What they chose (or what they are fixed to). */
    ownership: "community" | "personal";
    /**
     * Does the community publish arrangements this person could list under?
     *
     * No longer decides whether the Listing step EXISTS — the "do you want a
     * community to carry this" question is asked for every personal item. It
     * decides what the step CONTAINS: with packages, a choice of arrangement;
     * without, just the request, whose rate the community settles later.
     *
     * Kept as an input because the step's copy and its validation differ
     * between those two cases, and the caller already knows which it is.
     */
    hasPackages?: boolean;
}

export function resolveCreateSteps({
    canChooseOwnership,
    ownership,
    hasPackages = false,
}: CreateStepsInput): CreateStepId[] {
    const steps: CreateStepId[] = [];
    if (canChooseOwnership) steps.push("ownership");
    steps.push("details");
    /*
     * "Listing", not "Terms", and it is asked whether or not the community
     * publishes packages.
     *
     * The step used to appear ONLY when there were packages to choose, which
     * made it a pricing screen that happened to sit in a flow. But the first
     * question is not "which arrangement" — it is "do you want a community to
     * carry this at all", and that question exists for every personal item.
     * A seller may perfectly well create something and list it later, or never.
     *
     * Community-owned items never reach here: a community listing its own item
     * has no second party, nothing to request and no commission to agree. That
     * is why the admin app - always community-owned - has no listing step.
     */
    if (ownership === "personal") steps.push("listing");
    /*
     * Keyed on the EFFECTIVE ownership, not on whether ownership was a choice.
     * The capability is a property of WHAT is being created, not of WHO is
     * creating it: a leader making a personal listing has no more to configure
     * here than a member does, and an ADMIN making a community listing has the
     * access step even though it never offered an ownership choice. The earlier
     * `canChooseOwnership && ...` gate silently starved the admin flow of this
     * step - a community-owned create with no access controls at all.
     */
    if (ownership === "community") steps.push("access");
    return steps;
}

/**
 * Is this the last step, and therefore the one that commits?
 *
 * Save and Save & Publish live only here. Committing from an earlier step
 * would mean publishing a community-owned listing before anyone had chosen who
 * can see it - the defaults would be silently applied to a decision the flow
 * exists to ask.
 */
export function isFinalStep(steps: CreateStepId[], current: CreateStepId): boolean {
    return steps[steps.length - 1] === current;
}

/**
 * Where "Next" goes, or null when there is nowhere left.
 *
 * Resolved against the CURRENT step list rather than a fixed order, because
 * the list changes underneath the user: picking "You" on step one removes the
 * access step while they are standing on step one.
 */
export function nextStep(steps: CreateStepId[], current: CreateStepId): CreateStepId | null {
    const i = steps.indexOf(current);
    if (i < 0 || i === steps.length - 1) return null;
    return steps[i + 1];
}

/** Where "Back" goes, or null when this is the first step. */
export function previousStep(steps: CreateStepId[], current: CreateStepId): CreateStepId | null {
    const i = steps.indexOf(current);
    if (i <= 0) return null;
    return steps[i - 1];
}

/**
 * Keep the user on a step that still exists.
 *
 * Standing on "access" and going back to change ownership to "You" deletes the
 * step under them. Returning the last surviving step rather than the first
 * keeps their place instead of throwing them to the start of the flow.
 */
export function clampStep(steps: CreateStepId[], current: CreateStepId): CreateStepId {
    return steps.includes(current) ? current : steps[steps.length - 1];
}

/**
 * Where to REOPEN a draft, given the steps this flow actually has.
 *
 * Mirrors services/core/src/shared/listings/draftStep.ts. The server clamps the
 * stored pointer when it hands the draft back and the client clamps it again
 * against the list it derived for this person; both have to agree or a draft
 * opens on a step the rail is not showing. Transcribed rather than reasoned
 * about so the two can be diffed line by line.
 *
 * Three cases, and the difference between them is the whole point:
 *
 *   - a recorded step this flow still has: go there.
 *   - NOTHING recorded: the start. An old draft saved before the pointer
 *     existed opens where it always did rather than being flung to the end.
 *   - a step this flow no longer has: the LAST one. They got at least that far,
 *     and a step can be renamed or retired between saving a draft and
 *     reopening it. That is a schema change and it must not cost someone their
 *     place; the worst case is landing one step off, never losing the work.
 *
 * Not clampStep: that answers "the step under you vanished mid-flow", where the
 * user is standing somewhere and the list shrank. This answers "you were away,
 * here is where you were", where an unrecognised value is a stale pointer
 * rather than a deleted step, and an ABSENT one is not an error at all.
 */
export function resumeStep(stored: string | null | undefined, available: CreateStepId[]): CreateStepId | null {
    if (available.length === 0) return null;
    if (stored && (available as string[]).includes(stored)) return stored as CreateStepId;
    if (!stored) return available[0];
    return available[available.length - 1];
}

/**
 * The page's heading key, for the step you are on.
 *
 * Returns i18n KEY strings; the consuming app resolves them (the community app
 * through next-intl, the admin app through a plain lookup). One heading, and it
 * belongs to the page: the step is what the page is currently about, so the
 * page should say so.
 */
export function stepHeaderKeys(step: CreateStepId): { title: string; subtitle: string } {
    const name = step === "ownership" ? "Ownership"
        : step === "details" ? "Details"
        : step === "listing" ? "Listing"
        : step === "done" ? "Done"
        : "Access";
    return { title: `step${name}Title`, subtitle: `step${name}Subtitle` };
}
