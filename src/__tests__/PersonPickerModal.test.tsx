import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersonPickerModal, type PersonPickerCopy, type PersonPickerStepTwo } from "../ui/PersonPickerModal";
import type { PersonSearchResult } from "../lib/searchPeople";

/**
 * Choose people, then confirm what happens to them.
 *
 * What is worth pinning here is the shape the four surfaces share, not the
 * markup: the roster is on screen before anything is typed, typing filters that
 * same list rather than replacing it, search only reaches past the roster when
 * the roster has nothing, and the caller never sees a typed string — onConfirm
 * gets people the server returned. That last one is the bug this component
 * replaced: a free-text "@usertag" box posting a field the API never read.
 */

const COPY: PersonPickerCopy = {
    title: "Add people",
    searchSubtitle: "Search members of this community.",
    pickedSubtitle: "They'll appear in the hosts list.",
    searchPlaceholder: "Search by name, @usertag or email",
    emptyHint: "No members yet.",
    searching: "Searching…",
    noMatches: "No matches.",
    unknown: "Unknown",
    consequencesTitle: "What happens next",
    stepOne: "Choose people",
    stepTwo: "Review",
    cancel: "Cancel",
    back: "Back",
    confirm: "Add as host",
    confirming: "Adding…",
    membersLabel: "Members",
    showingLabel: "Showing",
    allMembersLabel: "All members",
    selectedLabel: (n) => `${n} selected`,
    messageLabel: "Personal note",
    messagePlaceholder: "Add a note",
};

const Avatar = ({ className }: { user: any; className?: string }) => (
    <span data-testid="avatar" className={className} />
);

const ROSTER = [
    { id: "u-lead", name: "Ana Neto", usertag: "ana-neto", roleGroups: [{ name: "Leaders" }] },
    { id: "u-lead2", name: "Sofia Correia", usertag: "sofia-cs", roleGroups: [{ name: "Leaders" }] },
    { id: "u-mem", name: "Jamie Joana", usertag: "jamiejoana", roleGroups: [] },
];

/** Roster first, then whatever the search endpoint should answer. */
function mockApi(opts: { roster?: any[]; search?: any[] } = {}) {
    return vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/memberships")) {
            return { ok: true, json: async () => ({ members: opts.roster ?? ROSTER }) } as any;
        }
        if (u.includes("/members/search")) {
            return { ok: true, json: async () => ({ members: opts.search ?? [] }) } as any;
        }
        return { ok: true, json: async () => ({ data: opts.search ?? [] }) } as any;
    });
}

type Props = React.ComponentProps<typeof PersonPickerModal>;
const CONSEQUENCES: PersonPickerStepTwo = { kind: "consequences", items: ["They can manage the event."] };

function setup(
    over: Partial<Props> = {},
    confirmImpl: (people: PersonSearchResult[], message: string | null) => Promise<void> = async () => {},
) {
    const onConfirm = vi.fn(confirmImpl);
    const onClose = vi.fn();
    render(
        <PersonPickerModal
            open
            onClose={onClose}
            apiBaseUrl="https://api.test"
            authHeaders={() => ({})}
            communityTag="pathseekers"
            excludeUserIds={[]}
            UserAvatar={Avatar}
            copy={COPY}
            stepTwo={CONSEQUENCES}
            onConfirm={onConfirm}
            {...over}
        />,
    );
    return { onConfirm, onClose };
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the roster is the list", () => {
    it("shows members before anything is typed", async () => {
        // The old picker said "start typing to search", which is a dead end for
        // somebody who does not yet know whose name they want.
        vi.stubGlobal("fetch", mockApi());
        setup();
        expect(await screen.findByText("Ana Neto")).toBeInTheDocument();
        expect(screen.getByText("Jamie Joana")).toBeInTheDocument();
    });

    it("puts role groups first, so leaders need no filter", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup();
        await screen.findByText("Ana Neto");
        const headings = screen.getAllByText(/^(Leaders|Members)$/)
            .filter((el) => el.tagName === "P")
            .map((el) => el.textContent);
        expect(headings).toEqual(["Leaders", "Members"]);
    });

    it("offers a role select built from the roster", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup();
        await screen.findByText("Ana Neto");
        const select = screen.getByRole("combobox");
        expect(within(select).getByRole("option", { name: "Leaders" })).toBeInTheDocument();
        await userEvent.selectOptions(select, "Leaders");
        expect(screen.queryByText("Jamie Joana")).not.toBeInTheDocument();
        expect(screen.getByText("Ana Neto")).toBeInTheDocument();
    });

    it("hides people already on the list", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ excludeUserIds: ["u-lead"] });
        await screen.findByText("Sofia Correia");
        expect(screen.queryByText("Ana Neto")).not.toBeInTheDocument();
    });
});

