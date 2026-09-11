import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PersonPickerModal,
    type PersonPickerCopy, type PersonPickerStepTwo,
    type PersonPickerEmails, type PersonPickerTierStep,
} from "../ui/PersonPickerModal";
import type { Recipient } from "../lib/recipients";

/**
 * Adding somebody consumes a tier, so adding takes a tier.
 *
 * ── What this is defending ──────────────────────────────────────────────────
 *
 * A seat belongs to a ticket tier, never to the event. Before this step
 * existed, a host comping ten VIPs silently ate ten General Admission seats —
 * the backend fell back to the default tier and nobody was ever asked.
 *
 * The load-bearing assertions here are about what `onConfirm` RECEIVES, not
 * about what is on screen: the tier has to ride on each recipient, because
 * that is the only thing the endpoint reads.
 */

const COPY: PersonPickerCopy = {
    title: "Add attendees",
    searchSubtitle: "Search members.",
    pickedSubtitle: "Review.",
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
    confirm: "Add attendees",
    confirming: "Adding…",
    membersLabel: "Members",
    showingLabel: "Showing",
    allMembersLabel: "All members",
    selectedLabel: (n) => `${n} selected`,
    selectedTitle: "Selected",
    clearAll: "Clear all",
    remove: (name) => `Remove ${name}`,
};

const EMAILS: PersonPickerEmails = {
    addRow: (a) => `Add ${a}`,
    importCsv: "Import CSV",
    imported: (n) => `Imported ${n}`,
    importedNothing: "No addresses in that file.",
    importFailed: "Could not read that file.",
};

const TIER_STEP = (over: Partial<PersonPickerTierStep> = {}): PersonPickerTierStep => ({
    tiers: [
        { id: "t-ga", name: "General", remaining: 3, soldOut: false },
        { id: "t-vip", name: "VIP", remaining: 0, soldOut: true },
    ],
    copy: {
        stepLabel: "Choose a tier",
        subtitle: "Which ticket are they getting?",
        remaining: (n) => `${n} left`,
        unlimited: "Unlimited",
        soldOut: "Sold out",
        allFull: "Every tier is full. Raise a cap to add anyone.",
        summary: (n, t) => `${n} going to ${t}`,
        overBy: (n, t) => `${n} more than ${t} has room for`,
        importPreviewTitle: "Check this import",
        importReady: (n) => `${n} will be added`,
        importProblems: (n) => `${n} cannot be added`,
        problemUnknownTier: (t) => `No tier called "${t}"`,
        problemNoTier: "No tier chosen",
        problemTierFull: "That tier is full",
        importConfirm: "Import",
        importCancel: "Cancel import",
    },
    ...over,
});

const CONSEQUENCES: PersonPickerStepTwo = { kind: "consequences", items: ["They are on the list."] };
const Avatar = ({ className }: { user: any; className?: string }) => <span className={className} />;

const ROSTER = [
    { id: "u-ana", name: "Ana Neto", usertag: "ana-neto", profileImage: null, roleGroups: [] },
    { id: "u-bo", name: "Bo Silva", usertag: "bo-silva", profileImage: null, roleGroups: [] },
];

function mockApi() {
    return vi.fn(async (url: string) => {
        if (String(url).includes("/memberships")) {
            return { ok: true, json: async () => ({ members: ROSTER }) } as any;
        }
        return { ok: true, json: async () => ({ members: [] }) } as any;
    });
}

function setup(over: Partial<React.ComponentProps<typeof PersonPickerModal>> = {}) {
    const onConfirm = vi.fn(async (_r: Recipient[], _m: string | null) => {});
    render(
        <PersonPickerModal
            open
            onClose={vi.fn()}
            apiBaseUrl="https://api.test"
            authHeaders={() => ({})}
            communityTag="c"
            excludeUserIds={[]}
            UserAvatar={Avatar}
            multiple
            copy={COPY}
            stepTwo={CONSEQUENCES}
            tierStep={TIER_STEP()}
            onConfirm={onConfirm}
            {...over}
        />,
    );
    return { onConfirm };
}

/** A File whose text() resolves — jsdom's File does not implement it. */
function csvFile(body: string): File {
    const f = new File([body], "guests.csv", { type: "text/csv" });
    Object.defineProperty(f, "text", { value: async () => body });
    return f;
}

beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal("fetch", mockApi()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the tier step exists only where capacity is consumed", () => {
    it("sits between choosing people and confirming", async () => {
        const user = userEvent.setup();
        setup();
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));

        expect(screen.getByText("Which ticket are they getting?")).toBeInTheDocument();
        expect(screen.getByText("General")).toBeInTheDocument();
    });

    it("is absent on an invite surface, which consumes nothing", async () => {
        // Inviting is to the item itself; the invitee picks a tier at
        // checkout. Asking the host to choose one would be asking them to
        // decide something that is not theirs to decide.
        const user = userEvent.setup();
        setup({ tierStep: undefined });
        await user.click(await screen.findByText("Ana Neto"));

        expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
        expect(screen.queryByText("Choose a tier")).not.toBeInTheDocument();
    });

    it("walks back through the breadcrumb one step at a time", async () => {
        const user = userEvent.setup();
        setup();
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        // General is the only open tier here, so it is already selected;
        // clicking it is a no-op that keeps the intent of the step explicit.
        await user.click(screen.getByText("General"));
        await user.click(screen.getByRole("button", { name: "Review" }));

        // Confirm → tier
        await user.click(screen.getByRole("button", { name: COPY.back }));
        expect(screen.getByText("Which ticket are they getting?")).toBeInTheDocument();
        // tier → people
        await user.click(screen.getByRole("button", { name: COPY.back }));
        expect(screen.getByPlaceholderText(COPY.searchPlaceholder)).toBeInTheDocument();
    });
});

describe("choosing a tier", () => {
    it("puts the chosen tier on every recipient", async () => {
        // The only assertion that matters: the endpoint reads this field.
        const user = userEvent.setup();
        const { onConfirm } = setup();
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByText("Bo Silva"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        await user.click(screen.getByText("General"));
        await user.click(screen.getByRole("button", { name: "Review" }));
        await user.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0].every((r: Recipient) => r.tierId === "t-ga")).toBe(true);
    });

    it("shows a full tier but will not let it be chosen", async () => {
        /*
         * Shown, not hidden. Hiding VIP leaves the host wondering where it
         * went; showing it full is what tells them to go raise the cap.
         */
        const user = userEvent.setup();
        setup();
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));

        const vip = screen.getByText("VIP").closest("button")!;
        expect(vip).toBeDisabled();
        expect(screen.getByText("Sold out")).toBeInTheDocument();
    });

    it("shows what is left on each tier", async () => {
        const user = userEvent.setup();
        setup();
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        expect(screen.getByText("3 left")).toBeInTheDocument();
    });

    it("preselects a lone open tier rather than making them click it", async () => {
        const user = userEvent.setup();
        const { onConfirm } = setup({
            tierStep: TIER_STEP({ tiers: [{ id: "t-only", name: "Only", remaining: null, soldOut: false }] }),
        });
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        await user.click(screen.getByRole("button", { name: "Review" }));
        await user.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0][0].tierId).toBe("t-only");
    });

    it("cannot move on with no tier chosen", async () => {
        // TWO open tiers, so there is a genuine choice and nothing is
        // preselected. (One open tier plus a full one still preselects: the
        // rule is about how many are choosable, not how many exist.)
        const user = userEvent.setup();
        setup({
            tierStep: TIER_STEP({
                tiers: [
                    { id: "t-ga", name: "General", remaining: 3, soldOut: false },
                    { id: "t-open", name: "Open", remaining: null, soldOut: false },
                ],
            }),
        });
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));

        expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    });

    it("says so plainly when every tier is full", async () => {
        const user = userEvent.setup();
        setup({
            tierStep: TIER_STEP({
                tiers: [{ id: "t-ga", name: "General", remaining: 0, soldOut: true }],
            }),
        });
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));

        expect(screen.getByText(/Every tier is full/)).toBeInTheDocument();
    });

    it("warns when more people are staged than the tier holds", async () => {
        // Three seats, four people. Better said here than discovered as four
        // half-failed writes.
        const user = userEvent.setup();
        setup({
            tierStep: TIER_STEP({
                tiers: [{ id: "t-ga", name: "General", remaining: 1, soldOut: false }],
            }),
        });
        await user.click(await screen.findByText("Ana Neto"));
        await user.click(screen.getByText("Bo Silva"));
        await user.click(screen.getByRole("button", { name: "Choose a tier" }));

        expect(screen.getByText(/2 going to General/)).toBeInTheDocument();
        expect(screen.getByText(/1 more than General has room for/)).toBeInTheDocument();
    });
});

