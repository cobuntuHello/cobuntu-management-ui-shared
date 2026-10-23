import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PolicyRow, AudienceMeter } from "../ui/PolicyRow";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The settings row that shows its answer instead of explaining it.
 *
 * The properties worth pinning are the ones that were got WRONG on the way to
 * this design, because each is cheap to undo by accident:
 *
 *   - The glyph belongs to the consumer and describes what the setting
 *     GOVERNS. The first cut derived it from the value instead, which put a
 *     ticket on "who can see the location" and a people icon on "just the
 *     number" -- a glyph saying the opposite of the setting it sat on.
 *   - The row states the VALUE, not a definition of it. The definition moved
 *     into the picker sheet.
 *   - The lock badge tracks restriction, and is solid only when nobody at all
 *     can see the thing.
 */

const ICON = <svg data-testid="topic-icon" />;

describe("PolicyRow", () => {
    it("renders the consumer's own glyph, whatever the value", () => {
        // The icon is a prop precisely so the row cannot invent one that
        // contradicts what the setting is about.
        for (const level of [0, 1, 2, 3] as const) {
            const { unmount } = render(
                <PolicyRow icon={ICON} title="Who can see the location" value="x" level={level} onClick={() => {}} />,
            );
            expect(screen.getByTestId("topic-icon")).toBeTruthy();
            unmount();
        }
    });

    it("shows the value, not an explanation of it", () => {
        render(<PolicyRow icon={ICON} title="Who can see the guest list" value="Everyone" level={3} onClick={() => {}} />);
        expect(screen.getByText("Who can see the guest list")).toBeTruthy();
        expect(screen.getByText("Everyone")).toBeTruthy();
        // The sentence that used to live here is in the sheet now.
        expect(screen.queryByText(/Anyone who can see the event/)).toBeNull();
    });

    it("carries no lock while the thing is fully public", () => {
        const { container } = render(
            <PolicyRow icon={ICON} title="t" value="Everyone" level={3} onClick={() => {}} />,
        );
        // Level 3 is the default state; badging it would mark every row on
        // arrival and make "restricted" mean nothing.
        expect(container.querySelectorAll("svg").length).toBe(2); // topic + chevron
    });

    it("adds a lock as soon as it is not public", () => {
        for (const level of [0, 1, 2] as const) {
            const { container, unmount } = render(
                <PolicyRow icon={ICON} title="t" value="v" level={level} onClick={() => {}} />,
            );
            expect(container.querySelectorAll("svg").length).toBe(3); // + lock
            unmount();
        }
    });

    it("fills the lock only when nobody can see it", () => {
        const { container: sealed } = render(
            <PolicyRow icon={ICON} title="t" value="Nobody" level={0} onClick={() => {}} />,
        );
        expect(sealed.innerHTML).toContain('fill="currentColor"');

        const { container: partial } = render(
            <PolicyRow icon={ICON} title="t" value="Attendees only" level={2} onClick={() => {}} />,
        );
        // Outlined: the strongest state should be the heaviest mark, so a
        // partial restriction must not look identical to a total one.
        expect(partial.innerHTML).not.toContain('fill="currentColor"');
    });

    it("drops the audience signals where openness means nothing", () => {
        const { container } = render(
            <PolicyRow icon={ICON} title="t" value="v" level={0} onClick={() => {}} hideAudience />,
        );
        expect(container.querySelectorAll("svg").length).toBe(2); // no lock
        expect(container.querySelectorAll(".rounded-full").length).toBe(0); // no meter
    });

    it("opens the picker when pressed", () => {
        const onClick = vi.fn();
        render(<PolicyRow icon={ICON} title="t" value="v" level={3} onClick={onClick} />);
        screen.getByRole("button").click();
        expect(onClick).toHaveBeenCalledOnce();
    });
});