describe("typing filters that same list", () => {
    it("narrows the roster without calling search", async () => {
        const fetchMock = mockApi();
        vi.stubGlobal("fetch", fetchMock);
        setup();
        await screen.findByText("Ana Neto");

        // "sofia", not "ana" — "Jamie Joana" CONTAINS "ana", so that query
        // would have been testing the fixture rather than the filter.
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "sofia");
        await waitFor(() => expect(screen.queryByText("Jamie Joana")).not.toBeInTheDocument());
        expect(screen.getByText("Sofia Correia")).toBeInTheDocument();

        // The roster answered, so nothing reached the search endpoint.
        expect(fetchMock.mock.calls.some(([u]: any) => String(u).includes("/members/search"))).toBe(false);
    });

    it("reaches past the roster only when the roster has nothing", async () => {
        // Somebody who is not a member yet is exactly who an invitation is for.
        const fetchMock = mockApi({ search: [{ id: "u-new", name: "Nia New", usertag: "nia" }] });
        vi.stubGlobal("fetch", fetchMock);
        setup();
        await screen.findByText("Ana Neto");

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "nia");
        expect(await screen.findByText("Nia New")).toBeInTheDocument();
    });
});

describe("picking and confirming", () => {
    it("hands onConfirm people the SERVER returned, not a typed string", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup();
        await screen.findByText("Ana Neto");

        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm.mock.calls[0][0]).toEqual([
            expect.objectContaining({ id: "u-lead", usertag: "ana-neto" }),
        ]);
    });

    it("takes several when multiple, and counts them", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByText("Sofia Correia"));
        expect(screen.getByText("2 selected")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm.mock.calls[0][0]).toHaveLength(2));
    });

    it("replaces the pick when single-select", async () => {
        // Host and co-seller are one person; ticking a second must not stage two.
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ multiple: false });
        await screen.findByText("Ana Neto");

        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByText("Sofia Correia"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm.mock.calls[0][0]).toHaveLength(1));
        expect(onConfirm.mock.calls[0][0][0].id).toBe("u-lead2");
    });

    it("cannot continue with nobody picked", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup();
        await screen.findByText("Ana Neto");
        expect(screen.getByRole("button", { name: COPY.stepTwo })).toBeDisabled();
    });
});

describe("step two", () => {
    it("shows the consequences before the write, not after", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup();
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));

        expect(screen.getByText("What happens next")).toBeInTheDocument();
        expect(screen.getByText("They can manage the event.")).toBeInTheDocument();
    });

    it("walks back through the breadcrumb, not a footer button", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup();
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));

        // Back lives in the breadcrumb, the way it does on the detail pages.
        await userEvent.click(screen.getByRole("button", { name: COPY.back }));
        expect(screen.getByPlaceholderText(COPY.searchPlaceholder)).toBeInTheDocument();
    });

    it("keeps the pick and shows the reason when the write fails", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onClose } = setup({}, async () => { throw new Error("Already a host."); });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));

        expect(await screen.findByText("Already a host.")).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Ana Neto")).toBeInTheDocument();
    });
});

describe("compose mode", () => {
    const COMPOSE: PersonPickerStepTwo = {
        kind: "compose",
        preview: (message) => <div data-testid="preview">{message || "(no note)"}</div>,
        maxLength: 20,
    };

    it("previews the note as it is typed", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ stepTwo: COMPOSE });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));

        expect(screen.getByTestId("preview")).toHaveTextContent("(no note)");
        await userEvent.type(screen.getByPlaceholderText("Add a note"), "hello");
        expect(screen.getByTestId("preview")).toHaveTextContent("hello");
    });

    it("stops at maxLength rather than silently truncating on send", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ stepTwo: COMPOSE });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));

        await userEvent.type(screen.getByPlaceholderText("Add a note"), "x".repeat(30));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][1]).toHaveLength(20);
    });

    it("passes null when no note was written", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ stepTwo: COMPOSE });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][1]).toBeNull();
    });
});

describe("a listing no community owns", () => {
    it("has no roster and goes straight to global search", async () => {
        const fetchMock = mockApi({ search: [{ id: "u-any", name: "Bo Global", usertag: "bo" }] });
        vi.stubGlobal("fetch", fetchMock);
        setup({ communityTag: null, currentUserId: "me" });

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "bo");
        expect(await screen.findByText("Bo Global")).toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([u]: any) => String(u).includes("/memberships"))).toBe(false);
    });
});
