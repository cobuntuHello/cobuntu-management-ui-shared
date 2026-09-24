import { describe, it, expect } from "vitest";
import {
  resolveCreateSteps,
  isFinalStep,
  nextStep,
  previousStep,
  clampStep,
  stepHeaderKeys,
} from "../create/createWizard";

/**
 * The shape of a create flow.
 *
 * The whole point is that the step list is DERIVED, not fixed. Three rules
 * drive it, and the first two are about not asking a question whose answer is
 * already decided:
 *
 *   - A member cannot choose ownership. The backend refuses community
 *     ownership for a non-leader whatever the client sends, so a step offering
 *     the choice would offer a lie.
 *
 *   - Access only exists for a COMMUNITY-owned listing. viewability and
 *     accessibility are community-scoped and the server 403s them on a
 *     personal one, so a leader who picks "You" has nothing to configure.
 *
 *   - Every PERSONAL item gets the listing step, packages or not. This one is
 *     the opposite case: a question that always has a real answer. "Do you
 *     want a community to carry this?" is open for anything somebody made
 *     themselves, and it is open before the arrangement is, because the
 *     arrangement only matters once the answer is yes.
 *
 * ── Why these expectations changed (2026-08, feat/listing-step-wizard) ──
 *
 * The step now called "listing" used to be called "terms" and appeared ONLY
 * when the community published packages, which made it a pricing screen that
 * happened to sit in a flow. A member with no packages had a single step and
 * no way to say "make it, do not list it yet"; the only button was
 * "Save & Request Listing", so every item entered a review queue whether its
 * maker was ready or not.
 *
 * So the assertions below moved deliberately: a member now has TWO steps and a
 * leader selling personally has THREE. Where a test used to read "a member has
 * a single step", it was not weakened to pass, it was rewritten against a
 * different model. hasPackages no longer decides whether the step EXISTS, only
 * what it contains, so it is absent from these inputs entirely.
 */

describe("the four real shapes", () => {
  it("gives a member two steps: what it is, then whether to list it", () => {
    /*
     * Was ["details"], on the old rule that a member with nothing to price had
     * nothing to decide. They do: whether to involve a community at all.
     */
    expect(resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" }))
      .toEqual(["details", "listing"]);
  });

  it("asks the listing question with or without packages", () => {
    /*
     * The rule this file exists to pin. hasPackages used to gate the step; a
     * community that agrees terms per request published none, so exactly the
     * members who most needed to negotiate were the ones never asked.
     */
    const withPackages = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal", hasPackages: true });
    const without = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal", hasPackages: false });
    expect(withPackages).toEqual(without);
    expect(without).toContain("listing");
  });

  it("gives a leader selling personally three steps", () => {
    // Was ["ownership", "details"]: a leader's own item is a personal item,
    // so it gets the same listing question a member's does.
    expect(resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" }))
      .toEqual(["ownership", "details", "listing"]);
  });

  it("gives a leader selling as the community ownership, details and access", () => {
    /*
     * No listing step, and this is the substantive half of the rule rather
     * than an omission: a community listing its own item has no second party,
     * nothing to request and no commission to agree.
     */
    expect(resolveCreateSteps({ canChooseOwnership: true, ownership: "community" }))
      .toEqual(["ownership", "details", "access"]);
  });

  it("gives a community-owned create with NO ownership choice the access step — the admin shape", () => {
    /*
     * The access gate keys on the EFFECTIVE ownership, not on whether ownership
     * was a choice. The admin app never offers an ownership step (it only ever
     * creates community-owned products) and must still get the who-can-see /
     * who-can-buy step - the earlier `canChooseOwnership && ...` gate gave it no
     * access controls at all.
     *
     * A member cannot reach this input: the caller forces a non-leader's
     * effective ownership to "personal" (see the next case), so "community" with
     * no ownership choice is the admin, never a member.
     */
    expect(resolveCreateSteps({ canChooseOwnership: false, ownership: "community" }))
      .toEqual(["details", "access"]);
  });

  it("keeps a member (forced to personal) off the access step", () => {
    /*
     * The safety that used to live in the resolver now lives at the caller: a
     * non-leader's effective ownership is "personal", which yields the listing
     * step and never the access step - the one the server would 403.
     */
    expect(resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" }))
      .toEqual(["details", "listing"]);
  });
});

describe("where the commit lives", () => {
  it("is the access step for a community listing", () => {
    const steps = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });
    expect(isFinalStep(steps, "access")).toBe(true);
    expect(isFinalStep(steps, "details")).toBe(false);
  });

  it("is the listing step for anything sold personally", () => {
    /*
     * Was the details step, back when a leader selling personally ended
     * there. Committing from details would now skip the listing question
     * entirely and file a request nobody asked to make.
     */
    const steps = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" });
    expect(isFinalStep(steps, "listing")).toBe(true);
    expect(isFinalStep(steps, "details")).toBe(false);
  });

  it("is the listing step for a member too", () => {
    // Was "is the only step for a member", asserting details. A member has
    // two steps now and commits on the second, same as a leader selling
    // personally: the flows differ only by the ownership step in front.
    const steps = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" });
    expect(isFinalStep(steps, "listing")).toBe(true);
    expect(isFinalStep(steps, "details")).toBe(false);
  });
});

describe("moving between steps", () => {
  const community = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });

  it("walks forward and stops at the end", () => {
    expect(nextStep(community, "ownership")).toBe("details");
    expect(nextStep(community, "details")).toBe("access");
    expect(nextStep(community, "access")).toBeNull();
  });

  it("walks back and stops at the start", () => {
    expect(previousStep(community, "access")).toBe("details");
    expect(previousStep(community, "ownership")).toBeNull();
  });

  it("ends a personal flow on listing rather than access", () => {
    // The personal flow is the same length as the community one now (both
    // three for a leader); they differ in the LAST step, not the count.
    const personal = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" });
    expect(nextStep(personal, "details")).toBe("listing");
    expect(nextStep(personal, "listing")).toBeNull();
  });

  it("returns null for a step that is not in this flow", () => {
    // `personal` used to be the two-step flow; the assertion is unchanged
    // because access is absent from it either way.
    const personal = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" });
    expect(nextStep(personal, "access")).toBeNull();
    expect(previousStep(personal, "access")).toBeNull();
  });
});