describe("importing a CSV that names tiers", () => {
    async function importFile(user: ReturnType<typeof userEvent.setup>, body: string) {
        await screen.findByText("Ana Neto");
        await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, csvFile(body));
    }

    it("shows what would happen instead of doing it", async () => {
        /*
         * Nothing is staged until the host confirms. Importing first and
         * reporting afterwards leaves them reconciling two lists against a
         * capacity that has already moved.
         */
        const user = userEvent.setup();
        setup({ emails: EMAILS });
        await importFile(user, "a@x.com,General\nb@x.com,General");

        expect(await screen.findByText("Check this import")).toBeInTheDocument();
        expect(screen.getByText("2 will be added")).toBeInTheDocument();
        expect(screen.queryByText(COPY.selectedTitle)).not.toBeInTheDocument();
    });

    it("stages the importable rows once confirmed", async () => {
        const user = userEvent.setup();
        const { onConfirm } = setup({ emails: EMAILS });
        await importFile(user, "a@x.com,General\nb@x.com,General");
        await user.click(await screen.findByRole("button", { name: "Import" }));

        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        await user.click(screen.getByRole("button", { name: "Review" }));
        await user.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm.mock.calls[0][0]).toEqual([
            { email: "a@x.com", tierId: "t-ga" },
            { email: "b@x.com", tierId: "t-ga" },
        ]);
    });

    it("names the rows it cannot take, and why", async () => {
        // A count alone does not tell anybody which line to go and fix.
        const user = userEvent.setup();
        setup({ emails: EMAILS });
        await importFile(user, "a@x.com,General\nb@x.com,Erly Bird");

        expect(await screen.findByText("1 cannot be added")).toBeInTheDocument();
        expect(screen.getByText("b@x.com")).toBeInTheDocument();
        expect(screen.getByText('No tier called "Erly Bird"')).toBeInTheDocument();
    });

    it("takes what fits and flags the overflow rather than failing the file", async () => {
        const user = userEvent.setup();
        setup({ emails: EMAILS });
        await importFile(user, ["a", "b", "c", "d"].map((n) => `${n}@x.com,General`).join("\n"));

        expect(await screen.findByText("3 will be added")).toBeInTheDocument();
        expect(screen.getByText("1 cannot be added")).toBeInTheDocument();
        expect(screen.getByText("That tier is full")).toBeInTheDocument();
    });

    it("discards the whole import on cancel", async () => {
        const user = userEvent.setup();
        setup({ emails: EMAILS });
        await importFile(user, "a@x.com,General");
        await user.click(await screen.findByRole("button", { name: "Cancel import" }));

        await waitFor(() => expect(screen.queryByText("Check this import")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Choose a tier" })).toBeDisabled();
    });

    it("keeps an imported row's own tier when the host picks a different default", async () => {
        /*
         * The default is stamped on ONLY at confirm, and only onto people who
         * do not already have one. Stamping per pick would silently reseat
         * everybody the moment the host changed their mind.
         */
        const user = userEvent.setup();
        const { onConfirm } = setup({
            emails: EMAILS,
            tierStep: TIER_STEP({
                tiers: [
                    { id: "t-ga", name: "General", remaining: 5, soldOut: false },
                    { id: "t-open", name: "Open", remaining: null, soldOut: false },
                ],
            }),
        });
        await importFile(user, "a@x.com,Open");
        await user.click(await screen.findByRole("button", { name: "Import" }));
        await user.click(screen.getByText("Ana Neto"));

        await user.click(screen.getByRole("button", { name: "Choose a tier" }));
        await user.click(screen.getByText("General"));
        await user.click(screen.getByRole("button", { name: "Review" }));
        await user.click(screen.getByRole("button", { name: COPY.confirm }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        const sent = onConfirm.mock.calls[0][0] as Recipient[];
        expect(sent.find((r) => r.email === "a@x.com")?.tierId).toBe("t-open");
        expect(sent.find((r) => r.id === "u-ana")?.tierId).toBe("t-ga");
    });
});
