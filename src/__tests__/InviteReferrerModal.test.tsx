import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InviteReferrerModal } from "../referrals/InviteReferrerModal";

vi.mock("../lib/searchPeople", async () => {
  const actual = await vi.importActual<typeof import("../lib/searchPeople")>("../lib/searchPeople");
  return {
    ...actual,
    searchPeople: vi.fn(async () => ([
      { id: "u-drew", name: "Drew Milligan", usertag: "drew", profileImage: null },
    ])),
  };
});

const base = {
  isOpen: true,
  onClose: vi.fn(),
  apiBaseUrl: "https://api.test",
  authHeaders: () => ({}),
  communityTag: "pathseekers",
  unit: "tickets",
};

beforeEach(() => { vi.clearAllMocks(); });

/*
 * ActionModalShell renders a desktop dialog AND a mobile sheet, one of which
 * is hidden from the accessibility tree -- so getByRole finds neither and
 * getAllBy returns two. Query by TEXT and take the first; which of the two
 * variants is visible is the shell's business, not this component's.
 */
async function pickDrew() {
  await userEvent.type(screen.getAllByPlaceholderText(/search by name/i)[0]!, "drew");
  await waitFor(() => expect(screen.getAllByText("Drew Milligan").length).toBeGreaterThan(0));
  await userEvent.click(screen.getAllByText("Drew Milligan")[0]!);
}

describe("InviteReferrerModal", () => {
  it("cannot be submitted until BOTH a person and a rate are given", async () => {
    render(<InviteReferrerModal {...base} onInvite={vi.fn()} />);
    const send = () => screen.getAllByRole("button", { name: /send invite/i })[0]!;

    expect(send()).toBeDisabled();
    await pickDrew();
    expect(send()).toBeDisabled();            // person alone is not enough

    await userEvent.type(screen.getAllByPlaceholderText("10")[0]!, "10");
    expect(send()).toBeEnabled();
  });

  it("starts with an EMPTY rate, never a prefilled default", () => {
    // A prefilled rate gets accepted without being read, and it costs the
    // owner on every sale. Founder decision: typed every time.
    render(<InviteReferrerModal {...base} onInvite={vi.fn()} />);
    expect(screen.getAllByPlaceholderText("10")[0]!).toHaveValue("");
  });

  it("submits the rate as a FRACTION, which is how it is stored", async () => {
    const onInvite = vi.fn(async () => {});
    render(<InviteReferrerModal {...base} onInvite={onInvite} />);

    await pickDrew();
    await userEvent.type(screen.getAllByPlaceholderText("10")[0]!, "8.5");
    await userEvent.click(screen.getAllByRole("button", { name: /send invite/i })[0]!);

    await waitFor(() => expect(onInvite).toHaveBeenCalledWith({
      ownerUserId: "u-drew", commissionPct: 0.085, label: null,
    }));
  });

  it("shows what the rate is worth in money, because an owner decides in euros", async () => {
    render(<InviteReferrerModal {...base} priceCents={2200} currency="EUR" onInvite={vi.fn()} />);
    await pickDrew();
    await userEvent.type(screen.getAllByPlaceholderText("10")[0]!, "10");

    expect(screen.getAllByText(/€2\.20 to them per ticket/)[0]!).toBeInTheDocument();
  });

  it("rejects a rate of 0 or 100 and over", async () => {
    render(<InviteReferrerModal {...base} onInvite={vi.fn()} />);
    await pickDrew();
    const field = screen.getAllByPlaceholderText("10")[0]!;

    await userEvent.type(field, "0");
    expect(screen.getAllByRole("button", { name: /send invite/i })[0]!).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, "100");
    expect(screen.getAllByRole("button", { name: /send invite/i })[0]!).toBeDisabled();
  });

  it("warns about the payout account BEFORE the invite is sent", () => {
    // Not after. An owner who assigns a link, tells someone to share it, and
    // learns days later that nothing was tracked has lost real sales.
    render(<InviteReferrerModal {...base} onInvite={vi.fn()} />);
    expect(screen.getAllByText(/the link stays off and records nothing/i)[0]!).toBeInTheDocument();
  });

  it("surfaces a failure instead of closing silently", async () => {
    const onInvite = vi.fn(async () => { throw new Error("That person already has a link here."); });
    const onClose = vi.fn();
    render(<InviteReferrerModal {...base} onClose={onClose} onInvite={onInvite} />);

    await pickDrew();
    await userEvent.type(screen.getAllByPlaceholderText("10")[0]!, "10");
    await userEvent.click(screen.getAllByRole("button", { name: /send invite/i })[0]!);

    await waitFor(() => expect(screen.getAllByRole("alert")[0]!).toHaveTextContent(/already has a link/i));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes the artifact's seller to the search as excluded, so they cannot refer themselves", async () => {
    const { searchPeople } = await import("../lib/searchPeople");
    render(<InviteReferrerModal {...base} currentUserId="u-seller" onInvite={vi.fn()} />);
    await userEvent.type(screen.getAllByPlaceholderText(/search by name/i)[0]!, "dre");

    await waitFor(() => expect(searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({ excludeUserIds: expect.arrayContaining(["u-seller"]) }),
    ));
  });
});
