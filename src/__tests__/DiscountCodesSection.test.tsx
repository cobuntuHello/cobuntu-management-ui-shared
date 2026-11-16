/**
 * The Discount codes card and editor (backend docs/features/discount-codes.md,
 * Phase 3; approved design discount-codes-screens-v2.html, screens 1-4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiscountCodesSection, changedFields } from "../discountCodes/DiscountCodesSection";
import { dateInputToIso, discountLabel, lastValidDay, money, optionsSummary, suggestCode, toLocalDateInput, usesLabel } from "../discountCodes/format";
import { MANAGEMENT_UI_MESSAGES_EN } from "../i18n/messages.en";

const EP = { apiBaseUrl: "", communityTag: "pbn", item: { kind: "event" as const, id: "e1" } };
const t = (key: string, v: Record<string, string | number> = {}) => {
  const msg = (MANAGEMENT_UI_MESSAGES_EN as any).shared.managementUi.discountCodes[key] as string;
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
};

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
}

const CODE = {
  id: "c1", code: "SUMMER20", mode: "PERCENT_OFF", value: 20, currency: null, tierIds: [], startsAt: null,
  // The end is exclusive: a code that works through 15 Dec ends at midnight after it.
  endsAt: "2026-12-16T00:00:00Z", maxRedemptions: 40, perBuyerLimit: null, isActive: true, archivedAt: null,
  uses: { used: 10, held: 2 }, lowestPrice: { amount: 5200, currency: "EUR", audience: "MEMBERS" },
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("format helpers", () => {
  it("prints money in the currency's own unit, dropping whole cents", () => {
    expect(money(22000, "EUR")).toBe("€220");
    expect(money(1250, "EUR")).toBe("€12.50");
    expect(money(1000, "JPY")).toBe("¥1,000");
  });
  it("labels, sums up and counts", () => {
    expect(discountLabel({ mode: "PERCENT_OFF", value: 20, currency: null }, t)).toBe("20% off");
    expect(discountLabel({ mode: "AMOUNT_OFF", value: 1000, currency: "EUR" }, t)).toBe("€10 off each");
    expect(optionsSummary({ tierIds: [], maxRedemptions: null, endsAt: null }, t, 2)).toBe("All · Unlimited · Always");
    expect(usesLabel({ uses: { used: 10, held: 2 }, maxRedemptions: 40 }, t)).toBe("12 of 40");
    expect(usesLabel({ uses: { used: 41, held: 0 }, maxRedemptions: null }, t)).toBe("41 used");
  });
  it("suggests a valid code from the item's name", () => {
    expect(suggestCode("Success Talks", 20)).toBe("SUCCESS20");
    expect(suggestCode("A b", 15)).toBe("SAVE15");
    expect(suggestCode("Café Noites", null, 0.5)).toMatch(/^CAFE\d{2}$/);
  });
});

describe("<DiscountCodesSection />", () => {
  it("renders nothing where codes are off for the community (the list answers 404)", async () => {
    fetchMock.mockReturnValueOnce(reply(404, { error: "Not found" }));
    const { container } = render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[]} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[data-testid=discount-codes]")).toBeNull());
  });

  it("shows the empty state, then the list with uses, the lowest price and the meter", async () => {
    fetchMock.mockReturnValueOnce(reply(200, { codes: [] }));
    const { unmount } = render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[]} />);
    expect(await screen.findByText("Reward people who share the word")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create a code" })).toBeTruthy();
    unmount();

    fetchMock.mockReturnValueOnce(reply(200, { codes: [CODE] }));
    render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[]} />);
    expect(await screen.findByText("SUMMER20")).toBeTruthy();
    expect(screen.getByText("12 of 40")).toBeTruthy();
    expect(screen.getByText(/20% off · members from €52 · until 15 Dec/)).toBeTruthy();
  });

  it("previews what buyers pay, and will not save a warned price until the tick", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith("/preview")) {
        return reply(200, {
          tiers: [{
            tierId: "t1", name: "Standard", currency: "EUR", listPrice: 27500, perInstalmentOf: null,
            everyone: { from: 27500, price: 22000, warnings: [] },
            members: [{ segmentId: "s1", segmentName: "Community members", communityName: "PBN", from: 6500, price: 5200, warnings: ["HALF_OR_MORE_OFF"] }],
          }],
          warnings: [{ tierId: "t1", tierName: "Standard", audience: "MEMBERS", segmentName: "Community members", warning: "HALF_OR_MORE_OFF" }],
          lowestPrice: { amount: 5200, currency: "EUR", audience: "MEMBERS" },
        });
      }
      if (init?.method === "POST") return reply(201, { code: CODE });
      return reply(200, { codes: [] });
    });
    render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[{ id: "t1", name: "Standard" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create a code" }));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(await screen.findByText("Standard, Community members")).toBeTruthy();
    expect(screen.getByText("81% off")).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create code" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(screen.getByText("I checked these prices"));
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([u, i]) => !String(u).endsWith("/preview") && (i as RequestInit)?.method === "POST");
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({ code: "SUCCESS20", mode: "PERCENT_OFF", value: 20, confirm: true });
    });
    vi.useRealTimers();
  });
});

describe("Phase 3 review fixes", () => {
  it("an end date is the last day the code works, in the seller's own time zone", () => {
    // Saved as the next local midnight (the backend's end is exclusive)...
    const end = dateInputToIso("2026-12-15", "end");
    expect(new Date(end).getTime() - new Date(dateInputToIso("2026-12-15", "start")).getTime()).toBe(24 * 3600 * 1000);
    // ...and shown back as the day picked, not the day after or (east of UTC) before.
    expect(toLocalDateInput(lastValidDay(end))).toBe("2026-12-15");
    expect(toLocalDateInput(dateInputToIso("2026-12-15", "start"))).toBe("2026-12-15");
    // Same start and end day: a one-day code, which ends after it starts.
    expect(new Date(dateInputToIso("2026-12-15", "end")) > new Date(dateInputToIso("2026-12-15", "start"))).toBe(true);
  });

  it("an edit sends only what changed, so a new end date on a used code is not new money terms", () => {
    const existing = CODE as any;
    const draft = { code: "SUMMER20", mode: "PERCENT_OFF" as const, value: 20, tierIds: [], startsAt: null, endsAt: "2027-01-01T00:00:00Z", maxRedemptions: 40, perBuyerLimit: null };
    expect(changedFields(existing, draft)).toEqual({ endsAt: "2027-01-01T00:00:00Z" });
    expect(changedFields(existing, { ...draft, endsAt: CODE.endsAt, value: 25 })).toEqual({ mode: "PERCENT_OFF", value: 25, tierIds: [] });
    expect(changedFields({ ...existing, tierIds: ["a", "b"] }, { ...draft, endsAt: CODE.endsAt, tierIds: ["b", "a"] })).toEqual({});
  });

  it("asks before archiving, and Keep code goes back", async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith("/preview")) return reply(200, { tiers: [], warnings: [], lowestPrice: null });
      if (init?.method === "DELETE") return reply(200, { code: { ...CODE, archivedAt: "x" } });
      return reply(200, { codes: [CODE] });
    });
    render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[]} />);
    fireEvent.click(await screen.findByText("SUMMER20"));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit)?.method === "DELETE")).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("can't be brought back");
    fireEvent.click(screen.getByRole("button", { name: "Keep code" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit)?.method === "DELETE")).toBe(true));
  });

  it("will not save before the preview for the terms on screen has answered", async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/preview")) return new Promise<Response>((res) => { answer = res; });
      return reply(200, { codes: [] });
    });
    render(<DiscountCodesSection endpoint={EP} itemName="Success Talks" tiers={[]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create a code" }));
    const create = screen.getByRole("button", { name: "Create code" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    await waitFor(() => expect(answer).toBeTypeOf("function"));
    await act(async () => { answer({ ok: true, status: 200, json: () => Promise.resolve({ tiers: [], warnings: [], lowestPrice: null }) } as Response); });
    await waitFor(() => expect(create.disabled).toBe(false));
  });

  it("an amount off is in the currency of the tiers it covers", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/preview")) return reply(200, { tiers: [], warnings: [], lowestPrice: null });
      return reply(200, { codes: [] });
    });
    render(<DiscountCodesSection endpoint={EP} itemName="Tokyo Night" currency="EUR" tiers={[{ id: "t1", name: "Standard", currency: "JPY" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create a code" }));
    fireEvent.click(screen.getByRole("radio", { name: "Amount off each" }));
    expect(screen.getByText("JPY off each")).toBeTruthy();
  });
});

