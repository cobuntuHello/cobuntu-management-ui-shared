/**
 * What just happened, and therefore where to send someone next.
 *
 * Creating a listing had exactly one ending: `router.push` to the detail page,
 * whatever had been pressed. That is right for one of the three outcomes and
 * wrong for the other two — after Save, the detail page shows a listing nobody
 * can see, and the button that would put it on the shelf lives on a MANAGE
 * page the flow never mentions.
 *
 * ── The outcome is not the button ───────────────────────────────────
 *
 * `publish: true` is a REQUEST, not a result. A member submission lands
 * PENDING however it was submitted, because the community reviews member
 * listings — so "Save & Publish" pressed by a member does not publish
 * anything. Deriving the outcome from the button alone would tell them their
 * listing is live while it sits in a queue.
 *
 * The four endings, and what each one makes useful:
 *
 *   PUBLISHED   on the shelf now      → View it: there is something to see
 *   SAVED       created, off shelf    → Manage: that is where Publish is
 *   PENDING     waiting on a leader   → Manage: that is where the status is
 *   UNLISTED    no community at all   → Manage: that is where they ask one
 *
 * Which is why the modal's PRIMARY action moves. Two equally weighted buttons
 * would be wrong three times out of four.
 */

export type CreateOutcome = "published" | "saved" | "pending" | "unlisted";

export interface ResolveOutcomeInput {
    /** Did the user ask for it to go on the shelf? Save & Publish. */
    requestedPublish: boolean;
    /**
     * Can this person put a listing on the shelf themselves?
     *
     * False for a member whose community reviews submissions — the same
     * `canSelfList` that decides whether the button says "Save & Publish" or
     * "Save & Request Listing".
     */
    canSelfList: boolean;
    /**
     * Did they ask a community to carry it at all? The Listing step's answer.
     *
     * Optional, and absent means yes — the admin app never asks the question,
     * and neither did this app before the step existed.
     */
    requestedListing?: boolean;
}

export function resolveCreateOutcome({
    requestedPublish,
    canSelfList,
    requestedListing,
}: ResolveOutcomeInput): CreateOutcome {
    /*
     * Asked no community, so there is no review to be waiting on and no shelf
     * to be on or off. Checked FIRST because both conditions below describe a
     * listing's state, and there is no listing.
     *
     * Getting this order wrong is what made "Follow the review" point at a
     * review that was never requested — the link only looked alive because the
     * server was filing a listing nobody asked for. Fixing that server-side
     * without fixing this would have turned it into a link to nowhere.
     */
    if (requestedListing === false) return "unlisted";
    /*
     * Review wins over the request. A member pressing "Save & Request Listing"
     * asked for it to go up; the community decides when. Reporting "published"
     * here is the failure this function exists to prevent.
     */
    if (!canSelfList) return "pending";
    return requestedPublish ? "published" : "saved";
}

/** Which destination leads, given the outcome. */
export function primaryDestination(outcome: CreateOutcome): "view" | "manage" {
    // Only a live listing has something worth looking at. Otherwise the useful
    // next action is the one that changes its state.
    return outcome === "published" ? "view" : "manage";
}

/**
 * Copy keys for the modal, so the three endings cannot be described by one
 * hopeful sentence.
 *
 * Returned as keys rather than strings because this app ships in ten locales;
 * the caller resolves them through next-intl.
 */
export function outcomeCopyKey(outcome: CreateOutcome, kind: "product" | "event"): {
    title: string;
    body: string;
} {
    const k = kind === "event" ? "Event" : "Product";
    return {
        title: `created${k}${cap(outcome)}Title`,
        body: `created${k}${cap(outcome)}Body`,
    };
}

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
