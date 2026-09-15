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
 * A member cannot choose ownership: the backend refuses community ownership
 * for a non-leader whatever the client sends, so their listing is always their
 * own. Rendering a step whose only answer is already decided would be the same
 * mistake as a disabled control that explains a capability you cannot have.
 *
 * And access only exists for a COMMUNITY-owned listing. `viewability` and
 * `accessibility` are community-scoped (COMMUNITY_SCOPED_PRODUCT_FIELDS - the
 * server 403s them on a personal one), so a leader who picks "You" has nothing
 * to configure and gets no third step.
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
 * step. That is why the access gate keys on the effective ownership rather than
 * on whether ownership was a choice - see the gate below.
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
export type CreateStepId = "resume" | "ownership" | "type" | "details" | "commerce" | "listing" | "access" | "done";

export interface CreateStepsInput {
    /** Does this person have a real ownership choice? Leaders only. */
    canChooseOwnership: boolean;
    /**
     * May this community create PHYSICAL products?
     *
     * Comes from `physicalProductsEnabled` on the community payload, which the
     * server DERIVES from the rollout allowlist — the same predicate that
     * decides whether createProduct will accept the type at all. So the step
     * cannot appear anywhere the server would refuse the answer.
     *
     * False everywhere but the QA community today, and false is the default
     * here on purpose: a caller that forgets to pass it gets no step rather
     * than a broken one.
     *
     * When false the step is ABSENT, not disabled. Every product is digital, so
     * there is nothing to ask — and the file's own rule applies: a step whose
     * answer is already known is not a step. Showing a picker with one option
     * would also advertise a feature nobody outside the trial can use.
     */
    canChooseType?: boolean;
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
    /**
     * How many arrangements this person may actually pick between.
     *
     * Not the same question as `hasPackages`. One package is not a choice, and
     * a step whose answer is already known is not a step.
     */
    packageCount?: number;
    /**
     * Does this person have unfinished work of this kind to pick up?
     *
     * Read once the drafts query resolves, not guessed: showing the step and
     * then removing it would move the ground under someone mid-click, and the
     * wizard already knows how to wait for a draft (see `draftPending`).
     */
    hasDrafts?: boolean;
    /**
     * Split pricing + deliverables into their own "Pricing & Deliverables" step
     * after details. PRODUCTS ONLY — the event wizard shares this resolver but
     * has its own ticket/details model and no ProductForm, so it never sets
     * this and never gets the step. Default false keeps events unchanged.
     */
    withCommerceStep?: boolean;
}

