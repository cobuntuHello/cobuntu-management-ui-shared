import type React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfferedPackages } from "../listings/ui/OfferedPackages";
import { saleSplit, euroSplit, allocateCents } from "../listings/ui/DealSpine";

/**
 * The leader's package options, shown on a request with no cut agreed.
 *
 * The point of this component is that the packages AND what each does to a sale
 * are visible without hunting for "Propose different terms" — the PBN complaint.
 */
/**
 * The packages live behind a banner and a modal now, so every test that wants
 * to see a package has to walk the flow a leader walks: open the picker, then
 * choose one. Two helpers rather than the same four lines in twenty tests, and
 * they are the reason these tests kept passing through the redesign -- they
 * assert what the card SAYS, not where it happens to sit.
 */
async function showList(props: React.ComponentProps<typeof OfferedPackages>) {
    const out = render(<OfferedPackages {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /choose a package/i }));
    return out;
}

/**
 * Open the picker and choose a package by NAME, landing on its numbers.
 *
 * Scoped to the DIALOG, and matched by name rather than by rate. The banner
 * behind the modal contains both the floor rate ("8%") and the floor package's
 * name ("Self-run, the floor of..."), so an unscoped matcher finds the banner
 * button first and silently re-opens the modal instead of picking a row -- and
 * the test then fails somewhere else entirely, which is how this cost twenty
 * minutes.
 */
async function showNumbers(
    props: React.ComponentProps<typeof OfferedPackages>,
    name = "Self-run",
) {
    const out = await showList(props);
    const row = within(screen.getByRole("dialog"))
        .getAllByRole("button")
        .find((b) => (b.textContent ?? "").includes(name));
    if (!row) throw new Error(`no package row named ${name}`);
    await userEvent.click(row);
    return out;
}

