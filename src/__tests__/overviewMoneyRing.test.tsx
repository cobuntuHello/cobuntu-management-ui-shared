/**
 * "Where the money goes" before the first sale (option A, 25 Nov 2026).
 *
 * The card used to show a row of zeros until something sold. Now the backend
 * sends ONE sale's split through the item's one live listing (`oneSale`), and
 * the card says "Impact Hub gets €32.96 of every €36.90". A free item gets a
 * single line instead. Figures are Food for Thought #1's €36.90 ticket
 * through PBN, as finances split it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PayoutsAndFees, ringName } from "../overview/PayoutsAndFees";
import { defaultTranslate } from "../listings/copy";
import type { OverviewMoney } from "../overview/types";

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);
const cash = (cents: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);

const zero = { vat: 0, stripe: 0, cobuntu: 0, community: 0, communityCut: 0, net: 0 };
const oneSale = { gross: 3690, vat: 690, stripe: 80, cobuntu: 74, community: 240, communityCut: 0, net: 3296 };

const money = (over: Partial<OverviewMoney> = {}): OverviewMoney => ({
    net: 0, gross: 0, held: 0, due: 0, paid: 0, nextPayoutAt: null, currency: "EUR",
    breakdown: zero, oneSale, free: false,
    ...over,
});

const impactHub = { kind: "community" as const, name: "Impact Hub", imageUrl: "https://img/ih.png" };
const pbn = { kind: "community" as const, name: "PBN", imageUrl: "https://img/pbn.png" };
const notConnected = { scope: "community" as const, connected: false, payoutsEnabled: false, bankBrand: null, last4: null, country: null, currency: null };

afterEach(() => cleanup());

describe("before the first sale, one sale's split", () => {
    const renderTicket = (over: Partial<OverviewMoney> = {}) =>
        render(
            <PayoutsAndFees
                money={money(over)}
                ownership="community"
                rates={{ cobuntuPct: null, communityPct: 8 }}
                destination={notConnected}
                t={t}
                cash={cash}
                owner={impactHub}
                broker={pbn}
                connectStripeHref="/ihp/connect-stripe"
                kind="event"
                sold={0}
            />,
        );

    it("says what the owner gets of every ticket, by name", () => {
        renderTicket();
        expect(screen.getByText("Nothing sold yet")).toBeInTheDocument();
        expect(screen.getByText("Impact Hub gets")).toBeInTheDocument();
        expect(screen.getAllByText("€32.96").length).toBe(2); // the ring's centre and the owner's line
        expect(screen.getByText("of every €36.90")).toBeInTheDocument();
        expect(screen.getByText("On every €36.90 ticket")).toBeInTheDocument();
    });

    it("names every party with its share of one ticket", () => {
        renderTicket();
        expect(screen.getByText("Impact Hub keeps")).toBeInTheDocument();
        expect(screen.getByText("Includes €6.90 VAT, theirs to declare")).toBeInTheDocument();
        expect(screen.getByText("PBN’s commission")).toBeInTheDocument();
        expect(screen.getByText("8% of the price before VAT")).toBeInTheDocument();
        expect(screen.getByText("€2.40")).toBeInTheDocument();
        expect(screen.getByText("€0.74")).toBeInTheDocument();
        // One sale's Stripe fee depends on the card, so it is said as an estimate.
        expect(screen.getByText("≈ €0.80")).toBeInTheDocument();
        expect(screen.getByText("89%")).toBeInTheDocument();
        expect(screen.getByText("6.5%")).toBeInTheDocument();
    });

    it("draws one arc per party in the ring", () => {
        const { container } = renderTicket();
        const arcs = [...container.querySelectorAll("[data-arc]")].map((c) => c.getAttribute("data-arc"));
        expect(arcs).toEqual(["net", "community", "cobuntu", "stripe"]);
        expect(screen.getByRole("img", { name: /^On every €36\.90: Impact Hub keeps €32\.96/ })).toBeInTheDocument();
    });

    it("asks the owner's leaders to connect Stripe, saying when ticket money goes out", () => {
        const { container } = renderTicket();
        expect(screen.getByText("Connect Stripe so Impact Hub gets paid")).toBeInTheDocument();
        expect(screen.getByText("Ticket money goes out the day after the event, to the account you connect.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Connect Stripe" })).toHaveAttribute("href", "/ihp/connect-stripe");
        expect(container.querySelector('[data-tone="amber"]')).not.toBeNull();
    });

    it("speaks to a member seller as you, and calls a product a sale", () => {
        render(
            <PayoutsAndFees
                money={money()}
                ownership="member"
                rates={{ cobuntuPct: null, communityPct: 8 }}
                destination={{ ...notConnected, scope: "user" }}
                t={t}
                cash={cash}
                owner={{ kind: "user", name: "Thiago Vieira", imageUrl: null }}
                broker={pbn}
                connectStripeHref="/my-payouts/onboard"
                kind="product"
            />,
        );
        expect(screen.getByText("You get")).toBeInTheDocument();
        expect(screen.getByText("You keep")).toBeInTheDocument();
        expect(screen.getByText("Includes €6.90 VAT, yours to declare")).toBeInTheDocument();
        expect(screen.getByText("On every €36.90 sale")).toBeInTheDocument();
        expect(screen.getByText("Connect Stripe to get paid")).toBeInTheDocument();
        expect(screen.getByText("Sale money goes out to the account you connect.")).toBeInTheDocument();
        expect(screen.queryByText(/Thiago Vieira (gets|keeps)/)).toBeNull();
    });

    it("leaves the example out once something sold", () => {
        render(
            <PayoutsAndFees
                money={money({ net: 3296, gross: 3690, breakdown: { ...oneSale, gross: undefined } as any })}
                ownership="community"
                rates={{ cobuntuPct: null, communityPct: 8 }}
                destination={notConnected}
                t={t}
                cash={cash}
                owner={impactHub}
                broker={pbn}
                kind="event"
                sold={1}
            />,
        );
        expect(screen.getByText("Impact Hub got")).toBeInTheDocument();
        expect(screen.getByText("€36.90 taken · 1 ticket")).toBeInTheDocument();
        expect(screen.getByText("So far · 1 ticket")).toBeInTheDocument();
        expect(screen.queryByText(/On every/)).toBeNull();
        expect(screen.queryByText(/≈/)).toBeNull();
    });
});

describe("the ring's centre, with a long community name", () => {
    const renderOwner = (name: string) =>
        render(
            <PayoutsAndFees
                money={money()}
                ownership="community"
                destination={notConnected}
                t={t}
                cash={cash}
                owner={{ kind: "community", name, imageUrl: null }}
                kind="event"
            />,
        );

    it("takes the brand before a tagline, and names them in full beside the ring", () => {
        // Seen live on PBN's Business Talks #61: the full name ran into the ring.
        const { container } = renderOwner("PBN | Porto Business Network");
        expect(container.querySelector("[data-ring-label]")?.textContent).toBe("PBN gets");
        expect(screen.getByText("PBN | Porto Business Network keeps")).toBeInTheDocument();
    });

    it("leaves a name with no short form out of the centre", () => {
        const { container } = renderOwner("Associação Empresarial do Norte de Portugal");
        expect(container.querySelector("[data-ring-label]")?.textContent).toBe("Keeps");
        expect(screen.getByText("Associação Empresarial do Norte de Portugal keeps")).toBeInTheDocument();
    });

    it("keeps a short name whole", () => {
        const { container } = renderOwner("Impact Hub");
        expect(container.querySelector("[data-ring-label]")?.textContent).toBe("Impact Hub gets");
    });
});

describe("ringName", () => {
    it("splits on a bar, a middle dot or a spaced dash, never inside a word", () => {
        expect(ringName("PBN | Porto Business Network")).toBe("PBN");
        expect(ringName("Impact Hub - Porto")).toBe("Impact Hub");
        expect(ringName("TEJÁ · Casa")).toBe("TEJÁ");
        expect(ringName("Coimbra-Connect")).toBe("Coimbra-Connect");
        expect(ringName("A name that is far too long to fit")).toBeNull();
    });
});

describe("a free item", () => {
    it("says so in one line instead of splitting nothing", () => {
        const { container } = render(
            <PayoutsAndFees
                money={money({ oneSale: null, free: true })}
                ownership="community"
                destination={notConnected}
                t={t}
                cash={cash}
                owner={impactHub}
                kind="event"
            />,
        );
        expect(screen.getByText("Where the money goes")).toBeInTheDocument();
        expect(screen.getByText("It’s free, so no money changes hands.")).toBeInTheDocument();
        expect(container.querySelector("svg[role=img]")).toBeNull();
        expect(screen.queryByText(/Connect Stripe/)).toBeNull();
    });
});

/*
 * PBN, 25 Nov 2026: on Thiago's own card the Cobuntu row read "Platform fee"
 * beside "2.3%", which is the amount's share of the price, not the fee. The
 * row now names the fee itself: 2.5% + 5c of his share after the commission.
 */
describe("a member's own card names Cobuntu's fee", () => {
    const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
    const thiago = { gross: 399700, vat: 0, stripe: 6026, cobuntu: 8998, community: 39970, communityCut: 0, net: 344706 };
    const renderMember = (rates: { sellerFeePct?: number | null; sellerFeeFixed?: number | null }) =>
        render(
            <PayoutsAndFees
                money={money({ currency: "USD", oneSale: thiago })}
                ownership="member"
                rates={{ cobuntuPct: null, communityPct: 10, ...rates }}
                destination={null}
                t={t}
                cash={usd}
                broker={pbn}
                kind="product"
                sold={0}
            />,
        );

    it("as a rate on the member's share, beside its amount", () => {
        renderMember({ sellerFeePct: 2.5, sellerFeeFixed: 5 });
        expect(screen.getByText("Platform fee, 2.5% + $0.05 of your share")).toBeInTheDocument();
        expect(screen.getByText("$89.98")).toBeInTheDocument();
    });

    it("plain when the backend sends no rate", () => {
        renderMember({});
        expect(screen.getByText("Platform fee")).toBeInTheDocument();
    });
});
