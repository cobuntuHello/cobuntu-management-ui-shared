import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersonPickerModal, type PersonPickerCopy } from "../ui/PersonPickerModal";
import type { PersonSearchResult } from "../lib/searchPeople";

/**
 * Search, pick, see the consequences, confirm.
 *
 * The behaviour worth pinning is that the caller never sees a typed string:
 * `onConfirm` receives a person who came back from the server with an id. The
 * bug this replaces was a free-text "@usertag" box posting a field the API did
 * not read, which no amount of care in the caller could have saved.
 */

const COPY: PersonPickerCopy = {
    title: "Add community member as host",
    searchSubtitle: "Search members of this community.",
    pickedSubtitle: "They'll appear in the hosts list.",
    searchPlaceholder: "Search by name or @usertag",
    emptyHint: "Start typing.",
    searching: "Searching…",
    noMatches: "No matches.",
    unknown: "Unknown",
    consequencesTitle: "What happens next",
    back: "Back",
    cancel: "Cancel",
    confirm: "Add as host",
    confirming: "Adding…",
};

const Avatar = ({ className }: { user: any; className?: string }) => (
    <span data-testid="avatar" className={className} />
);

function mockSearch(members: any[]) {
    return vi.fn(async () => ({ ok: true, json: async () => ({ members }) }) as any);
}

type Props = React.ComponentProps<typeof PersonPickerModal>;

function setup(
    over: Partial<Props> = {},
    /** Replaces the default no-op write, for the failure case. */
    confirmImpl: (p: PersonSearchResult) => Promise<void> = async () => {},
) {
    const onConfirm = vi.fn(confirmImpl);
    const onClose = vi.fn();
    render(
        <PersonPickerModal
            open
            onClose={onClose}
            apiBaseUrl="https://api.test"
            authHeaders={() => ({ Authorization: "Bearer t" })}
            communityTag="w35"
            excludeUserIds={[]}
            UserAvatar={Avatar}
            copy={COPY}
            consequences={["They can manage the event."]}
            onConfirm={onConfirm}
            {...over}
        />,
    );
    return { onConfirm, onClose };
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("PersonPickerModal", () => {
    it("shows the hint before anything is typed, and does not search", async () => {
        const fetchMock = mockSearch([]);
        vi.stubGlobal("fetch", fetchMock);
        setup();
        expect(screen.getByText("Start typing.")).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("searches after typing and lists the matches", async () => {
        vi.stubGlobal("fetch", mockSearch([{ id: "u1", name: "Ana Mate", usertag: "ana" }]));
        setup();
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "ana");
        expect(await screen.findByText("Ana Mate")).toBeInTheDocument();
        expect(screen.getByText("@ana")).toBeInTheDocument();
    });

    it("hands onConfirm the picked person, with the id the server gave", async () => {
        vi.stubGlobal("fetch", mockSearch([{ id: "u1", name: "Ana Mate", usertag: "ana" }]));
        const { onConfirm } = setup();

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "ana");
        await userEvent.click(await screen.findByText("Ana Mate"));

        // Consequences are shown BEFORE the write, not after.
        expect(screen.getByText("What happens next")).toBeInTheDocument();
        expect(screen.getByText("They can manage the event.")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Add as host" }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm.mock.calls[0][0]).toMatchObject({ id: "u1", usertag: "ana" });
    });

    it("closes only after a successful confirm", async () => {
        vi.stubGlobal("fetch", mockSearch([{ id: "u1", name: "Ana Mate", usertag: "ana" }]));
        const { onClose } = setup();
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "ana");
        await userEvent.click(await screen.findByText("Ana Mate"));
        await userEvent.click(screen.getByRole("button", { name: "Add as host" }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("keeps the pick and shows the reason when the write fails", async () => {
        // Losing the pick on a 409 would make the operator search again for
        // somebody the page already knows they chose.
        vi.stubGlobal("fetch", mockSearch([{ id: "u1", name: "Ana Mate", usertag: "ana" }]));
        const { onClose } = setup({}, async () => { throw new Error("This person is already a host."); });

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "ana");
        await userEvent.click(await screen.findByText("Ana Mate"));
        await userEvent.click(screen.getByRole("button", { name: "Add as host" }));

        expect(await screen.findByText("This person is already a host.")).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Ana Mate")).toBeInTheDocument();
    });

    it("Back returns to the search step", async () => {
        vi.stubGlobal("fetch", mockSearch([{ id: "u1", name: "Ana Mate", usertag: "ana" }]));
        setup();
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "ana");
        await userEvent.click(await screen.findByText("Ana Mate"));
        await userEvent.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByPlaceholderText(COPY.searchPlaceholder)).toBeInTheDocument();
    });

    it("says no matches rather than leaving the list blank", async () => {
        vi.stubGlobal("fetch", mockSearch([]));
        setup();
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "zzz");
        expect(await screen.findByText("No matches.")).toBeInTheDocument();
    });

    it("waits for 2 characters on a personal listing", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }) as any);
        vi.stubGlobal("fetch", fetchMock);
        setup({ communityTag: null, currentUserId: "me" });
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "a");
        expect(screen.getByText("Start typing.")).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
