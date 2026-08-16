import { describe, it, expect } from "vitest";
import { resolveSubmitActions, willAutoApprove } from "../lib/submitActions";

/**
 * Two buttons, always: make it, or make it and put it on a shelf.
 *
 * ── What this file used to assert, and why it changed ───────────────────────
 *
 * The button SET used to vary by policy: one button for a member awaiting
 * review, two ("Save" / "Save & Publish") for anyone auto-approved, and a lone
 * "Create" when a separate wizard step had asked whether to list at all.
 *
 * That step is gone, because it asked the same question the buttons answer.
 * The wizard could contradict itself as a result: its cards said "just create
 * it for now" while the only button on the bar said "Request Listing".
 *
 * So the pair is now constant and only the SECOND label moves, on one fact:
 * can this person put it on the shelf themselves, or must they ask? That is
 * still a property of where the listing LANDS, never of the person's title --
 * which is what keeps the admin app working through the ordinary rule instead
 * of a special case, and what stops a member in a community that has switched
 * review off being told they are awaiting one.
 */

const member = { canSelfList: false, feeModel: "FLAT" as const, requireApproval: true };
const kinds = (input: Parameters<typeof resolveSubmitActions>[0]) =>
  resolveSubmitActions(input).map((a) => a.kind);

describe("every flow gets the same pair", () => {
  it("a member awaiting review", () => {
    expect(kinds(member)).toEqual(["create", "createRequest"]);
  });

  it("a member where the community has switched review off", () => {
    expect(kinds({ ...member, requireApproval: false })).toEqual(["create", "createList"]);
  });

  it("a create-permission holder", () => {
    expect(kinds({ ...member, canSelfList: true })).toEqual(["create", "createList"]);
  });

  it("a member under DYNAMIC, even with review nominally off", () => {
    // The negotiation IS the approval, so there is still somebody to ask.
    expect(kinds({ ...member, feeModel: "DYNAMIC", requireApproval: false }))
      .toEqual(["create", "createRequest"]);
  });

  it("the admin app, through the ordinary rule", () => {
    // A backoffice user necessarily holds the create permission, so they
    // resolve to List from the same rule everyone else runs. No special case.
    expect(kinds({ canSelfList: true, feeModel: null, requireApproval: false }))
      .toEqual(["create", "createList"]);
  });
});

describe("Create is the same act in every flow", () => {
  const everyFlow = [
    { name: "member, reviewed", input: member },
    { name: "member, auto-approved", input: { ...member, requireApproval: false } },
    { name: "leader", input: { ...member, canSelfList: true } },
  ];

  it.each(everyFlow)("$name: Create asks for no listing", ({ input }) => {
    /*
     * The claim worth pinning, because it is the one people assume differs: a
     * leader's Create and a member's Create do exactly the same thing. The
     * item is made, listed nowhere, visible only to its owner. Being a leader
     * changes what the OTHER button does, not this one.
     */
    const [create] = resolveSubmitActions(input);
    expect(create.kind).toBe("create");
    expect(create.requestListing).toBe(false);
    // No publish flag: that is a listing's state, and this makes no listing.
    expect(create.publish).toBeUndefined();
  });

  it.each(everyFlow)("$name: Create is never the primary action", ({ input }) => {
    // Someone who has just filled in a whole form usually means to put the
    // thing somewhere; burying that behind the quieter button would be the
    // papercut this replaces.
    const [create] = resolveSubmitActions(input);
    expect(create.primary).toBe(false);
  });
});

describe("the second button says what will actually happen", () => {
  it("lists immediately when the person can approve their own", () => {
    const [, second] = resolveSubmitActions({ ...member, canSelfList: true });
    expect(second.label).toBe("Create & List");
    expect(second.publish).toBe(true);
    expect(second.requestListing).toBe(true);
    expect(second.primary).toBe(true);
  });

  it("asks when somebody else decides", () => {
    const [, second] = resolveSubmitActions(member);
    expect(second.label).toBe("Create & Request Listing");
    expect(second.requestListing).toBe(true);
    /*
     * publish false: there is nothing to publish on a row that lands PENDING.
     * The backend ignores it there, but sending true would misdescribe the
     * intent in the request log.
     */
    expect(second.publish).toBe(false);
  });

  it("says List, not Publish", () => {
    /*
     * "Publish" describes a shelf appearing from nowhere. Listing is the word
     * this domain uses everywhere else -- listing requests, the Listings tab,
     * community_listings -- and the act really is putting it on a shelf.
     */
    const labels = resolveSubmitActions({ ...member, canSelfList: true }).map((a) => a.label);
    expect(labels.join(" ")).not.toMatch(/publish/i);
  });
});

describe("exactly one primary, always", () => {
  it.each([
    member,
    { ...member, requireApproval: false },
    { ...member, canSelfList: true },
    { ...member, feeModel: "DYNAMIC" as const, requireApproval: false },
  ])("%#", (input) => {
    expect(resolveSubmitActions(input).filter((a) => a.primary)).toHaveLength(1);
  });
});

describe("willAutoApprove", () => {
  it("is true for a create-permission holder whatever the policy says", () => {
    expect(willAutoApprove({ ...member, canSelfList: true })).toBe(true);
    expect(willAutoApprove({ ...member, canSelfList: true, feeModel: "DYNAMIC" })).toBe(true);
  });

  it("is false under DYNAMIC for a member: the negotiation is the approval", () => {
    expect(willAutoApprove({ ...member, feeModel: "DYNAMIC", requireApproval: false })).toBe(false);
  });

  it("follows the community's own switch otherwise", () => {
    expect(willAutoApprove({ ...member, requireApproval: false })).toBe(true);
    expect(willAutoApprove(member)).toBe(false);
  });
});
