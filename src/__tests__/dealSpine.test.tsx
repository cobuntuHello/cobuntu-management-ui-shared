import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealSpine } from "../listings/ui/DealSpine";
import { NextAction } from "../listings/ui/NextAction";

/**
 * The commission, drawn as a cut of every sale.
 *
 * Ported from the negotiation MVP, which is the agreed design for this page.
 * It replaced a definition-list row reading "Commission — 10%": a number in a
 * table is a fact, and the thing being agreed is what it is a share OF.
 */

/**
 * THE BAR NOW DIVIDES A SALE, not the commission.
 *
 * The first version drew the split OF THE COMMISSION -- Cobuntu takes a slice
 * of the community's cut, not of the sale -- which was accurate and useless at
 * the most common rate there is: at 0% it drew a confident two-colour chart
 * dividing nothing. Removing it there left a number floating in an empty card,
 * which was worse, because the page lost the graphic that made a rate feel like
 * a share of something.
 *
 * Dividing the sale gives every rate an honest picture, zero included.
 */
/**
 * Name and percentage are separate cells now -- a definition list rather than a
 * "Seller 90%" string -- so the numbers can right-align in a readable column.
 * These read the row by its label and check the value beside it.
 */
function share(name: string): string {
    const dt = screen.getByText(name);
    return dt.parentElement?.querySelector("dd")?.textContent ?? "";
}

describe("the spine", () => {
    it("divides one sale between the seller, the community and Cobuntu", () => {
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        // 10% commission: Cobuntu takes 10% OF that, so 1% of the sale.
        expect(share("You keep")).toBe("90%");
        expect(share("PBN")).toBe("9%");
        expect(share("Cobuntu")).toBe("1%");
    });

    /*
     * Cobuntu's slice is a fraction of a fraction. Drawn against the sale it
     * stays small as the rate moves, which is the true shape -- and the reason
     * the seller band grows when a community lowers its own rate.
     */
    it("grows the seller's share when the community lowers its rate", () => {
        const { rerender } = render(<DealSpine rate={20} communityName="PBN" platformShare={10} />);
        expect(share("You keep")).toBe("80%");
        rerender(<DealSpine rate={5} communityName="PBN" platformShare={10} />);
        expect(share("You keep")).toBe("95%");
    });

    it("says nothing is agreed rather than showing a confident zero", () => {
        // "0%" is a rate somebody chose. Null is a question nobody has answered,
        // and the two must not look alike on a screen about money. The unagreed
        // case now reads as a muted sentence rather than a 42px em dash, which
        // looked like a broken value rather than an unmade decision.
        render(<DealSpine rate={null} communityName="PBN" />);
        expect(screen.queryByText("—")).not.toBeInTheDocument();
        expect(screen.getByText(/No cut agreed yet/)).toBeInTheDocument();
    });

    it("offers no counter once the deal is locked", () => {
        // An ACTIVE listing has been agreed; re-trading it is a new request,
        // not an edit of this one.
        render(<DealSpine rate={10} communityName="PBN" locked onCounter={() => {}} />);
        expect(screen.queryByText(/Suggest a different cut/)).toBeNull();
    });

    it("hands the counter back as a number", () => {
        const onCounter = vi.fn();
        render(<DealSpine rate={10} communityName="PBN" onCounter={onCounter} />);
        fireEvent.click(screen.getByText("Suggest a different cut"));
        fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "15" } });
        fireEvent.click(screen.getByText(/Offer 15%/));
        expect(onCounter).toHaveBeenCalledWith(15);
    });
});

