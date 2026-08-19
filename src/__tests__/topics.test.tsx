import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topics, type Topic } from "../listings/ui/Topics";
import { defaultTranslate } from "../listings/copy";

/**
 * Topics — the half of a listing negotiation that is not money.
 *
 * Ported from the negotiation MVP, which is the agreed design for this page.
 *
 * The properties worth testing are the ones the design ARGUES for, not that a
 * list renders: that closing is mutual and reads as a handshake rather than a
 * status; that the two sides see the same thread from their own position; and
 * that the component never tries to write what the server derives.
 */

const t = (k: string, v?: Record<string, string | number>) => defaultTranslate(k, v);

function makeTopic(over: Partial<Topic> = {}): Topic {
    return {
        id: "t1",
        subject: "Banner is low-res",
        status: "OPEN",
        closedBySeller: false,
        closedByCommunity: false,
        openedByUserId: "seller-1",
        comments: [{ id: "c1", body: "It pixelates on the card.", authorUserId: "seller-1" }],
        ...over,
    };
}

const noop = () => {};

function renderTopics(topics: Topic[], over: Partial<Parameters<typeof Topics>[0]> = {}) {
    return render(
        <Topics
            topics={topics}
            viewer="owner"
            otherPartyName="PBN"
            onOpen={noop}
            onComment={noop}
            onToggleDone={noop}
            t={t}
            {...over}
        />,
    );
}

describe("the handshake", () => {
    it("says it closes when BOTH agree, before either has", () => {
        renderTopics([makeTopic()]);
        expect(screen.getByText("Closes when you both agree it is done")).toBeInTheDocument();
    });

    /*
     * The load-bearing one. One party ticking a topic off is a CLAIM, not an
     * agreement — it would record their opinion of whether the other had done
     * enough. So after the viewer's own flag is set, the topic is still open
     * and the copy names who is still to agree.
     */
    it("still reads as open once only the viewer has agreed, and names who is missing", () => {
        renderTopics([makeTopic({ closedBySeller: true })]);
        expect(screen.getByText("Waiting for PBN to agree it is done")).toBeInTheDocument();
        // Still in the open list, not the settled fold.
        expect(screen.queryByText(/settled/)).not.toBeInTheDocument();
    });

    it("offers Undo once you have agreed, so agreeing is reversible", () => {
        renderTopics([makeTopic({ closedBySeller: true })]);
        expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    });

    /*
     * The component sends the viewer's OWN flag and nothing else. It has no way
     * to write `status` or the other side's flag — the server ignores both, and
     * this asserts the client honours that contract rather than testing it.
     */
    it("sends only a boolean for the viewer's own side", () => {
        const onToggleDone = vi.fn();
        renderTopics([makeTopic()], { onToggleDone });
        fireEvent.click(screen.getByRole("button", { name: "It is done" }));
        expect(onToggleDone).toHaveBeenCalledWith("t1", true);
    });

    it("sends false to withdraw", () => {
        const onToggleDone = vi.fn();
        renderTopics([makeTopic({ closedBySeller: true })], { onToggleDone });
        fireEvent.click(screen.getByRole("button", { name: "Undo" }));
        expect(onToggleDone).toHaveBeenCalledWith("t1", false);
    });

    it("reads the right flag as 'mine' from each side", () => {
        // Community has agreed, seller has not. To the SELLER that is "waiting
        // on nobody but me", so no waiting line and the action is still open.
        renderTopics([makeTopic({ closedByCommunity: true })], { viewer: "owner" });
        expect(screen.getByRole("button", { name: "It is done" })).toBeInTheDocument();

        // Same topic, other viewer: they have agreed, so it is the other way.
        renderTopics([makeTopic({ closedByCommunity: true })], { viewer: "leader", otherPartyName: "Stella" });
        expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
        expect(screen.getByText("Waiting for Stella to agree it is done")).toBeInTheDocument();
    });

    it("folds settled topics away and drops the handshake row", () => {
        renderTopics([makeTopic({ status: "RESOLVED", closedBySeller: true, closedByCommunity: true })]);
        expect(screen.getByText("1 settled - show")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "It is done" })).not.toBeInTheDocument();
    });
});