export function resolveCreateSteps({
    canChooseOwnership,
    ownership,
    hasPackages = false,
    packageCount,
    hasDrafts = false,
    canChooseType = false,
    withCommerceStep = false,
}: CreateStepsInput): CreateStepId[] {
    const steps: CreateStepId[] = [];
    /*
     * "You have unfinished work" comes FIRST, or it may as well not exist.
     *
     * Autosave changed what a draft is. It used to be something you chose --
     * you pressed "Save as draft", so you knew there was one. Now every form
     * you walk away from leaves one behind, and the reported failure follows
     * directly: start a product, get pulled away, come back, start again from
     * a blank form, and end up with the real thing plus a half-written twin
     * you never knew you made and will never tidy up (drafts are never pruned).
     *
     * A banner above the form was the obvious alternative and is the wrong
     * one: a notice at the top of a page someone came to fill in is exactly
     * the thing they scroll past. A modal is worse in the other direction --
     * most opens really are someone starting something new, and they would pay
     * a dismiss every time.
     *
     * A step costs one click to leave and cannot be missed, and the rail then
     * says what happened: the flow had a question, they answered it.
     *
     * Absent when there is nothing to resume, so the common case is unchanged.
     */
    if (hasDrafts) steps.push("resume");
    if (canChooseOwnership) steps.push("ownership");
    /*
     * Digital or physical, and only where physical is actually creatable.
     *
     * BEFORE details, not inside it, because the answer changes what details
     * must ask: a physical item needs a parcel class and a condition, a digital
     * one needs a file. A form that rearranges itself under someone half-way
     * through filling it in is the worse experience, and the same reasoning is
     * why `ownership` is its own step rather than a control in the header.
     */
    if (canChooseType) steps.push("type");
    steps.push("details");
    /*
     * Pricing & Deliverables — always present, right after the listing details.
     *
     * The tier prices, the per-tier LICENSE that governs the deliverables, and
     * the deliverables themselves (files/links for digital; condition, parcel
     * class and postage for physical) are one coupled cluster: the license is
     * the join between a tier and what it grants, so none of the three can live
     * apart from the others. They were all crammed into the details form; this
     * step is where they go, so "details" is left as the pure listing (photos,
     * description, tags, category, CTA). One mounted ProductForm renders the
     * listing half on `details` and this commerce half here (see `page`).
     */
    if (withCommerceStep) steps.push("commerce");
    /*
     * The arrangement step, for anything sold personally.
     *
     * It used to also ask "do you want a community to carry this at all",
     * which is gone: the footer buttons answer that now, so the step had one
     * answer left. What remains is the COMMISSION -- which package the seller
     * goes up under -- and that is worth its own screen, because it is the
     * only part of this flow that decides what they are PAID. At the bottom of
     * the details form it read as one more setting among thirty.
     *
     * Community-owned items never reach here: a community listing its own item
     * has no second party and no commission to agree.
     */
    /*
     * The arrangement step exists only where there is something to arrange.
     *
     * From the MVP, and it is a rule rather than a nicety: "this screen exists
     * ONLY when the tier has more than one. With a single package there is
     * nothing to decide, so Request listing submits straight through — a step
     * whose answer is already known is not a step."
     *
     * The wizard already pre-selects a lone package on load, precisely because
     * it is not a choice; showing the screen anyway asked someone to confirm a
     * decision that had been made for them, and counted it in "Step 2 of 3".
     *
     * ZERO packages keeps the step. That case is not "nothing to decide", it is
     * "nothing published" — and the step says so, which is how the seller
     * learns the community will propose terms at review instead.
     */
    const soleArrangement = packageCount === 1;
    if (ownership === "personal" && !soleArrangement) steps.push("listing");
    /*
     * Keyed on the EFFECTIVE ownership, not on whether ownership was a choice.
     * The capability is a property of WHAT is being created, not of WHO is
     * creating it: an ADMIN making a community listing has the access step even
     * though it never offered an ownership choice (canChooseOwnership false,
     * always community). The earlier `canChooseOwnership && ...` gate starved
     * the admin flow of this step - a community-owned create with no
     * who-can-see / who-can-buy controls at all. Community-app behaviour is
     * unchanged: its only community case already chose ownership.
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
 * The page's heading, for the step you are on.
 *
 * The create page printed TWO headings stacked: its own ("Host an event in
 * Cobuntu" / "Create an event. It will appear on...") and then the step's
 * ("Who is hosting this?" / "Both go live straight away..."). Four lines of
 * competing preamble before the first control, and on the access step a THIRD
 * pair from ListingAccessStep underneath them.
 *
 * One heading, and it belongs to the page: the step is what the page is
 * currently about, so the page should say so. The per-step blocks are gone.
 *
 * ── The single-step case keeps the page's own words ─────────────────
 *
 * A member has one step, so there is no sequence to narrate. "About your
 * product" would be a strange thing to open on when it is the WHOLE form;
 * they keep the welcoming copy the page always had.
 */
export function stepHeaderKeys(step: CreateStepId): { title: string; subtitle: string } {
    const name = step === "resume" ? "Resume"
        : step === "ownership" ? "Ownership"
        : step === "type" ? "Type"
        : step === "details" ? "Details"
        : step === "commerce" ? "Commerce"
        : step === "listing" ? "Listing"
        : step === "done" ? "Done"
        : "Access";
    return { title: `step${name}Title`, subtitle: `step${name}Subtitle` };
}
