import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextAction } from "../listings/ui/NextAction";
import { defaultTranslate } from "../listings/copy";

/**
 * NextAction, once topics exist.
 *
 * The MVP's argument for this, kept because it is why the old chips went: it
 * showed three stage labels — Requested / Talking it out / Live — and two of
 * the three were unreachable in practice, because a listing with open topics is
 * always in the middle one. What replaced them is the only progress that
 * actually moves: how many topics are still open.
 *
 * So the behaviour under test is the PRIORITY. Open topics lead, because they
 * are what is blocking; the turn demotes to the body line, because somebody
 * still has to act. Neither replaces the other.
 */

const t = (k: string, v?: Record<string, unknown>) => defaultTranslate(k, v);

const base = {
    state: "PENDING" as const,
    communityName: "PBN",
    sellerName: "Stella",
    t,
};

describe("counting topics", () => {
    it("says nothing about topics when there are none — the banner is what it was", () => {
        render(<NextAction {...base} viewer="leader" />);
        expect(screen.getByText("Your turn")).toBeInTheDocument();
        expect(screen.queryByText(/settled/)).not.toBeInTheDocument();
    });

    it("shows countable progress rather than a stage name", () => {
        render(<NextAction {...base} viewer="leader" openTopics={2} totalTopics={5} />);
        expect(screen.getByText("3 of 5 settled")).toBeInTheDocument();
    });

    it("counts a topic as settled only when it has left the open pile", () => {
        // The component is handed OPEN and TOTAL, and derives settled — so a
        // topic one side has ticked is still open here, exactly as the server
        // says it is. Half-agreed is not progress.
        render(<NextAction {...base} viewer="leader" openTopics={5} totalTopics={5} />);
        expect(screen.getByText("0 of 5 settled")).toBeInTheDocument();
    });
});

describe("what leads", () => {
    it("leads with the open count, not the turn", () => {
        render(<NextAction {...base} viewer="leader" openTopics={3} totalTopics={4} />);
        expect(screen.getByText("3 topics still open")).toBeInTheDocument();
        expect(screen.queryByText("Your turn")).not.toBeInTheDocument();
    });

    it("gets the singular right", () => {
        render(<NextAction {...base} viewer="leader" openTopics={1} totalTopics={4} />);
        expect(screen.getByText("1 topic still open")).toBeInTheDocument();
    });

    /*
     * The turn does not vanish, it demotes. Dropping it entirely would leave
     * two people both waiting for the other to work through the same list.
     */
    it("still says who is holding it, in the body", () => {
        render(<NextAction {...base} viewer="leader" openTopics={2} totalTopics={2} />);
        expect(screen.getByText("Work through them with them, then answer the terms below.")).toBeInTheDocument();
    });

    it("tells the side that is NOT holding it who is", () => {
        // lastProposalFrom="leader" puts the turn on the owner, so a leader
        // looking at it is the one waiting.
        render(
            <NextAction {...base} viewer="leader" lastProposalFrom="leader" openTopics={2} totalTopics={2} />,
        );
        expect(screen.getByText("Stella is working through them.")).toBeInTheDocument();
    });

    it("falls back to the turn sentence once everything is settled", () => {
        render(<NextAction {...base} viewer="leader" openTopics={0} totalTopics={4} />);
        expect(screen.getByText("Your turn")).toBeInTheDocument();
        expect(screen.getByText("4 of 4 settled")).toBeInTheDocument();
        expect(screen.queryByText(/still open/)).not.toBeInTheDocument();
    });
});

describe("once it is live", () => {
    it("records what it took, when it took anything", () => {
        render(<NextAction {...base} state="ACTIVE" viewer="owner" totalTopics={3} openTopics={0} />);
        expect(screen.getByText("You both shook on it")).toBeInTheDocument();
        expect(screen.getByText("Live in PBN, with 3 topics settled along the way.")).toBeInTheDocument();
    });

    it("says it in the singular for one", () => {
        render(<NextAction {...base} state="ACTIVE" viewer="owner" totalTopics={1} openTopics={0} />);
        expect(screen.getByText("Live in PBN, with 1 topic settled along the way.")).toBeInTheDocument();
    });

    it("stays plain when nothing was ever raised", () => {
        render(<NextAction {...base} state="ACTIVE" viewer="owner" />);
        expect(screen.queryByText(/along the way/)).not.toBeInTheDocument();
    });
});

describe("the dots", () => {
    it("draws one per topic, filled for the settled ones", () => {
        const { container } = render(<NextAction {...base} viewer="leader" openTopics={2} totalTopics={5} />);
        const dots = container.querySelectorAll("span.size-2\\.5");
        expect(dots).toHaveLength(5);
    });

    /*
     * A bar would imply a fixed length; topics are not known in advance and grow
     * as people raise things. Past the cap the count beside it carries the
     * number, which it does anyway.
     */
    it("caps a heavily-argued listing rather than drawing a hundred", () => {
        const { container } = render(<NextAction {...base} viewer="leader" openTopics={5} totalTopics={20} />);
        expect(container.querySelectorAll("span.size-2\\.5")).toHaveLength(12);
        expect(screen.getByText("+8")).toBeInTheDocument();
        // The real number is still on screen, in words.
        expect(screen.getByText("15 of 20 settled")).toBeInTheDocument();
    });

    it("draws nothing when there is nothing to count", () => {
        const { container } = render(<NextAction {...base} viewer="leader" />);
        expect(container.querySelectorAll("span.size-2\\.5")).toHaveLength(0);
    });
});