describe("the step list changes underneath the user", () => {
  it("keeps their place when the current step survives", () => {
    const steps = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });
    expect(clampStep(steps, "details")).toBe("details");
  });

  it("lands on the LAST surviving step when the current one is deleted", () => {
    /*
     * Stand on "access", go back, switch to "You". The access step ceases to
     * exist while the user is holding a reference to it.
     *
     * Falling back to the last surviving step keeps them where they were in
     * the flow; falling back to the FIRST would throw someone who had filled
     * in the entire form back to the ownership question, which reads as having
     * lost their work even though the form is still mounted.
     *
     * That last surviving step is now "listing", not "details": switching to
     * personal does not shorten the flow any more, it swaps its final step,
     * so the user lands on the question the swap just introduced. Which is the
     * right place to put them, and the reason this expectation moved.
     */
    const after = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" });
    expect(clampStep(after, "access")).toBe("listing");
  });

  it("clamps a member to their last step", () => {
    /*
     * Was "handles a member whose only step is details" and expected
     * "details" for both. A member's steps are ["details", "listing"], and
     * clampStep answers with the LAST surviving one, so both now clamp to
     * "listing".
     *
     * Purely defensive either way: the caller seeds a member's step to
     * "details" and neither "ownership" nor "access" is reachable from the
     * member UI, so nothing in the app depends on which end this picks.
     */
    const steps = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" });
    expect(clampStep(steps, "ownership")).toBe("listing");
    expect(clampStep(steps, "access")).toBe("listing");
  });
});

describe("the progress bar does not move when the flow changes shape", () => {
  /*
   * Reported on screen: picking "You" on step one made the bar jump forward
   * without anyone pressing Next.
   *
   * The cause was the denominator, not the marker. Fill was
   * `(index + 1) / length`; choosing personal deleted the access step, so
   * length went 3 -> 2 and the fill went 33% -> 50%. The scale moved under a
   * marker that had not.
   *
   * Measuring the steps BEHIND you makes step one 0% in every flow.
   *
   * The original trigger can no longer fire: a leader's two flows are both
   * three steps, because personal gains "listing" exactly where it loses
   * "access". So the comparison here is between the MEMBER flow (two steps)
   * and a leader's (three) rather than between one leader's two answers. The
   * formula is what is being pinned, and it is still the thing that would
   * break if anyone reached for length again.
   */
  const fill = (steps: unknown[], index: number) =>
    steps.length > 1 ? Math.round((index / (steps.length - 1)) * 100) : 0;

  const member = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" });
  const leader = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });

  it("is identical on step one whether the flow is 2 or 3 steps long", () => {
    expect(member).toHaveLength(2);
    expect(leader).toHaveLength(3);
    expect(fill(member, 0)).toBe(fill(leader, 0));
    expect(fill(leader, 0)).toBe(0);
  });

  it("does not move when a leader switches ownership", () => {
    /*
     * The bug's own case, kept even though the lengths now match: it matches
     * BY COINCIDENCE of the two flows having three steps each, and a fourth
     * step added to either one would part them again.
     */
    const personal = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal" });
    expect(fill(leader, 0)).toBe(fill(personal, 0));
    expect(fill(leader, 1)).toBe(fill(personal, 1));
  });

  it("still reaches 100% on the last step of either flow", () => {
    expect(fill(leader, 2)).toBe(100);
    expect(fill(member, 1)).toBe(100);
  });

  it("advances only when the index does", () => {
    expect(fill(leader, 1)).toBe(50);
  });
});

