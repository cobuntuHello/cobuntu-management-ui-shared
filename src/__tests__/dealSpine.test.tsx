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
        // and the two must not look alike on a screen about money.
        render(<DealSpine rate={null} communityName="PBN" />);
        expect(screen.getByText("—")).toBeInTheDocument();
        expect(screen.getByText(/Nothing agreed yet/)).toBeInTheDocument();
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
    it("draws one full band and names nobody who took nothing", () => {
        render(<DealSpine rate={0} communityName="Cobuntu" platformShare={10} />);
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(share("You keep")).toBe("100%");
        // A party named for taking nothing is the chart-of-nothing in list form.
        expect(screen.queryByText("Platform")).not.toBeInTheDocument();
        expect(screen.getByText(/Nothing to split/)).toBeInTheDocument();
    });

    it("names the other two the moment there is a commission", () => {
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(share("PBN")).toBe("9%");
        expect(screen.queryByText(/Nothing to split/)).not.toBeInTheDocument();
    });

    /*
     * An unagreed rate is a THIRD thing: not zero, not a split. It already said
     * "Nothing agreed yet" and must keep saying that rather than falling into
     * the zero copy.
     */
    it("keeps null distinct from zero", () => {
        render(<DealSpine rate={null} communityName="PBN" platformShare={10} />);
        expect(screen.getByText("—")).toBeInTheDocument();
        expect(screen.getByText(/Nothing agreed yet/)).toBeInTheDocument();
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
    const swatches = (c: HTMLElement) =>
        Array.from(c.querySelectorAll("dl span[aria-hidden]"))
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
        const { container } = render(<DealSpine rate={0} communityName="PBN" platformShare={10} />);
        expect(swatches(container)).toEqual(["var(--b-keep)"]);
    });
});