describe("AudienceMeter", () => {
    it("always shows the maximum, so a level reads as 'n of three'", () => {
        // Hiding the excluded slots would turn "one of three" into a lone dot,
        // which says nothing about how much is being withheld.
        for (const level of [0, 1, 2, 3] as const) {
            const { container, unmount } = render(<AudienceMeter level={level} />);
            expect(container.querySelectorAll("span > span").length).toBe(3);
            unmount();
        }
    });

    it("fills exactly as many slots as the level", () => {
        for (const level of [0, 1, 2, 3] as const) {
            const { container, unmount } = render(<AudienceMeter level={level} />);
            /* Read the BACKGROUND, not the border: jsdom drops a
               `border: none` declaration rather than echoing it, so a filled
               slot and an unstyled one look identical through that property. */
            const filled = Array.from(container.querySelectorAll("span > span")).filter(
                (el) => (el as HTMLElement).style.background !== "transparent",
            );
            expect(filled.length).toBe(level);
            unmount();
        }
    });

    it("draws the empty slots as rings, not as dim dots", () => {
        /*
         * The first version drew both states as solid greys at 5px and read as
         * an ellipsis "..." beside the chevron -- three dots in a row is
         * already a glyph, and its meaning is "more to come".
         */
        const { container } = render(<AudienceMeter level={1} />);
        const html = container.innerHTML;
        expect(html).toContain("border");
        expect(html).toContain("transparent");
    });

    it("is hidden from screen readers, which read the value in text", () => {
        const { container } = render(<AudienceMeter level={2} />);
        expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
    });
});

/*
 * ── The header state chip ──────────────────────────────────────────────────
 *
 * Lives in this file rather than its own because it is the same idea as
 * PolicyRow: say a thing once, in the place that says it best.
 */
describe("ManagedListingDetail's state chip", () => {
    it("is suppressed exactly for the states NextAction announces", () => {
        const src = readFileSync(resolve(process.cwd(), "src/listings/ManagedListingDetail.tsx"), "utf8");
        /*
         * A live listing carried a green "Live" chip directly above a banner
         * reading "You both shook on it / This listing is live" -- one fact,
         * twice, in a single eyeful.
         */
        expect(src).toContain('const BANNERED_STATES = new Set<ListingState>(["ACTIVE", "PENDING"])');
        expect(src).toContain("!BANNERED_STATES.has(state)");
    });

    it("keeps the chip for the states that have no banner at all", () => {
        const next = readFileSync(resolve(process.cwd(), "src/listings/ui/NextAction.tsx"), "utf8");
        /*
         * NextAction handles ACTIVE and PENDING and returns null otherwise, so
         * for PAUSED / CANCELLED / REVOKED the chip is the ONLY thing on the
         * page saying what state the listing is in. If this ever stops being
         * true, BANNERED_STATES has to grow to match.
         */
        expect(next).toContain('if (state === "ACTIVE")');
        expect(next).toContain('if (state !== "PENDING") return null;');
    });
});

describe("RefundPolicyField", () => {
    it("says only what differs between the two presets", () => {
        /*
         * Standard read "Buyers can self-refund within the usual window. You
         * can always refund a buyer directly." The second sentence is true of
         * BOTH options, so half the text told you nothing about the choice you
         * were making. What differs is only whether the buyer can do it
         * themselves.
         */
        const src = readFileSync(resolve(process.cwd(), "src/listings/RefundPolicyField.tsx"), "utf8");
        expect(src).toContain('subtitle="Buyers can refund themselves within the usual window."');
        expect(src).toContain('subtitle="Buyers ask you instead."');
        expect(src).not.toContain("You can always refund a buyer directly");
    });

    it("is one file, not one per package", () => {
        // It existed twice, in event-management-ui and product-management-ui,
        // each comment claiming to be "ONE shared control" and naming the
        // other as its mirror. Identical markup, nothing keeping them so.
        const index = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
        expect(index).toContain('export { RefundPolicyField');
    });
});