describe("back walks the steps before it leaves the page", () => {
  it("has somewhere to go from every step except the first", () => {
    /*
     * The breadcrumb arrow used to call window.history.back() unconditionally,
     * so from step 3 it abandoned a half-filled form. It asks the page first
     * now, and the page answers with previousStep.
     */
    const steps = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });
    expect(previousStep(steps, "access")).toBe("details");
    expect(previousStep(steps, "details")).toBe("ownership");
    // Nothing behind step one, and this is where the arrow is allowed to navigate.
    expect(previousStep(steps, "ownership")).toBeNull();
  });

  it("walks a member back to details before it leaves", () => {
    /*
     * Was "leaves immediately for a member, who has only one step". A member
     * has two, so the arrow now has one step to walk first: from the listing
     * question back to the form. Leaving from there would discard a filled-in
     * form to undo a single radio press.
     */
    const steps = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" });
    expect(previousStep(steps, "listing")).toBe("details");
    expect(previousStep(steps, "details")).toBeNull();
  });
});

describe("a step whose answer is already known is not a step", () => {
    /*
     * From the negotiation MVP, which is the agreed design for this flow, and
     * it is a rule rather than a nicety: "this screen exists ONLY when the tier
     * has more than one. With a single package there is nothing to decide, so
     * Request listing submits straight through."
     *
     * The wizard already pre-selected a lone package on load — precisely
     * because it is not a choice — and then showed the screen anyway, asking
     * someone to confirm a decision that had been made for them, and counting
     * it in "Step 2 of 3".
     */
    const personal = { canChooseOwnership: false, ownership: "personal" as const };

    it("drops the arrangement step when there is exactly one package", () => {
        expect(resolveCreateSteps({ ...personal, hasPackages: true, packageCount: 1 }))
            .toEqual(["details"]);
    });

    it("keeps it when there is a real choice", () => {
        expect(resolveCreateSteps({ ...personal, hasPackages: true, packageCount: 2 }))
            .toEqual(["details", "listing"]);
    });

    it("KEEPS it when the community publishes none", () => {
        /*
         * Not the same case, and collapsing the two would hide the answer.
         * Zero is "nothing published", not "nothing to decide" — the step is
         * where the seller learns the community proposes terms at review
         * instead, which is a fact about their money.
         */
        expect(resolveCreateSteps({ ...personal, hasPackages: false, packageCount: 0 }))
            .toEqual(["details", "listing"]);
    });

    it("keeps it while the answer is still unknown", () => {
        // Packages load after mount. Undefined means "not yet", and dropping a
        // step on a guess would remove it and then put it back.
        expect(resolveCreateSteps({ ...personal, hasPackages: false }))
            .toEqual(["details", "listing"]);
    });

    it("never affects a community-owned item, which has no arrangement at all", () => {
        expect(resolveCreateSteps({ canChooseOwnership: true, ownership: "community", packageCount: 1 }))
            .toEqual(["ownership", "details", "access"]);
    });
});

/**
 * The product-type step.
 *
 * Physical products are gated to one community while they are built, so the
 * step must not merely be disabled elsewhere — it must be ABSENT. A picker with
 * one option is not a question, and it advertises a feature nobody outside the
 * trial can use.
 *
 * `canChooseType` comes from `physicalProductsEnabled` on the community
 * payload, which the SERVER derives from the same allowlist that decides
 * whether createProduct will accept the type at all. So these two can never
 * disagree: the step cannot appear anywhere the answer would be refused.
 */