describe("OfferedPackages", () => {
    const pkgs = [
        { id: "self", name: "Self-run", description: null, rate: 8 },
        { id: "co", name: "Co-run", description: "We help run it", rate: 15 },
        { id: "pbn", name: "PBN-run", description: null, rate: 22 },
    ];

    it("lists every offered package with its rate", async () => {
        await showList({ packages: pkgs, communityName: "PBN", sellerName: "Drew", onChoose: () => {} });
        const dialog = within(screen.getByRole("dialog"));
        expect(dialog.getByText("Self-run")).toBeInTheDocument();
        expect(dialog.getByText("Co-run")).toBeInTheDocument();
        expect(dialog.getByText("PBN-run")).toBeInTheDocument();
        /*
         * Each row is a CHOICE, not a commit. The "Offer X%" action moved to the
         * modal's footer and only appears once a package is picked, so a leader
         * cannot agree a rate without having seen what it pays out -- which is
         * the whole reason this flow has two steps.
         */
        expect(screen.queryByRole("button", { name: "Offer 8%" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Offer 22%" })).toBeNull();
    });

    it("shows what the seller keeps, matching the spine's split exactly", async () => {
        const fee = { rate: 0.04, fixed: 30 };
        await showNumbers({ packages: pkgs, communityName: "PBN", sellerName: "Drew", sellerFee: fee, platformShare: 10, onChoose: () => {} });
        const s = saleSplit(8, 10, fee); // the Self-run row
        const keep = Math.round(s.sellerOfSale * 10) / 10;
        // One package at a time now: the modal shows the one that was picked.
        expect(screen.getAllByText("You keep").length).toBe(1);
        expect(screen.getByText(`${keep}%`)).toBeInTheDocument();
    });

    it("offers a package by id, after the leader has seen its numbers", async () => {
        const onChoose = vi.fn();
        await showNumbers({ packages: pkgs, communityName: "PBN", sellerName: "Drew", onChoose }, "Co-run");
        // The commit now lives in the modal's footer, once a package is picked.
        fireEvent.click(screen.getByRole("button", { name: "Offer 15%" }));
        expect(onChoose).toHaveBeenCalledWith("co");
    });

    it("names the effective floor that checkout already charges, on the cheapest package", async () => {
        // The checkout bills Math.min(tier rates) when nothing is agreed, so the
        // page must say so: the 8% Self-run is the floor and must be flagged.
        await showList({ packages: pkgs, communityName: "PBN", sellerName: "Drew", onChoose: () => {} });
        // The floor note is on the BANNER, which is the point: it must be
        // readable without opening anything.
        expect(screen.getByText(/already takes 8% on every sale/)).toBeInTheDocument();
        // The badge marks the floor package only (one badge, on Self-run's row).
        const badges = screen.getAllByText("Applies now by default");
        expect(badges.length).toBe(1);
    });

    it("renders nothing when the community publishes no packages", () => {
        const { container } = render(<OfferedPackages packages={[]} communityName="PBN" sellerName="Drew" onChoose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });
});

/** PBN's real shape: 5% of the commission, 4% + EUR 0.30 on the seller. */
const FEES = {
    platformShare: 5,
    sellerFee: { rate: 0.04, fixed: 30 },
    stripeRate: 0.015,
    stripeFixed: 25,
};

const PACKAGES = [
    { id: "a", name: "Self-run", description: null, rate: 8 },
    { id: "b", name: "Co-run", description: null, rate: 15 },
    { id: "c", name: "PBN-run", description: null, rate: 22 },
];

/** U+2212 MINUS SIGN, not a hyphen: it aligns with the digits. */
const MINUS = "\u2212";

const base = {
    packages: PACKAGES,
    ...FEES,
    communityName: "PBN",
    sellerName: "Drew Milligan",
    onChoose: () => {},
};

describe("the money adds up", () => {
    /*
     * The whole reason this card works in euros rather than percentages: two of
     * the four deductions carry a FLAT per-sale charge, and a flat charge has no
     * percentage until a price is named.
     */
    it.each([8, 15, 22])("four shares sum to the ticket at %i%%", (rate) => {
        const price = 25;
        const e = euroSplit(price, rate, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const sum = e.hostKeeps + e.communityNet + e.cobuntuNet + e.stripeAmt;
        expect(sum).toBeCloseTo(price, 8);
    });

    /*
     * Rounding each row on its own does NOT add up. At 8% on EUR 25, Cobuntu's
     * 0.695 and Stripe's 0.625 both round up and the rows total 25.01 against a
     * printed total of 25.00 -- a receipt disagreeing with itself.
     */
    it("rounds rows to cents that still total the ticket", () => {
        const price = 25;
        const e = euroSplit(price, 8, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const naive = [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]
            .map((x) => Math.round(x * 100))
            .reduce((a, b) => a + b, 0);
        expect(naive).toBe(2501); // the bug, pinned so the fix cannot be undone

        const cents = allocateCents(price, [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]);
        expect(cents.reduce((a, b) => a + b, 0)).toBe(2500);
        // and no row drifts more than a cent from its true value
        cents.forEach((c, i) => {
            const exact = [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt][i] * 100;
            expect(Math.abs(c - exact)).toBeLessThan(1);
        });
    });

    it.each([3, 9.99, 25, 480])("totals exactly at a %p ticket", (price) => {
        const e = euroSplit(price, 15, FEES.platformShare, FEES.sellerFee, {
            rate: FEES.stripeRate,
            fixed: FEES.stripeFixed,
        });
        const cents = allocateCents(price, [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt]);
        expect(cents.reduce((a, b) => a + b, 0)).toBe(Math.round(price * 100));
    });

    /*
     * The percentage split CANNOT carry the flat fees, which is why it is only
     * the fallback. Pinned so nobody "fixes" the card by going back to it.
     */
    it("percentage split ignores the fixed fee, by nature", () => {
        const withFixed = saleSplit(8, 5, { rate: 0.04, fixed: 30 });
        const withoutFixed = saleSplit(8, 5, { rate: 0.04, fixed: 0 });
        expect(withFixed).toEqual(withoutFixed);
    });
});

describe("what the card shows", () => {
    const price = { samplePrice: 25, sampleCurrency: "EUR" };

    it("names the seller on the leader's side, not 'You'", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(screen.getAllByText("Drew Milligan keeps").length).toBe(1);
        expect(screen.queryByText("You keep")).toBeNull();
    });

    it("says 'You keep' on the seller's side", async () => {
        await showNumbers({ ...base, ...price, viewer: "seller" });
        expect(screen.getAllByText("You keep").length).toBe(1);
        expect(screen.queryByText("Drew Milligan keeps")).toBeNull();
    });

    /*
     * The original complaint: a heading reading 8% over a row reading 7.6%,
     * with nothing saying they were different things. Both are true -- one is
     * CHARGED and the other ARRIVES -- and the fix is not to print them beside
     * each other, which is what made them look like a contradiction. The money
     * column carries only what each party receives; the rates are stated once,
     * in a sentence, underneath.
     */
    it("states the rates once, under the figures they explain", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(
            screen.getAllByText(
                /PBN charges 8%\. Cobuntu takes 5% of that, plus 4% \+ €0\.30 of Drew Milligan's share, and pays Stripe out of it\./,
            ).length,
        ).toBe(1);
        /*
         * A RECEIPT, so the community's line is a SUBTRACTION from the ticket.
         * The minus is not decoration: the card reads top-down from what the
         * buyer pays to what the seller is left with, and a row showing a bare
         * "EUR 1.90" in that column reads as money arriving, not leaving.
         */
        expect(screen.getAllByText(`${MINUS}€1.90`).length).toBeGreaterThan(0);
    });

    it("subtracts every deduction and leaves the seller's line positive", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        const minus = MINUS;
        // The three parties that TAKE money each show a minus...
        for (const amount of [`${minus}€1.90`, `${minus}€0.70`, `${minus}€0.62`]) {
            expect(screen.getAllByText(amount).length).toBeGreaterThan(0);
        }
        // ...and the two that are not deductions do not.
        // Once: the seller's share differs per package (21.78 / 20.10 / 18.42).
        expect(screen.getAllByText("€21.78").length).toBe(1); // seller keeps
        // Three times: the ticket is the same sale whichever package is picked.
        expect(screen.getAllByText("€25.00").length).toBe(1); // ticket price
        expect(screen.queryByText(`${minus}€21.78`)).toBeNull();
        expect(screen.queryByText(`${minus}€25.00`)).toBeNull();
    });

    /*
     * Cobuntu's member-seller fee is ALL-IN (feeConstants: "Stripe's processing
     * comes out of it"), so card processing used to be real money with no row.
     */
    it("gives Stripe its own line", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(screen.getAllByText("Stripe (card processing)").length).toBe(1);
    });

    it("prints a ticket total, which is what makes the rows checkable", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(screen.getAllByText("Ticket price").length).toBe(1);
        expect(screen.getAllByText("€25.00").length).toBe(1);
    });

    it("falls back to percentages when no price is known", async () => {
        await showNumbers({ ...base, viewer: "leader" });
        expect(screen.queryByText("Ticket price")).toBeNull();
        expect(screen.queryByText("Stripe (card processing)")).toBeNull();
        expect(screen.getAllByText("88.3%").length).toBe(1);
    });

    it("still names the floor package, which bills whether or not terms are set", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(screen.getByText(/already takes 8% on every sale/)).toBeTruthy();
    });
});