describe("the composer", () => {
    it("is one line until you start, then opens in place", () => {
        renderTopics([]);
        const trigger = screen.getByRole("button", { name: "Raise something with PBN..." });
        fireEvent.click(trigger);
        expect(screen.getByPlaceholderText("What is this about?")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Say more...")).toBeInTheDocument();
    });

    /*
     * A subject is required because a thread you can CLOSE needs a name —
     * "settled" is meaningless against an untitled pile of messages. The server
     * enforces the same rule; this only avoids a pointless round trip.
     */
    it("will not post without both a subject and a body", () => {
        const onOpen = vi.fn();
        renderTopics([], { onOpen });
        fireEvent.click(screen.getByRole("button", { name: "Raise something with PBN..." }));

        const post = screen.getByRole("button", { name: "Post" });
        expect(post).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText("What is this about?"), { target: { value: "Banner" } });
        expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText("Say more..."), { target: { value: "It pixelates." } });
        fireEvent.click(screen.getByRole("button", { name: "Post" }));
        expect(onOpen).toHaveBeenCalledWith("Banner", "It pixelates.");
    });

    it("trims before sending, so whitespace is not a subject", () => {
        const onOpen = vi.fn();
        renderTopics([], { onOpen });
        fireEvent.click(screen.getByRole("button", { name: "Raise something with PBN..." }));
        fireEvent.change(screen.getByPlaceholderText("What is this about?"), { target: { value: "   " } });
        fireEvent.change(screen.getByPlaceholderText("Say more..."), { target: { value: "  x  " } });
        expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
        expect(onOpen).not.toHaveBeenCalled();
    });
});

describe("the empty state", () => {
    /*
     * An empty feed means two different things depending on who is looking, and
     * saying the wrong one is worse than saying nothing. To a seller it means
     * nobody has objected; to a leader it means the way to ask for a change is
     * to raise a point, because they CANNOT edit someone else's listing.
     */
    it("tells a seller nobody has raised anything", () => {
        renderTopics([], { viewer: "owner", otherPartyName: "PBN" });
        expect(screen.getByText("PBN has not raised anything. When they do, it lands here.")).toBeInTheDocument();
    });

    it("tells a leader that raising a point is how they ask for a change", () => {
        renderTopics([], { viewer: "leader", otherPartyName: "Stella" });
        expect(
            screen.getByText("Raise a point if you want something changed. You cannot edit Stella's listing yourself."),
        ).toBeInTheDocument();
    });
});

describe("changed since", () => {
    it("marks a topic raised before the item was edited", () => {
        renderTopics([makeTopic({ changedSince: true })]);
        expect(screen.getByText("changed since")).toBeInTheDocument();
    });

    it("does not mark one on a settled topic — there is nothing left to re-read", () => {
        renderTopics([makeTopic({ status: "RESOLVED", changedSince: true })]);
        expect(screen.queryByText("changed since")).not.toBeInTheDocument();
    });
});

describe("replying", () => {
    it("sends on Enter and clears the box", () => {
        const onComment = vi.fn();
        renderTopics([makeTopic()], { onComment });
        const input = screen.getByPlaceholderText("Reply...");
        fireEvent.change(input, { target: { value: "Re-uploaded." } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onComment).toHaveBeenCalledWith("t1", "Re-uploaded.");
    });

    it("ignores an empty Enter", () => {
        const onComment = vi.fn();
        renderTopics([makeTopic()], { onComment });
        fireEvent.keyDown(screen.getByPlaceholderText("Reply..."), { key: "Enter" });
        expect(onComment).not.toHaveBeenCalled();
    });

    /*
     * A thread of MORE than one message arrives collapsed — the header carries
     * the subject and a preview of the opening line, which is enough to decide
     * whether to read it. A thread of one has nothing to collapse, so it opens
     * by default: hiding a single message behind a disclosure would hide the
     * entire point of the row.
     */
    it("collapses a thread that has a reply, and opens it on click", () => {
        renderTopics([
            makeTopic({
                comments: [
                    { id: "c1", body: "It pixelates on the card.", authorUserId: "seller-1" },
                    { id: "c2", body: "Agreed, can you re-upload?", authorUserId: "leader-1" },
                ],
            }),
        ]);
        // The preview line is in the header; the reply is not on screen yet.
        expect(screen.queryByText("Agreed, can you re-upload?")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("Banner is low-res"));
        expect(screen.getByText("Agreed, can you re-upload?")).toBeInTheDocument();
    });

    it("opens a single-message thread by default", () => {
        renderTopics([makeTopic()]);
        expect(screen.getByPlaceholderText("Reply...")).toBeInTheDocument();
    });
});

/**
 * The empty placeholder steps aside while you compose.
 *
 * Two empty cards stacked -- one inviting the act, one describing its absence
 * -- is the page telling you twice that there is nothing here, in the very
 * moment you are fixing it.
 */
describe("composing over an empty section", () => {
    const props = {
        viewer: "owner" as const,
        otherPartyName: "PBN",
        topics: [],
        onOpen: () => {},
        onComment: () => {},
        onToggleDone: () => {},
        t: defaultTranslate,
    };

    it("shows the placeholder before you start", () => {
        render(<Topics {...props} />);
        expect(screen.getByText("Nothing raised yet")).toBeInTheDocument();
    });

    it("drops it once the composer opens, and brings it back on cancel", () => {
        render(<Topics {...props} />);
        fireEvent.click(screen.getByText(/Raise something/));
        expect(screen.queryByText("Nothing raised yet")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByText("Nothing raised yet")).toBeInTheDocument();
    });
});