describe("the product-type step", () => {
    it("is absent when physical products are not available", () => {
        const steps = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal" });
        expect(steps).not.toContain("type");
    });

    it("defaults to absent when the caller says nothing", () => {
        // A caller that forgets the flag gets no step rather than a broken one.
        const steps = resolveCreateSteps({ canChooseOwnership: true, ownership: "community" });
        expect(steps).not.toContain("type");
    });

    it("appears when the community may create physical products", () => {
        const steps = resolveCreateSteps({
            canChooseOwnership: false, ownership: "personal", canChooseType: true,
        });
        expect(steps).toContain("type");
    });

    it("comes BEFORE details, because the answer changes what details asks", () => {
        const steps = resolveCreateSteps({
            canChooseOwnership: false, ownership: "personal", canChooseType: true,
        });
        expect(steps.indexOf("type")).toBeLessThan(steps.indexOf("details"));
    });

    it("comes after ownership — who is selling, then what", () => {
        const steps = resolveCreateSteps({
            canChooseOwnership: true, ownership: "community", canChooseType: true,
        });
        expect(steps.indexOf("ownership")).toBeLessThan(steps.indexOf("type"));
    });

    it("does not disturb the rest of the flow", () => {
        const base = resolveCreateSteps({ canChooseOwnership: true, ownership: "personal", packageCount: 2 });
        const withType = resolveCreateSteps({
            canChooseOwnership: true, ownership: "personal", packageCount: 2, canChooseType: true,
        });
        expect(withType.filter((s) => s !== "type")).toEqual(base);
    });

    it("has its own header copy rather than falling through to Access", () => {
        // The header lookup is a chain of ternaries ending in "Access". An
        // unhandled step silently renders the WRONG screen's title.
        expect(stepHeaderKeys("type")).toEqual({
            title: "stepTypeTitle", subtitle: "stepTypeSubtitle",
        });
    });
});

/**
 * The course wizard's syllabus step.
 *
 * `/learning/new` is a fork of the marketplace wizard with one extra step, and
 * these pin the two things that would make the fork wrong in ways nothing else
 * would notice: that the step lands in the right PLACE, and that it does not
 * appear in the flows that have nothing to put in it.
 */
describe("the content step", () => {
    const course = () => resolveCreateSteps({
        canChooseOwnership: false,
        ownership: "personal",
        packageCount: 2,
        withCommerceStep: true,
        withContentStep: true,
    });

    it("sits after commerce", () => {
        // Pricing is still part of describing what is being sold, and a lesson
        // is the thing sold.
        const steps = course();
        expect(steps.indexOf("commerce")).toBeLessThan(steps.indexOf("content"));
    });

    it("sits before the arrangement, which stays last", () => {
        /*
         * The user's rule, and the reason the step order is not a matter of
         * taste: the arrangement is the only step that decides what the seller
         * is PAID, so it is the last thing answered before the create.
         */
        const steps = course();
        expect(steps.indexOf("content")).toBeLessThan(steps.indexOf("listing"));
        expect(steps[steps.length - 1]).toBe("listing");
    });

    it("is absent from a product flow, which has nothing to put in it", () => {
        const product = resolveCreateSteps({
            canChooseOwnership: false, ownership: "personal", packageCount: 2, withCommerceStep: true,
        });
        expect(product).not.toContain("content");
    });

    it("is absent from an event flow", () => {
        const event = resolveCreateSteps({ canChooseOwnership: false, ownership: "personal", packageCount: 2 });
        expect(event).not.toContain("content");
    });

    it("changes nothing else about the flow", () => {
        // Adding a step must not reorder or drop the others.
        const base = resolveCreateSteps({
            canChooseOwnership: true, ownership: "community", withCommerceStep: true,
        });
        const withContent = resolveCreateSteps({
            canChooseOwnership: true, ownership: "community", withCommerceStep: true, withContentStep: true,
        });
        expect(withContent.filter((s) => s !== "content")).toEqual(base);
    });

    it("is still before access on a community-owned course", () => {
        const steps = resolveCreateSteps({
            canChooseOwnership: true, ownership: "community", withCommerceStep: true, withContentStep: true,
        });
        expect(steps.indexOf("content")).toBeLessThan(steps.indexOf("access"));
    });

    it("becomes the final step when the community publishes one arrangement", () => {
        /*
         * A sole package is not a choice, so that step does not exist and the
         * create moves onto content. Worth pinning: it is the case where the
         * new step inherits the commit buttons.
         */
        const steps = resolveCreateSteps({
            canChooseOwnership: false, ownership: "personal", packageCount: 1,
            withCommerceStep: true, withContentStep: true,
        });
        expect(steps).not.toContain("listing");
        expect(isFinalStep(steps, "content")).toBe(true);
    });

    it("has its own header copy rather than falling through to Access", () => {
        // The reason stepHeaderKeys is a Record now: as a ternary chain, any
        // step it did not name rendered the Access screen's title.
        expect(stepHeaderKeys("content")).toEqual({
            title: "stepContentTitle", subtitle: "stepContentSubtitle",
        });
    });
});