/**
 * The marks beside each party.
 *
 * Real brand SVGs for Cobuntu and Stripe, the community's own icon, the
 * requester's photo, and a glyph for the sale itself. These shipped once as
 * coloured letters on the reasoning that a wrong logo is worse than an honest
 * monogram -- true, but the assets existed in the backoffice all along, so the
 * reasoning was applied to a fact that was not checked.
 *
 * SHAPE is load-bearing here and is what these tests mostly pin: a community
 * icon is a logo and stays SQUARE (a circular crop eats the corners of a
 * wordmark), Stripe's mark is square because that is how Stripe sets it, and
 * only the person is round, because only the person is a face.
 */
describe("the party marks", () => {
    const price = { samplePrice: 25, sampleCurrency: "EUR" };

    it("uses the real images it is given, square for a logo and round for a face", async () => {
        await showNumbers({
            ...base, ...price, viewer: "leader",
            communityIconUrl: "https://img.test/pbn.png",
            sellerImageUrl: "https://img.test/drew.png",
        });
        /* document, not the render container: the modal is portalled out of it. */
        const container = document.body;
        const community = container.querySelector('img[src="https://img.test/pbn.png"]');
        const person = container.querySelector('img[src="https://img.test/drew.png"]');
        expect(community).not.toBeNull();
        expect(person).not.toBeNull();
        expect(community!.className).toContain("rounded-[5px]");
        expect(community!.className).not.toContain("rounded-full");
        expect(person!.className).toContain("rounded-full");
    });

    it("draws the real Cobuntu and Stripe marks, not letters", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        // Labelled SVGs, one per package row.
        expect(screen.getAllByLabelText("Cobuntu").length).toBe(1);
        expect(screen.getAllByLabelText("Stripe").length).toBe(1);
        // The monograms they replaced are gone.
        expect(screen.queryByText("C")).toBeNull();
        expect(screen.queryByText("S")).toBeNull();
    });

    it("never renders an img without a src, which is the broken-icon bug", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        const container = document.body;
        for (const img of Array.from(container.querySelectorAll("img"))) {
            expect(img.getAttribute("src")).toBeTruthy();
        }
    });

    it("gives Stripe its own row, separate from the platform fee", async () => {
        await showNumbers({ ...base, ...price, viewer: "leader" });
        expect(screen.getAllByText("Stripe (card processing)").length).toBe(1);
        expect(screen.getAllByText("Cobuntu").length).toBe(1);
        // ...and the two carry different amounts, i.e. one is not folded into
        // the other behind a single figure.
        expect(screen.getAllByText(`${MINUS}€0.70`).length).toBeGreaterThan(0);
        expect(screen.getAllByText(`${MINUS}€0.62`).length).toBeGreaterThan(0);
    });
});

