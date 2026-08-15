import { describe, it, expect } from "vitest";
import { resolveSubmitActions, willAutoApprove } from "../lib/submitActions";

/**
 * The button set follows whether a listing was asked for, and then the state
 * that listing will LAND IN. Never the role of the person creating it.
 *
 * That distinction is the whole point. Role-based would need a special case
 * for the admin app, and would get the interesting case wrong: a plain member
 * in a community that has switched review off IS auto-approved, and telling
 * them their listing is "awaiting review" would be a lie the backend
 * immediately contradicts.
 *
 * `wantsListing` sits above all of it: a seller who declined a listing has no
 * community in the picture at all, so neither the policy nor the role has
 * anything to say about their button.
 */

const member = { canSelfList: false, feeModel: "FLAT" as const, requireApproval: true };

describe("who gets both buttons", () => {
  it("a create-permission holder, always", () => {
    // The member policy governs MEMBER submissions. Theirs is not one, so
    // even DYNAMIC + review-on leaves them self-listing.
    for (const feeModel of ["FLAT", "DYNAMIC", null] as const) {
      for (const requireApproval of [true, false]) {
        expect(willAutoApprove({ canSelfList: true, feeModel, requireApproval })).toBe(true);
      }
    }
  });

  it("a member where the community has switched review off", () => {
    expect(willAutoApprove({ ...member, requireApproval: false })).toBe(true);
    const actions = resolveSubmitActions({ ...member, requireApproval: false });
    expect(actions.map((a) => a.kind)).toEqual(["save", "savePublish"]);
  });

  it("offers Save off-shelf and Save & Publish on-shelf", () => {
    const actions = resolveSubmitActions({ canSelfList: true, feeModel: null, requireApproval: true });
    expect(actions.find((a) => a.kind === "save")!.publish).toBe(false);
    expect(actions.find((a) => a.kind === "savePublish")!.publish).toBe(true);
  });

  it("makes Save & Publish the primary action", () => {
    // Someone who just filled in a whole form usually means to put it live.
    const actions = resolveSubmitActions({ canSelfList: true, feeModel: null, requireApproval: true });
    expect(actions.filter((a) => a.primary)).toHaveLength(1);
    expect(actions.find((a) => a.primary)!.kind).toBe("savePublish");
  });
});

describe("who gets one button", () => {
  it("a member in a community that reviews submissions", () => {
    const actions = resolveSubmitActions({ ...member, wantsListing: true });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("createRequest");
    expect(actions[0].label).toBe("Create & Request Listing");
  });

  it("a member under DYNAMIC, even with review nominally off", () => {
    /*
     * DYNAMIC means the commission comes from a proposal, so there is no rate
     * to charge until someone agrees one — the negotiation IS the approval.
     * The backend refuses to store DYNAMIC with approval off for that reason,
     * so this combination should not exist; if it ever reaches us we must
     * still not promise a publish the backend will not perform.
     */
    expect(willAutoApprove({ canSelfList: false, feeModel: "DYNAMIC", requireApproval: false })).toBe(false);
    expect(resolveSubmitActions({ canSelfList: false, feeModel: "DYNAMIC", requireApproval: false })[0].kind)
      .toBe("saveRequest");
  });

  it("never carries a publish flag", () => {
    // Nothing to publish — the row lands PENDING and the backend ignores the
    // flag there anyway. Sending it would just be noise.
    expect(resolveSubmitActions(member)[0].publish).toBeUndefined();
  });
});

describe("when the seller declines a listing", () => {
  /*
   * The Listing step's other answer. It is not a draft and not a failure: the
   * item is created, it simply has no listing anywhere yet, so the button must
   * not mention review, publishing or a shelf.
   */
  it("offers Create, and only Create", () => {
    const actions = resolveSubmitActions({ ...member, wantsListing: false });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("create");
    expect(actions[0].label).toBe("Create");
    expect(actions[0].primary).toBe(true);
  });

  it("carries no publish flag, because there is no listing to publish", () => {
    expect(resolveSubmitActions({ ...member, wantsListing: false })[0].publish).toBeUndefined();
  });

  it("outranks the community's policy, whatever it is", () => {
    // The policy governs listings. This item is not getting one.
    for (const feeModel of ["FLAT", "DYNAMIC", null] as const) {
      for (const requireApproval of [true, false]) {
        expect(
          resolveSubmitActions({ canSelfList: false, feeModel, requireApproval, wantsListing: false })
            .map((a) => a.kind),
        ).toEqual(["create"]);
      }
    }
  });

  it("outranks auto-approval too — a leader gets no Save & Publish either", () => {
    /*
     * The interesting case. A leader creating something PERSONAL still answers
     * the Listing step, and `willAutoApprove` is true for them, so without the
     * early return they would be offered "Save & Publish" for a shelf that
     * does not exist.
     */
    expect(willAutoApprove({ canSelfList: true, feeModel: "FLAT", requireApproval: true })).toBe(true);
    expect(
      resolveSubmitActions({ canSelfList: true, feeModel: "FLAT", requireApproval: true, wantsListing: false })
        .map((a) => a.kind),
    ).toEqual(["create"]);
  });

  it("still offers both buttons when they DID ask and are auto-approved", () => {
    // Asking for a listing changes nothing about who owns the shelf decision.
    expect(
      resolveSubmitActions({ ...member, requireApproval: false, wantsListing: true }).map((a) => a.kind),
    ).toEqual(["save", "savePublish"]);
  });
});

describe("a caller that never asks the listing question", () => {
  /*
   * The admin backoffice, and anything else written before the Listing step
   * existed. Omitting the field must leave the buttons exactly as they were,
   * or bumping this package silently rewords a surface nobody touched.
   */
  it("keeps Save & Request Listing", () => {
    const actions = resolveSubmitActions(member);
    expect(actions.map((a) => a.kind)).toEqual(["saveRequest"]);
    expect(actions[0].label).toBe("Save & Request Listing");
  });

  it("keeps both buttons where it had both", () => {
    expect(
      resolveSubmitActions({ canSelfList: true, feeModel: "DYNAMIC", requireApproval: true }).map((a) => a.kind),
    ).toEqual(["save", "savePublish"]);
  });
});

describe("the admin app needs no special case", () => {
  it("resolves to both buttons through the ordinary rule", () => {
    // A backoffice user necessarily holds the create permission, so they fall
    // out of the same rule everyone else runs. No hardcode, nothing to drift.
    const actions = resolveSubmitActions({ canSelfList: true, feeModel: "DYNAMIC", requireApproval: true });
    expect(actions.map((a) => a.kind)).toEqual(["save", "savePublish"]);
  });
});
