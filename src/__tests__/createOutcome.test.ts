import { describe, it, expect } from "vitest";
import {
  resolveCreateOutcome,
  primaryDestination,
} from "../create/createOutcome";

/**
 * What just happened, and where that means we should go.
 *
 * The failure this prevents is silent and reassuring, which is the worst
 * combination: telling a member their listing is LIVE when it is sitting in a
 * review queue. `publish: true` is a request, not a result.
 */

describe("the outcome is not the button", () => {
  it("publishes when someone who can self-list asks to publish", () => {
    expect(resolveCreateOutcome({ requestedPublish: true, canSelfList: true }))
      .toBe("published");
  });

  it("saves off-shelf when they deliberately did not publish", () => {
    expect(resolveCreateOutcome({ requestedPublish: false, canSelfList: true }))
      .toBe("saved");
  });

  it("is PENDING for a member, even when they asked to publish", () => {
    /*
     * The whole point. A member pressing "Save & Request Listing" asked for it
     * to go up; the community decides when. Reading the button alone would
     * report "published" over a listing nobody can see yet.
     */
    expect(resolveCreateOutcome({ requestedPublish: true, canSelfList: false }))
      .toBe("pending");
  });

  it("is PENDING for a member who did not ask to publish either", () => {
    // Their submission still enters the queue; there is no off-shelf draft
    // state to land in that a leader would not have to review anyway.
    expect(resolveCreateOutcome({ requestedPublish: false, canSelfList: false }))
      .toBe("pending");
  });
});

describe("nobody was asked to carry it", () => {
  /*
   * The fourth ending, and the one that had no representation at all: the
   * Listing step's "just create it for now". Without it every such creation
   * resolved to "pending" and the modal offered "Follow the review" for a
   * review nobody had requested.
   *
   * That link was not dead only because of a SECOND bug — the server filed a
   * listing regardless of the answer — so the two defects concealed each other.
   * Fixing the server first would have turned the link into a route to nowhere,
   * which is why these two cases belong in the same change.
   */
  it("is UNLISTED when they asked no community, whatever else they pressed", () => {
    for (const requestedPublish of [true, false]) {
      for (const canSelfList of [true, false]) {
        expect(resolveCreateOutcome({ requestedPublish, canSelfList, requestedListing: false }))
          .toBe("unlisted");
      }
    }
  });

  it("is unaffected when the question was never asked", () => {
    /*
     * `undefined` is not `false`. The admin app never shows the Listing step,
     * and neither did this app before it existed — both send nothing and must
     * keep the behaviour they were written against. A truthiness check here
     * would silently reclassify every one of those as unlisted.
     */
    expect(resolveCreateOutcome({ requestedPublish: true, canSelfList: true, requestedListing: undefined }))
      .toBe("published");
    expect(resolveCreateOutcome({ requestedPublish: false, canSelfList: false }))
      .toBe("pending");
  });

  it("still lists when they said yes", () => {
    expect(resolveCreateOutcome({ requestedPublish: true, canSelfList: false, requestedListing: true }))
      .toBe("pending");
  });
});

describe("which destination leads", () => {
  it("sends a live listing to its public page", () => {
    // Only a published listing has something worth looking at.
    expect(primaryDestination("published")).toBe("view");
  });

  it("sends a saved draft to manage, where Publish lives", () => {
    /*
     * The bug this replaces: an unconditional push to the detail page, which
     * after Save shows a listing nobody can see and offers no route to the
     * button that would change that.
     */
    expect(primaryDestination("saved")).toBe("manage");
  });

  it("sends a pending submission to manage, where the status lives", () => {
    expect(primaryDestination("pending")).toBe("manage");
  });

  it("sends an unlisted item to manage, where it can be offered to a community", () => {
    // Nothing is in motion for this one: no review to watch, no shelf to be on
    // or off. Manage is where the next move actually lives.
    expect(primaryDestination("unlisted")).toBe("manage");
  });

  it("never leads with view for anything unpublished", () => {
    for (const outcome of ["saved", "pending", "unlisted"] as const) {
      expect(primaryDestination(outcome)).not.toBe("view");
    }
  });
});