/**
 * The share column.
 *
 * Each row shows its share OF THE TICKET, derived from the cents the money
 * column prints -- not from the rate. That distinction is the whole history of
 * this card: a package headlined 8% once showed a row reading 7.6% beside it,
 * which looked like a contradiction and was really two different questions
 * (what the community charges, and what reaches it after Cobuntu's cut of that
 * commission). Deriving the percentage from the amount is what makes a row
 * internally consistent; the sentence under the total explains the gap.
 */
describe("the share column", () => {
    const price = { samplePrice: 25, sampleCurrency: "EUR" };

    it("matches each row's own amount, and the four sum to 100%", async () => {
        await showNumbers({ ...base, packages: [PACKAGES[0]], ...price, viewer: "leader" });
        const container = document.body;
        const text = container.textContent ?? "";
        const shares = Array.from(text.matchAll(/(\d+(?:\.\d+)?)%/g)).map((m) => Number(m[1]));
        // The headline rate (8%) and the rate stated in the note are also "%"
        // matches, so pick out the row shares by the amounts they must equal.
        const expected = [
            (1.9 / 25) * 100,   // community, net of Cobuntu's share of the commission
            (0.7 / 25) * 100,   // Cobuntu
            (0.62 / 25) * 100,  // Stripe
            (21.78 / 25) * 100, // the seller
        ].map((n) => Math.round(n * 10) / 10);
        for (const pct of expected) expect(shares).toContain(pct);
        expect(expected.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    });

    it("does not put a share on the ticket row, which IS the whole", async () => {
        await showNumbers({ ...base, packages: [PACKAGES[0]], ...price, viewer: "leader" });
        const ticket = screen.getByText("Ticket price").closest("div");
        expect(ticket?.textContent).toContain("€25.00");
        expect(ticket?.textContent).not.toMatch(/%/);
    });
});
