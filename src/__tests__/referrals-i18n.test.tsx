/**
 * The referral window and the Referrals tab speak the host's language.
 *
 * Both were hardcoded English: Impact Hub Porto's host, whose app is in
 * Portuguese, got "Invite someone to promote this", "Person", "Nobody found"
 * and the rest in English (2026-11-27). Every string now goes through
 * useSharedT("shared.managementUi.referrals"), which the community app answers
 * from its messages/<locale>.json; a host with no provider keeps the English.
 */
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ManagementCopyProvider, formatMessage } from "../i18n";
import { MANAGEMENT_UI_MESSAGES_EN, flattenMessageKeys } from "../i18n/messages.en";
import { InviteReferrerModal } from "../referrals/InviteReferrerModal";
import { ManageReferrals } from "../referrals/ManageReferrals";
import type { ArtifactReferralLink } from "../referrals/types";

vi.mock("../lib/searchPeople", async () => {
  const actual = await vi.importActual<typeof import("../lib/searchPeople")>("../lib/searchPeople");
  return { ...actual, searchPeople: vi.fn(async () => []) };
});

/** A host translator that marks every key it is asked for. */
const asked: string[] = [];
const mark = (key: string) => { asked.push(key); return `T:${key}`; };

const link = (over: Partial<ArtifactReferralLink> = {}): ArtifactReferralLink => ({
  id: "l1", code: "abc", status: "ACTIVE", commissionPct: 0.08, label: null,
  owner: { id: "u1", name: "Art", usertag: "art", profileImage: null },
  sales: 2, earnedHeldCents: 480, earnedPaidCents: 0,
  ...over,
} as ArtifactReferralLink);

describe("the referral window and tab use the host's translations", () => {
  it("the invite window asks for every word by key, none left in English", () => {
    render(
      <ManagementCopyProvider t={mark}>
        <InviteReferrerModal isOpen onClose={() => {}} apiBaseUrl="" authHeaders={() => ({})} communityTag="impact-hub-porto"
          unit="tickets" priceCents={3000} onInvite={async () => {}} />
      </ManagementCopyProvider>,
    );
    expect(screen.getByText("T:shared.managementUi.referrals.inviteTitle")).toBeTruthy();
    expect(screen.getByText("T:shared.managementUi.referrals.theirShare")).toBeTruthy();
    expect(screen.getByText("T:shared.managementUi.referrals.payoutNote")).toBeTruthy();
    for (const english of ["Invite someone to promote this", "Person", "Their share", "Send invite", "Only you see this."]) {
      expect(screen.queryByText(english)).toBeNull();
    }
  });

  it("the tab asks for every word by key, a link row and the empty state alike", () => {
    const { unmount } = render(
      <ManagementCopyProvider t={mark}>
        <ManageReferrals links={[link(), link({ id: "l2", status: "PENDING_STRIPE" })]} copy={{ unit: "tickets" }} canManage onInvite={() => {}} onDisable={() => {}} onCopyLink={() => {}} />
      </ManagementCopyProvider>,
    );
    expect(screen.getByText("T:shared.managementUi.referrals.title")).toBeTruthy();
    expect(screen.getByText("T:shared.managementUi.referrals.linkOffTitle")).toBeTruthy();
    expect(screen.queryByText("Referral links")).toBeNull();
    expect(screen.queryByText("Active links")).toBeNull();
    unmount();

    render(
      <ManagementCopyProvider t={mark}>
        <ManageReferrals links={[]} copy={{ unit: "tickets" }} canManage onInvite={() => {}} />
      </ManagementCopyProvider>,
    );
    expect(screen.getByText("T:shared.managementUi.referrals.emptyTitle")).toBeTruthy();
    expect(screen.queryByText("No referral links yet")).toBeNull();
  });

  it("every key they ask for exists in the package's English (what hosts translate from)", () => {
    const known = new Set(flattenMessageKeys(MANAGEMENT_UI_MESSAGES_EN));
    const used = [...new Set(asked.filter((k) => k.startsWith("shared.managementUi.referrals.")))];
    expect(used.length).toBeGreaterThan(20);
    expect(used.filter((k) => !known.has(k))).toEqual([]);
  });

  it("each item kind gets its own whole sentence in the English", () => {
    const r = MANAGEMENT_UI_MESSAGES_EN.shared.managementUi.referrals;
    expect(formatMessage(r.pctOfEach, { unit: "tickets" })).toBe("% of each ticket");
    expect(formatMessage(r.pctOfEach, { unit: "enrolments" })).toBe("% of each enrolment");
    expect(formatMessage(r.pctOfEach, { unit: "purchases" })).toBe("% of each purchase");
    expect(formatMessage(r.perUnit, { unit: "tickets", pct: "8%" })).toBe("8% per ticket");
    expect(formatMessage(r.earnPerPrice, { unit: "tickets", amount: "€2.40", price: "€30.00" })).toBe("They earn €2.40 per €30.00 ticket.");
    expect(formatMessage(r.turnOffNote, { unit: "tickets", name: "Art" })).toBe("Art’s link stops recording new tickets. Commission they have already earned is not affected.");
  });
});
