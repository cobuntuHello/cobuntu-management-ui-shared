import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PersonPickerModal,
    type PersonPickerCopy, type PersonPickerStepTwo, type PersonPickerEmails,
} from "../ui/PersonPickerModal";
import type { Recipient } from "../lib/recipients";

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
    selectedTitle: "Selected",
    clearAll: "Clear all",
    remove: (name) => `Remove ${name}`,
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
    confirmImpl: (recipients: Recipient[], message: string | null) => Promise<void> = async () => {},
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

/*
 * ── The three things invitations need ───────────────────────────────────────
 *
 * The events invite modal had all of these before it was a shared component.
 * Moving it here without them would be a silent feature removal from a flow
 * people use every week, so each one is pinned.
 */

const EMAILS: PersonPickerEmails = {
    addRow: (a) => `Invite ${a}`,
    importCsv: "Import CSV",
    imported: (n) => `Imported ${n} addresses`,
    importedNothing: "No addresses in that file.",
    importFailed: "Could not read that file.",
};

/** A File whose text() resolves — jsdom's File does not implement it. */
function csvFile(body: string): File {
    const f = new File([body], "guests.csv", { type: "text/csv" });
    Object.defineProperty(f, "text", { value: async () => body });
    return f;
}

describe("recipients with no account", () => {
    it("offers a typed address as a recipient", async () => {
        // Inviting somebody who is not a member yet is most of what inviting
        // is for. Without this the modal can only reach people already inside.
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "outsider@example.com");
        await userEvent.click(await screen.findByText("Invite outsider@example.com"));

        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0]).toEqual([{ email: "outsider@example.com" }]);
    });

    it("does not offer one on a surface that cannot use it", async () => {
        // A host or co-seller write needs a user id. Offering an address there
        // stages somebody the endpoint will reject.
        vi.stubGlobal("fetch", mockApi());
        setup({ multiple: true });
        await screen.findByText("Ana Neto");
        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "outsider@example.com");
        await waitFor(() => expect(screen.getByText(COPY.noMatches)).toBeInTheDocument());
        expect(screen.queryByText(/^Invite /)).not.toBeInTheDocument();
    });

    it("clears the box after staging, so the next one can be typed", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        const box = screen.getByPlaceholderText(COPY.searchPlaceholder) as HTMLInputElement;
        await userEvent.type(box, "a@example.com");
        await userEvent.click(await screen.findByText("Invite a@example.com"));
        expect(box.value).toBe("");
    });

    it("will not offer the same address twice", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        const box = screen.getByPlaceholderText(COPY.searchPlaceholder);
        await userEvent.type(box, "a@example.com");
        await userEvent.click(await screen.findByText("Invite a@example.com"));
        await userEvent.type(box, "a@example.com");
        await waitFor(() => expect(screen.queryByText("Invite a@example.com")).not.toBeInTheDocument());
    });
});

describe("CSV import", () => {
    it("stages every address in the file", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.upload(
            document.querySelector('input[type="file"]') as HTMLInputElement,
            csvFile("email,name\na@example.com,A\nb@example.com,B"),
        );

        expect(await screen.findByText("Imported 2 addresses")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0]).toEqual([
            { email: "a@example.com" }, { email: "b@example.com" },
        ]);
    });

    it("says so when the file had nothing usable, instead of looking broken", async () => {
        // The common miss is a file whose first column is names. Reporting
        // "imported 0" beats a control that appears to do nothing.
        vi.stubGlobal("fetch", mockApi());
        setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.upload(
            document.querySelector('input[type="file"]') as HTMLInputElement,
            csvFile("Ana,a@example.com\nBo,b@example.com"),
        );
        expect(await screen.findByText("No addresses in that file.")).toBeInTheDocument();
    });

    it("does not re-stage somebody already picked from the roster", async () => {
        // Importing a list you had already half worked through is normal.
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));

        await userEvent.upload(
            document.querySelector('input[type="file"]') as HTMLInputElement,
            csvFile("a@example.com\na@example.com"),
        );
        await screen.findByText("Imported 1 addresses");

        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0]).toHaveLength(2);
    });
});

describe("the staged strip", () => {
    it("can remove somebody who is not on screen to untick", async () => {
        /*
         * This is why the strip exists. An imported address has no roster row,
         * so without a chip there is no way to take it back out short of
         * closing the modal and starting again.
         */
        vi.stubGlobal("fetch", mockApi());
        setup({ emails: EMAILS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.upload(
            document.querySelector('input[type="file"]') as HTMLInputElement,
            csvFile("gone@example.com"),
        );
        await screen.findByText("Imported 1 addresses");

        await userEvent.click(screen.getByRole("button", { name: "Remove gone@example.com" }));
        await waitFor(() => expect(screen.queryByText("gone@example.com")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: COPY.stepTwo })).toBeDisabled();
    });

    it("empties in one go", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ multiple: true });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByText("Sofia Correia"));

        await userEvent.click(screen.getByRole("button", { name: COPY.clearAll }));
        await waitFor(() => expect(screen.queryByText("2 selected")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: COPY.stepTwo })).toBeDisabled();
    });

    it("stays out of the way when only one person can be picked", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ multiple: false });
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        expect(screen.queryByText(COPY.selectedTitle)).not.toBeInTheDocument();
    });
});