describe("whose turn it is", () => {
    it("tells a leader it is theirs when nobody has replied", () => {
        /*
         * The bug this replaced: the old banner told a LEADER "there is nothing
         * for you to do until they answer" — about themselves, above an Approve
         * button — because it only ever addressed the seller.
         */
        render(<NextAction state="PENDING" viewer="leader" communityName="PBN" />);
        expect(screen.getByText("Your turn")).toBeInTheDocument();
        expect(screen.getByText(/waiting on you/)).toBeInTheDocument();
    });

    it("tells the seller to wait in the same situation", () => {
        render(<NextAction state="PENDING" viewer="owner" communityName="PBN" />);
        expect(screen.getByText(/Nothing for you to do/)).toBeInTheDocument();
    });

    it("hands the turn over once the community has countered", () => {
        // Mid-negotiation the turn belongs to whoever did NOT speak last, which
        // is derived rather than stored — a stored turn can disagree with the
        // state it describes.
        render(<NextAction state="PENDING" viewer="owner" communityName="PBN" lastProposalFrom="leader" />);
        expect(screen.getByText("Your turn")).toBeInTheDocument();
    });

    it("says nothing at all on a closed listing", () => {
        const { container } = render(<NextAction state="CANCELLED" viewer="leader" communityName="PBN" />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe("the bands name two different parties", () => {
    it("does not print the same label twice when the community is Cobuntu", () => {
        /*
         * Cobuntu's own community reads its split as "90% COBUNTU / 10%
         * COBUNTU", which says nothing about who gets what — and this is the
         * one screen where that distinction is the entire point.
         */
        render(<DealSpine rate={10} communityName="Cobuntu" platformShare={10} />);
        expect(share("Platform")).toBe("1%");
        /*
         * "Cobuntu" appears ONCE -- as the community taking its commission.
         * The platform's own row is renamed so the two are not the same word
         * twice, which is the whole point on this one card.
         */
        expect(screen.queryAllByText("Cobuntu")).toHaveLength(1);
    });

    it("uses the platform's own name everywhere else", () => {
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(share("Cobuntu")).toBe("1%");
        expect(share("PBN")).toBe("9%");
    });
});

/**
 * Zero is not a split.
 *
 * The bands total the COMMISSION, so at 0% they drew a confident two-colour
 * chart dividing zero euros between two parties. Self-listing is the common
 * zero -- a community carrying its own product takes no cut -- so every one of
 * those pages showed a large graphic of no money at all.
 */
describe("a rate of zero", () => {
    /*
     * Zero is a picture too, and this is the case that drove the redesign: one
     * full band saying the seller keeps all of it. No community key, no
     * platform key -- neither took anything, and a key for a nil share is the
     * chart-of-nothing the first version drew.
     */
    it("says there is nothing to split at zero commission", () => {
        // A 0% listing has no commission to break down, so the split section is
        // replaced by the plain "nothing to split" line — no party rows at all.
        render(<DealSpine rate={0} communityName="Cobuntu" platformShare={10} />);
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(screen.getByText(/Nothing to split/)).toBeInTheDocument();
        expect(screen.queryByText("You keep")).toBeNull();
        expect(screen.queryByText("Host keeps")).toBeNull();
    });

    it("names the other two the moment there is a commission", () => {
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(share("PBN")).toBe("9%");
        expect(screen.queryByText(/Nothing to split/)).not.toBeInTheDocument();
    });

    /*
     * An unagreed rate is a THIRD thing: not zero, not a split. It says "No cut
     * agreed yet" and must keep saying that rather than falling into the zero
     * copy or drawing a split of a rate that does not exist.
     */
    it("keeps null distinct from zero", () => {
        render(<DealSpine rate={null} communityName="PBN" platformShare={10} />);
        expect(screen.queryByText("—")).not.toBeInTheDocument();
        expect(screen.getByText(/No cut agreed yet/)).toBeInTheDocument();
        expect(screen.queryByText(/Nothing to split/)).not.toBeInTheDocument();
    });
});

/**
 * The colours carry the meaning, and the palette already defined it.
 *
 * --b-keep is what the seller keeps, --b-comm is the community, --b-cob is
 * Cobuntu. The first version of this bar picked them arbitrarily and drew the
 * SELLER's band in the Cobuntu blue, so the most important card in the feature
 * had a colour key that contradicted the palette every other surface uses.
 */
describe("the split's colours", () => {
    // Scoped to the party-split list specifically: with no sample price the
    // commission breakdown (its own dl, its own swatches) renders ABOVE this
    // one, and a bare `dl span[aria-hidden]` selector would catch both.
    const swatches = (c: HTMLElement) =>
        Array.from(c.querySelectorAll('[data-testid="spine-party-split"] span[aria-hidden]'))
            .map((el) => (el as HTMLElement).style.background);

    it("gives each party its own token, in the waterfall's order", () => {
        const { container } = render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(swatches(container)).toEqual([
            "var(--b-keep)",
            "var(--b-comm)",
            "var(--b-cob)",
        ]);
    });

    it("drops the parties that took nothing", () => {
        // Rate 0 has no commission at all, so the party-split list (and the
        // commission-split section above it) are both replaced by the plain
        // "nothing to split" line — no swatches anywhere.
        const { container } = render(<DealSpine rate={0} communityName="PBN" platformShare={10} />);
        expect(swatches(container)).toEqual([]);
    });
});

/**
 * ── Where the commission goes (the "8% vs 7.6%" fix) ────────────────────────
 *
 * PBN's real numbers: an 8% commission, Cobuntu's platform fee at 5% OF that
 * commission. The headline stays 8% (the rate CHARGED); this section is what
 * answers the member's "why does it say 7.6% when I agreed 8%" — PBN nets
 * 7.6% because Cobuntu takes 5% of the 8%, not 5 points off it (which would be
 * the 3% a member might otherwise, wrongly, expect).
 */
describe("the commission split", () => {
    it("shows what the community nets after Cobuntu's share of the commission", () => {
        render(<DealSpine rate={8} communityName="PBN" platformShare={5} />);
        expect(share("PBN keeps")).toBe("7.6%");
        // This dt also carries a sub-line ("5% of the commission"), so an
        // exact-text match on the dt itself would miss it — match the row by
        // its leading label instead.
        const feeDt = screen.getByText((_, el) => el?.tagName === "DT" && !!el.textContent?.startsWith("Cobuntu's platform fee"));
        expect(feeDt.parentElement?.querySelector("dd")?.textContent).toBe("0.4%");
        expect(screen.getByText("5% of the commission")).toBeInTheDocument();
        expect(share("Commission charged")).toBe("8%");
    });

    it("spells out that the fee is a share OF the commission, not points off it", () => {
        render(<DealSpine rate={8} communityName="PBN" platformShare={5} />);
        // The actual net (7.6%) and the wrong subtraction a member might assume
        // (8 - 5 = 3%) both have to be named, or the clarification clarifies
        // nothing.
        expect(screen.getByText(/5% of the commission, not 5 points off it/)).toBeInTheDocument();
        expect(screen.getByText(/leaves PBN 7\.6% of the sale, not 3%/)).toBeInTheDocument();
    });
});

/**
 * ── Every euro, with Stripe pulled out of Cobuntu's fee ─────────────────────
 *
 * Percentages cannot add up once Cobuntu's seller fee and Stripe both carry a
 * flat per-sale charge, so a real ticket price renders the four-way split in
 * euros instead: host / community / Cobuntu / Stripe, Stripe on its own line.
 */
describe("the euro breakdown", () => {
    const sellerFee = { rate: 0.04, fixed: 30 };
    const stripe = { stripeRate: 0.015, stripeFixed: 25 };

    it("splits a real ticket four ways, Stripe separate from Cobuntu", () => {
        render(
            <DealSpine
                rate={8}
                communityName="PBN"
                platformShare={5}
                sellerFee={sellerFee}
                samplePrice={5}
                sampleCurrency="EUR"
                {...stripe}
            />,
        );
        expect(screen.getByText(/On a €5\.00 ticket/)).toBeInTheDocument();
        expect(share("Host keeps")).toMatch(/€4\.12/);
        expect(share("PBN (net commission)")).toMatch(/€0\.38/);
        // Named after COBUNTU here (the fee is Cobuntu's), not PBN.
        expect(share("Cobuntu (platform fee)")).toMatch(/€0\.18/);
        expect(share("Stripe (card processing)")).toMatch(/€0\.33/);
        // The ticket row is the real price, not a resum of the (independently
        // rounded) rows above it — those can be a cent off the total, which is
        // an honest rounding artifact, not a bug.
        expect(share("Ticket")).toMatch(/€5\.00/);
    });

    it("falls back to the percent-only split when no price is given", () => {
        render(<DealSpine rate={8} communityName="PBN" platformShare={5} sellerFee={sellerFee} {...stripe} />);
        expect(screen.queryByText(/On a .* ticket/)).toBeNull();
        expect(screen.getByText("Every sale, split")).toBeInTheDocument();
    });
});
