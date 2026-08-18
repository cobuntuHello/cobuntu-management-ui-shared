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

describe("the spine", () => {
    it("always totals the commission, whatever the rate", () => {
        /*
         * The load-bearing property, and the MVP's own note explains it:
         * Cobuntu's share is a slice OF the commission, not of the sale. So the
         * bar's height stays put while the rate moves and only the ratio inside
         * changes. Drawn against the sale instead, the community's band would
         * SHRINK every time they lowered their own rate — the opposite of what
         * happened.
         */
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(screen.getByText("90%")).toBeInTheDocument();
        expect(screen.getByText("10%", { selector: "span" })).toBeInTheDocument();
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
        expect(screen.getByText("Platform")).toBeInTheDocument();
        expect(screen.queryAllByText("Cobuntu")).toHaveLength(1);
    });

    it("uses the platform's own name everywhere else", () => {
        render(<DealSpine rate={10} communityName="PBN" platformShare={10} />);
        expect(screen.getByText("Cobuntu")).toBeInTheDocument();
        expect(screen.getByText("PBN")).toBeInTheDocument();
    });
});
