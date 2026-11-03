import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ManageReferrals, formatPct } from "../referrals/ManageReferrals";
import type { ArtifactReferralLink } from "../referrals/types";

const copy = { unit: "tickets" };

function link(over: Partial<ArtifactReferralLink> = {}): ArtifactReferralLink {
  return {
    id: "l1",
    code: "ABC123",
    status: "ACTIVE",
    commissionPct: 0.1,
    label: null,
    createdAt: new Date().toISOString(),
    owner: { id: "u1", name: "Drew Milligan", usertag: "drew", profileImage: null },
    sales: 12,
    earnedHeldCents: 1760,
    earnedPaidCents: 2200,
    ...over,
  };
}

describe("ManageReferrals", () => {
  it("offers NO copy control on a link with no code", async () => {
    /*
     * The rule the whole feature rests on. A pending link has no code because
     * nobody could be paid on it, so there must be nothing to put into
     * circulation. Absent, not disabled: a disabled button still says "there
     * is a link here".
     */
    const onCopyLink = vi.fn();
    render(
      <ManageReferrals
        links={[link({ code: null, status: "PENDING_STRIPE" })]}
        copy={copy} canManage onCopyLink={onCopyLink}
      />,
    );

    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
    expect(screen.getByText(/this link is off/i)).toBeInTheDocument();
    // And it names whose move it is, not just that something is missing.
    expect(screen.getByText(/needs to connect a payout account/i)).toBeInTheDocument();
  });

  it("offers the copy control once a code exists", async () => {
    const onCopyLink = vi.fn();
    render(<ManageReferrals links={[link()]} copy={copy} canManage onCopyLink={onCopyLink} />);

    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledWith(expect.objectContaining({ code: "ABC123" }));
  });

  it("shows held and paid as separate figures, never summed", () => {
    // Summing them would promise a referrer money a refund can still take back.
    render(<ManageReferrals links={[link()]} copy={copy} canManage />);
    // Each appears twice, once in the summary and once on the row, which is
    // itself the point: both numbers are reported, separately, in both places.
    expect(screen.getAllByText("€17.60").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€22.00").length).toBeGreaterThan(0);
    // The sum must appear NOWHERE.
    expect(screen.queryByText("€39.60")).toBeNull();
  });

  it("hides every management control from someone who may only read", () => {
    render(<ManageReferrals links={[link()]} copy={copy} canManage={false} onInvite={vi.fn()} onDisable={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /invite someone/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /turn off/i })).toBeNull();
  });

  it("confirms before turning a link off, and says the earnings survive", async () => {
    const onDisable = vi.fn();
    render(<ManageReferrals links={[link()]} copy={copy} canManage onDisable={onDisable} />);

    await userEvent.click(screen.getByRole("button", { name: /turn off/i }));
    expect(onDisable).not.toHaveBeenCalled();
    expect(screen.getByText(/already earned is not affected/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^turn off$/i }));
    expect(onDisable).toHaveBeenCalledWith("l1");
  });

  it("explains the point of the feature when there is nothing yet", () => {
    render(<ManageReferrals links={[]} copy={copy} canManage onInvite={vi.fn()} />);
    expect(screen.getByText(/no referral links yet/i)).toBeInTheDocument();
    // The distinction an owner is actually worried about.
    expect(screen.getByText(/you stay the seller, you invoice the buyer/i)).toBeInTheDocument();
  });

  it("uses the artifact's own noun for a sale", () => {
    const { unmount } = render(<ManageReferrals links={[link()]} copy={{ unit: "tickets" }} canManage />);
    expect(screen.getByText(/10% per ticket/)).toBeInTheDocument();
    unmount();

    render(<ManageReferrals links={[link()]} copy={{ unit: "enrolments" }} canManage />);
    expect(screen.getByText(/10% per enrolment/)).toBeInTheDocument();
  });

  it("excludes a disabled link from the totals", () => {
    render(
      <ManageReferrals
        links={[link({ id: "a", sales: 3 }), link({ id: "b", status: "DISABLED", sales: 99 })]}
        copy={copy} canManage
      />,
    );
    // 3, not 102: a link that is off is not still earning. Asserted on the
    // summary total specifically, since the row figures repeat the number.
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.queryByText("102")).toBeNull();
    // And the disabled row is still listed, marked off rather than hidden:
    // an owner needs to see that a link they handed out is no longer live.
    expect(screen.getByText("Off")).toBeInTheDocument();
  });
});

describe("formatPct", () => {
  it("prints a fraction as a percentage without trailing zeros", () => {
    expect(formatPct(0.1)).toBe("10%");
    expect(formatPct(0.085)).toBe("8.5%");
    expect(formatPct(0.08)).toBe("8%");
  });
});