describe("suggestion chips", () => {
    const rita = { id: "u-r1", name: "Rita Reis", usertag: "rita", profileImage: null };
    const ROWS = [
        { label: "Recently invited", people: [rita] },
        { label: "Frequent attendees", people: [rita] },
    ];

    it("stages somebody in one tap", async () => {
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ suggestions: ROWS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.click(screen.getByRole("button", { name: /Rita Reis/ }));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "u-r1" })]);
    });

    it("shows a person once across rows, not once per row", async () => {
        // Somebody can be both recently invited and a frequent attendee. The
        // events modal renders that as two identical chips.
        vi.stubGlobal("fetch", mockApi());
        setup({ suggestions: ROWS, multiple: true });
        await screen.findByText("Ana Neto");
        expect(screen.getAllByRole("button", { name: /Rita Reis/ })).toHaveLength(1);
    });

    it("drops the chip once that person is staged", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ suggestions: ROWS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.click(screen.getByRole("button", { name: /Rita Reis/ }));
        // The name survives in the staged strip; the shortcut row is gone.
        await waitFor(() => expect(screen.queryByText("Recently invited")).not.toBeInTheDocument());
    });

    it("gets out of the way once a search is under way", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ suggestions: ROWS, multiple: true });
        await screen.findByText("Ana Neto");

        await userEvent.type(screen.getByPlaceholderText(COPY.searchPlaceholder), "sofia");
        await waitFor(() => expect(screen.queryByText("Recently invited")).not.toBeInTheDocument());
    });
});

describe("per-recipient notes", () => {
    const PER_RECIPIENT: PersonPickerStepTwo = {
        kind: "compose",
        preview: (m) => <div data-testid="preview">{m || "(no note)"}</div>,
        maxLength: 200,
        perRecipient: {
            personalize: "Personalize",
            personalized: "Has its own note",
            save: "Save",
            cancel: "Discard",
            placeholder: (name) => `Write to ${name}`,
        },
    };

    async function toStepTwo() {
        await screen.findByText("Ana Neto");
        await userEvent.click(screen.getByText("Ana Neto"));
        await userEvent.click(screen.getByText("Sofia Correia"));
        await userEvent.click(screen.getByRole("button", { name: COPY.stepTwo }));
    }

    it("sends one person's note alongside the shared one", async () => {
        /*
         * The BE takes both: customMessage for everyone, plus an override
         * array. Ana gets her own words; Sofia gets the shared note.
         */
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ stepTwo: PER_RECIPIENT, multiple: true });
        await toStepTwo();

        await userEvent.type(screen.getByPlaceholderText("Add a note"), "See you there");
        await userEvent.click(screen.getAllByRole("button", { name: "Personalize" })[0]);
        await userEvent.type(screen.getByPlaceholderText("Write to Ana Neto"), "Bring the slides");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        const [recipients, shared] = onConfirm.mock.calls[0];
        expect(shared).toBe("See you there");
        expect(recipients).toHaveLength(2);
        expect(recipients[0]).toMatchObject({ id: "u-lead", note: "Bring the slides" });
        // Sofia carries no note at all, so the server falls back to the shared one.
        expect(recipients[1].id).toBe("u-lead2");
        expect(recipients[1].note).toBeUndefined();
    });

    it("marks who already has one", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ stepTwo: PER_RECIPIENT, multiple: true });
        await toStepTwo();

        expect(screen.queryByText("Has its own note")).not.toBeInTheDocument();
        await userEvent.click(screen.getAllByRole("button", { name: "Personalize" })[0]);
        await userEvent.type(screen.getByPlaceholderText("Write to Ana Neto"), "hi");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(screen.getByText("Has its own note")).toBeInTheDocument();
    });

    it("discards a draft rather than keeping what was typed", async () => {
        // Cancel that silently saves is the reason the editor holds its own
        // draft instead of writing through on every keystroke.
        vi.stubGlobal("fetch", mockApi());
        const { onConfirm } = setup({ stepTwo: PER_RECIPIENT, multiple: true });
        await toStepTwo();

        await userEvent.click(screen.getAllByRole("button", { name: "Personalize" })[0]);
        await userEvent.type(screen.getByPlaceholderText("Write to Ana Neto"), "never mind");
        await userEvent.click(screen.getByRole("button", { name: "Discard" }));

        await userEvent.click(screen.getByRole("button", { name: COPY.confirm }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0][0].note).toBeUndefined();
    });

    it("keeps the compact summary when the surface has no per-recipient notes", async () => {
        vi.stubGlobal("fetch", mockApi());
        setup({ multiple: true });
        await toStepTwo();
        expect(screen.queryByRole("button", { name: "Personalize" })).not.toBeInTheDocument();
        expect(screen.getByText("Ana Neto, Sofia Correia")).toBeInTheDocument();
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
