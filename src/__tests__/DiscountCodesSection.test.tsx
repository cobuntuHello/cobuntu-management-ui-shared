/**
 * The Discount codes card and editor (backend docs/features/discount-codes.md,
 * Phase 3; approved design discount-codes-screens-v2.html, screens 1-4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiscountCodesSection } from "../discountCodes/DiscountCodesSection";
import { discountLabel, money, optionsSummary, suggestCode, usesLabel } from "../discountCodes/format";
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
  endsAt: "2026-12-15T00:00:00Z", maxRedemptions: 40, perBuyerLimit: null, isActive: true, archivedAt: null,
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
