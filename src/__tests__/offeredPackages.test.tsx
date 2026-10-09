import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferedPackages } from "../listings/ui/OfferedPackages";
import { saleSplit } from "../listings/ui/DealSpine";

/**
 * The leader's package options, shown on a request with no cut agreed.
 *
 * The point of this component is that the packages AND what each does to a sale
 * are visible without hunting for "Propose different terms" — the PBN complaint.
 */
describe("OfferedPackages", () => {
    const pkgs = [
        { id: "self", name: "Self-run", description: null, rate: 8 },
        { id: "co", name: "Co-run", description: "We help run it", rate: 15 },
        { id: "pbn", name: "PBN-run", description: null, rate: 22 },
    ];

    it("lists every offered package with its rate", () => {
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(screen.getByText("Self-run")).toBeInTheDocument();
        expect(screen.getByText("Co-run")).toBeInTheDocument();
        expect(screen.getByText("PBN-run")).toBeInTheDocument();
        // Each carries an "Offer X%" action, so the choice is one click.
        expect(screen.getByRole("button", { name: "Offer 8%" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Offer 22%" })).toBeInTheDocument();
    });

    it("shows what the seller keeps, matching the spine's split exactly", () => {
        const fee = { rate: 0.04, fixed: 30 };
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" sellerFee={fee} platformShare={10} onChoose={() => {}} />);
        const s = saleSplit(8, 10, fee); // the Self-run row
        const keep = Math.round(s.sellerOfSale * 10) / 10;
        expect(screen.getByText(new RegExp(`You keep ${keep}%`))).toBeInTheDocument();
    });

    it("offers a package by id, so the member can accept it", () => {
        const onChoose = vi.fn();
        render(<OfferedPackages packages={pkgs} communityName="PBN" sellerName="Drew" onChoose={onChoose} />);
        fireEvent.click(screen.getByRole("button", { name: "Offer 15%" }));
        expect(onChoose).toHaveBeenCalledWith("co");
    });

    it("renders nothing when the community publishes no packages", () => {
        const { container } = render(<OfferedPackages packages={[]} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });
});
