"use client";

import * as React from "react";
import { ActionModalShell } from "./ActionModalShell";
import { searchPeople, minQueryLength, type PersonSearchResult } from "../lib/searchPeople";
import { fetchCommunityRoster, groupRoster, rosterRoles, type RosterPerson, type RosterGroup } from "../lib/communityRoster";
import {
    addRecipients, fromPerson, looksLikeEmail, parseCsvEmails, parseCsvRecipientRows,
    planImport, recipientsFromPlan, recipientKey, tierPlanFor, applyDefaultTier,
    visibleSuggestions, type Recipient, type ImportPlan,
} from "../lib/recipients";

/**
 * Choose people, then confirm what happens to them.
 *
 * ── One component, four surfaces ────────────────────────────────────
 *
 * Add an attendee, invite someone to buy, make a host, make a co-seller. Step
 * one is identical in all four; only step two differs, and only where the
 * action genuinely differs. Before this there were three implementations of the
 * same flow and one of them — the product co-seller modal — had never worked at
 * all, because nobody diffs three files.
 *
 * ── The roster is the list, and search filters it ───────────────────
 *
 * The community's members are on screen from the moment it opens, grouped by
 * role with role groups first. Typing narrows that same list rather than
 * replacing it with a different one, so browsing and searching are one control
 * rather than two modes to learn — and "show me the leaders" needs no filter,
 * because they are already at the top.
 *
 * A search still reaches PAST the roster when the query finds nobody in it: the
 * member-search endpoint and, for a listing no community owns, global user
 * search. Someone who is not a member yet is exactly who an invitation is for.
 *
 * ── Three things only invitations need ──────────────────────────────
 *
 * `emails`, `suggestions` and compose's `perRecipient` are each opt-in, and
 * each carries its OWN words rather than adding optional keys to the shared
 * copy object. That is deliberate: a surface cannot switch a feature on and
 * forget to translate it, because the words are the switch. They exist because
 * the events invite modal already had all three, and moving it onto this
 * component while silently dropping CSV import is the kind of regression that
 * gets found in production rather than in review.
 *
 * ── Going back uses the app's breadcrumb ────────────────────────────
 *
 * Step two opens with the same control the event and product detail pages
 * carry, which is why the footer has no Back button — on those pages, back
 * lives in the breadcrumb. Step one has no breadcrumb because nothing is behind
 * it; a trail naming a screen you have not reached is furniture.
 */

export interface PersonPickerCopy {
    title: string;
    searchSubtitle: string;
    pickedSubtitle: string;
    searchPlaceholder: string;
    /** Shown when the roster is empty and nothing has been typed. */
    emptyHint: string;
    searching: string;
    noMatches: string;
    unknown: string;
    /** Heading above the consequence list on step two. */
    consequencesTitle: string;
    /** Breadcrumb parent — the step you came from. */
    stepOne: string;
    /** Breadcrumb current — the step you are on. */
    stepTwo: string;
    cancel: string;
    /** Accessible name for the breadcrumb's chevron. Distinct from stepOne so
        the chevron and the label are not two controls with one name. */
    back: string;
    confirm: string;
    confirming: string;
    /** Group heading for members with no role group. */
    membersLabel: string;
    /** "Showing" label beside the role select. */
    showingLabel: string;
    allMembersLabel: string;
    /** "{n} selected". Given the count so the caller can pluralise. */
    selectedLabel: (n: number) => string;
    /** Heading over the staged strip, and the control that empties it. */
    selectedTitle: string;
    clearAll: string;
    /** Accessible name for one chip's remove control. */
    remove: (name: string) => string;
    /** Label above the message box, compose mode only. */
    messageLabel?: string;
    messagePlaceholder?: string;
    /** Shown while dismissing with a pick staged. Omit for the shell default. */
    discardConfirm?: string;
}

/**
 * Recipients who have no account yet.
 *
 * Turning this on is what makes the picker an INVITE surface rather than a
 * roster surface: an address can be typed, or a few hundred can arrive from a
 * CSV. Adding somebody as a host or a co-seller cannot work this way, since
 * both write a row that needs a user id, so those surfaces leave it off.
 */
export interface PersonPickerEmails {
    /** The row that stages a typed address. Given the address. */
    addRow: (address: string) => string;
    importCsv: string;
    imported: (n: number) => string;
    /** Shown when the file had no addresses in its first column. */
    importedNothing: string;
    importFailed: string;
}

/** Per-recipient overrides of the shared message. */
export interface PersonPickerPerRecipient {
    personalize: string;
    /** Marks somebody who already has a note of their own. */
    personalized: string;
    save: string;
    cancel: string;
    placeholder: (name: string) => string;
}

export type PersonPickerStepTwo =
    /** Says what the action will do. Used by add-directly, host, co-seller. */
    | { kind: "consequences"; items: React.ReactNode[] }
    /** Write a note and see the email. Used by invitations. */
    | {
        kind: "compose";
        preview: (message: string) => React.ReactNode;
        maxLength?: number;
        perRecipient?: PersonPickerPerRecipient;
    };

/**
 * Choosing which tier the people being added will occupy.
 *
 * ── Why adding takes a tier and inviting does not ───────────────────────────
 *
 * A seat belongs to a ticket tier, and a unit of stock belongs to a product
 * variant — never to the event or product as a whole. So adding somebody
 * consumes a specific tier and has to say which one. Inviting consumes
 * nothing: the invitee picks a tier at checkout, so an invite surface leaves
 * this prop off and keeps its two steps.
 *
 * ── A full tier is shown, not hidden ────────────────────────────────────────
 *
 * It cannot be chosen, but it stays on screen with its numbers. Hiding it
 * would leave a host wondering where VIP went; showing it full is what tells
 * them to go raise the cap and come back.
 */
export interface PersonPickerTierStep {
    tiers: Array<{
        id: string;
        name: string;
        /** null = uncapped. */
        remaining: number | null;
        soldOut: boolean;
    }>;
    copy: {
        /** Breadcrumb label and the button that leads here. */
        stepLabel: string;
        subtitle: string;
        /** "3 left" beside a capped tier. */
        remaining: (n: number) => string;
        unlimited: string;
        soldOut: string;
        /** Shown when every tier is full and nobody can be added at all. */
        allFull: string;
        /** "12 going to General" in the summary. */
        summary: (n: number, tierName: string) => string;
        /** "2 more than General has room for". */
        overBy: (n: number, tierName: string) => string;
        /** Heading over the CSV import preview. */
        importPreviewTitle: string;
        /** "{n} rows will be added". */
        importReady: (n: number) => string;
        /** "{n} rows cannot be added". */
        importProblems: (n: number) => string;
        problemUnknownTier: (tierName: string) => string;
        problemNoTier: string;
        problemTierFull: string;
        importConfirm: string;
        importCancel: string;
    };
}

export interface PersonPickerModalProps {
    open: boolean;
    onClose: () => void;
    apiBaseUrl: string;
    authHeaders: () => Record<string, string>;
    /** Truthy → community roster + member search. Null → global user search. */
    communityTag: string | null;
    excludeUserIds: string[];
    currentUserId?: string | null;
    UserAvatar: React.ComponentType<{ user: any; className?: string }>;
    /** Several people, or exactly one (host, co-seller). */
    multiple?: boolean;
    copy: PersonPickerCopy;
    stepTwo: PersonPickerStepTwo;
    /** Opt in to addresses with no account behind them. */
    emails?: PersonPickerEmails;
    /**
     * Opt in to a tier step between choosing people and confirming.
     *
     * Present on surfaces that ADD somebody, because adding consumes a
     * specific tier's capacity. Absent on invite surfaces, which consume
     * nothing and stay two steps.
     */
    tierStep?: PersonPickerTierStep;
    /**
     * Shortcut rows above the list — recently invited, frequent attendees.
     * The caller fetches them, because which list is worth suggesting is a
     * question about events or products, not about picking people.
     */
    suggestions?: Array<{ label: string; people: PersonSearchResult[] }>;
    /** Performs the write. Throw an Error to surface its message. */
    onConfirm: (recipients: Recipient[], message: string | null) => Promise<void>;
    onAdded?: (recipients: Recipient[]) => void;
}

const CHEVRON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

export function PersonPickerModal({
    open, onClose, apiBaseUrl, authHeaders, communityTag, excludeUserIds,
    currentUserId, UserAvatar, multiple = false, copy, stepTwo, emails, suggestions,
    tierStep, onConfirm, onAdded,
}: PersonPickerModalProps) {
    /*
     * The steps, derived from the props rather than hard-coded.
     *
     * This was `useState<1 | 2>`, which forbade a third step at the type
     * level. Adding a tier step is not an extra screen bolted on — it is the
     * difference between a surface that consumes capacity and one that does
     * not, so the flow's SHAPE follows from whether `tierStep` is given.
     */
    const stepNames = React.useMemo(
        () => (tierStep ? (['people', 'tier', 'confirm'] as const) : (['people', 'confirm'] as const)),
        [tierStep],
    );
    const [stepIdx, setStepIdx] = React.useState(0);
    const step = stepNames[Math.min(stepIdx, stepNames.length - 1)];
    const goTo = (i: number) => setStepIdx(Math.max(0, Math.min(i, stepNames.length - 1)));
    const [query, setQuery] = React.useState("");
    const [roster, setRoster] = React.useState<RosterPerson[]>([]);
    const [rosterLoading, setRosterLoading] = React.useState(false);
    const [role, setRole] = React.useState<string>("");
    const [found, setFound] = React.useState<PersonSearchResult[]>([]);
    const [searching, setSearching] = React.useState(false);
    const [picked, setPicked] = React.useState<Recipient[]>([]);
    const [message, setMessage] = React.useState("");
    const [editing, setEditing] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const csvInput = React.useRef<HTMLInputElement>(null);
    /** The tier everyone gets unless their own row named a different one. */
    const [defaultTierId, setDefaultTierId] = React.useState<string | null>(null);
    /** A parsed CSV awaiting confirmation. Nothing is staged until it is. */
    const [plan, setPlan] = React.useState<ImportPlan | null>(null);

    /*
     * The breadcrumb trail. Two steps or three, depending on whether this
     * surface consumes capacity.
     */
    const stepLabels = React.useMemo(
        () => (tierStep
            ? [copy.stepOne, tierStep.copy.stepLabel, copy.stepTwo]
            : [copy.stepOne, copy.stepTwo]),
        [tierStep, copy.stepOne, copy.stepTwo],
    );
    const nextLabel = stepLabels[1];

    /* Every tier full means nobody can be added at all — worth saying plainly
       rather than leaving a list where nothing is clickable. */
    const anyTierOpen = !tierStep || tierStep.tiers.some((t) => !t.soldOut);

    /* Where the staged people would land. Anyone carrying their own tier (an
       imported row that named one) keeps it; the rest fall to the default. */
    const tierSummary = React.useMemo(
        () => (tierStep ? tierPlanFor(picked, tierStep.tiers, defaultTierId) : []),
        [tierStep, picked, defaultTierId],
    );

    const excludeKey = excludeUserIds.join(",");
    const maxLength = stepTwo.kind === "compose" ? (stepTwo.maxLength ?? 500) : 0;
    const perRecipient = stepTwo.kind === "compose" ? stepTwo.perRecipient : undefined;

    React.useEffect(() => {
        if (!open) return;
        setStepIdx(0); setQuery(""); setRole(""); setPicked([]);
        setMessage(""); setError(null); setFound([]); setEditing(null); setNotice(null);
        setPlan(null);
        /*
         * Opening state for the tier, decided HERE rather than in an effect of
         * its own. A separate preselect effect declared above this one ran
         * first, set the tier, and was then wiped by this reset in the same
         * commit — after which its deps never changed again, so it never fired
         * a second time and the tier stayed unchosen forever.
         *
         * One open tier is not a choice, so it is preselected rather than
         * making the host click the only thing on screen.
         */
        const openTiers = (tierStep?.tiers ?? []).filter((t) => !t.soldOut);
        setDefaultTierId(openTiers.length === 1 ? openTiers[0].id : null);
    }, [open]);

    /*
     * The step change, animated. Forward slides in from the right and back from
     * the left, so the breadcrumb's direction is felt rather than only read.
     * `motion-reduce` drops it to a plain swap.
     */
    const [entered, setEntered] = React.useState(true);
    React.useEffect(() => {
        setEntered(false);
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, [step]);

    // Roster, once per open. It is the list; search filters it.
    React.useEffect(() => {
        if (!open || !communityTag) { setRoster([]); return; }
        let cancelled = false;
        setRosterLoading(true);
        fetchCommunityRoster({ apiBaseUrl, communityTag, headers: authHeaders() })
            .then((people) => { if (!cancelled) setRoster(people); })
            .finally(() => { if (!cancelled) setRosterLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, communityTag, apiBaseUrl]);

    const groups: RosterGroup[] = React.useMemo(
        () => groupRoster(roster, {
            excludeUserIds: excludeKey ? excludeKey.split(",") : [],
            ungroupedLabel: copy.membersLabel,
            query,
        }).filter((g) => !role || g.name === role),
        [roster, excludeKey, copy.membersLabel, query, role],
    );

    const rosterHitCount = groups.reduce((n, g) => n + g.people.length, 0);
    const roles = React.useMemo(() => rosterRoles(roster), [roster]);

    /* Offered shortcuts, minus whoever is already staged — and deduped across
       rows, so somebody on two lists is one chip rather than two. */
    const shortcuts = React.useMemo(
        () => (suggestions ? visibleSuggestions(suggestions, picked) : []),
        [suggestions, picked],
    );

    /*
     * Search reaches PAST the roster, and only when the roster has nothing to
     * show for the query. Someone who is not a member yet is exactly who an
     * invitation is for, and on a listing no community owns there is no roster
     * at all.
     */
    React.useEffect(() => {
        if (!open || step !== 'people') return;
        const q = query.trim();
        if (q.length < minQueryLength(communityTag) || rosterHitCount > 0) {
            setFound([]);
            return;
        }
        let cancelled = false;
        setSearching(true);
        const timer = setTimeout(async () => {
            const people = await searchPeople({
                apiBaseUrl, communityTag, query: q,
                excludeUserIds: excludeKey ? excludeKey.split(",") : [],
                currentUserId, headers: authHeaders(),
            });
            if (cancelled) return;
            setFound(people);
            setSearching(false);
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, step, query, communityTag, excludeKey, currentUserId, apiBaseUrl, rosterHitCount]);

    const stage = React.useCallback((incoming: Recipient[]) => {
        setPicked((prev) => (multiple ? addRecipients(prev, incoming) : incoming.slice(0, 1)));
    }, [multiple]);

    function toggle(person: PersonSearchResult) {
        const key = recipientKey(fromPerson(person));
        setPicked((prev) => {
            if (prev.some((r) => recipientKey(r) === key)) {
                return prev.filter((r) => recipientKey(r) !== key);
            }
            return multiple ? [...prev, fromPerson(person)] : [fromPerson(person)];
        });
    }

    function drop(key: string) {
        setPicked((prev) => prev.filter((r) => recipientKey(r) !== key));
        if (editing === key) setEditing(null);
    }

    function setNote(key: string, note: string) {
        setPicked((prev) => prev.map((r) => (
            recipientKey(r) === key ? { ...r, note: note.trim() || undefined } : r
        )));
        setEditing(null);
    }

    const isPicked = (id: string) => picked.some((r) => r.id === id);

    /*
     * The typed address. Offered whenever it looks like one and is not already
     * staged, even when the roster has hits — a full address that happens to
     * substring-match a member is still a thing you may mean to send to.
     */
    const typed = query.trim();
    const offerTyped = Boolean(
        emails && looksLikeEmail(typed)
        && !picked.some((r) => recipientKey(r) === recipientKey({ email: typed })),
    );

    async function importCsv(file: File) {
        if (!emails) return;
        try {
            const text = await file.text();

            /*
             * With tiers in play, an import is PLANNED, not performed.
             *
             * Every row consumes a seat, so committing first and reporting
             * afterwards leaves the host reconciling two lists: who got in,
             * who did not, and how much room is left. The plan shows the whole
             * outcome — which tiers would fill, which rows name a tier that
             * does not exist — and they decide once.
             */
            if (tierStep) {
                const rows = parseCsvRecipientRows(text);
                if (rows.length === 0) { setNotice(emails.importedNothing); return; }
                setPlan(planImport(rows, tierStep.tiers, defaultTierId));
                setNotice(null);
                return;
            }

            const addresses = parseCsvEmails(text);
            stage(addresses.map((email) => ({ email })));
            setNotice(addresses.length > 0 ? emails.imported(addresses.length) : emails.importedNothing);
        } catch {
            setNotice(emails.importFailed);
        }
    }

    /** Commit the plan: stage only the rows that can actually be added. */
    function commitPlan() {
        if (!plan) return;
        stage(recipientsFromPlan(plan));
        setPlan(null);
    }

    async function confirm() {
        if (picked.length === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            /*
             * The chosen tier is stamped ONCE, here — never as people are
             * picked. Doing it per pick would overwrite a tier that arrived
             * with an imported row the moment the host changed the default.
             */
            const finalRecipients = tierStep ? applyDefaultTier(picked, defaultTierId) : picked;
            await onConfirm(finalRecipients, message.trim() || null);
            onAdded?.(finalRecipients);
            onClose();
        } catch (e: any) {
            setError(e?.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    }

    const showSearchResults = rosterHitCount === 0 && found.length > 0;
    const nothingToShow = !rosterLoading && !searching && rosterHitCount === 0
        && found.length === 0 && !offerTyped;
    const motion = entered
        ? "opacity-100 translate-x-0"
        : `opacity-0 ${stepIdx > 0 ? "translate-x-3" : "-translate-x-3"}`;

    return (
        <ActionModalShell
            isOpen={open}
            onClose={onClose}
            title={copy.title}
            subtitle={
                step === 'people' ? copy.searchSubtitle
                    : step === 'tier' ? (tierStep?.copy.subtitle ?? copy.pickedSubtitle)
                        : copy.pickedSubtitle
            }
            unsavedCount={picked.length > 0 ? picked.length : 0}
            unsavedMessage={copy.discardConfirm ? () => copy.discardConfirm! : undefined}
            footer={
                <div className="flex items-center gap-3">
                    {step === 'people' && multiple && picked.length > 0 && (
                        <span className="text-[12px] text-zinc-500 tabular-nums">
                            {copy.selectedLabel(picked.length)}
                        </span>
                    )}
                    <span className="flex-1" />
                    {step === 'people' ? (
                        <>
                            {/* Muted plate, never a transparent ghost — same
                                treatment as the shell's circular dismiss. */}
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 text-[13px] rounded-lg cursor-pointer bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                onClick={() => goTo(1)}
                                disabled={picked.length === 0}
                                className="px-5 py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {nextLabel}
                            </button>
                        </>
                    ) : step === 'tier' ? (
                        <button
                            onClick={() => goTo(stepIdx + 1)}
                            /* No tier chosen means nobody has a seat to take.
                               The summary above already says what is wrong. */
                            disabled={!defaultTierId && picked.some((r) => !r.tierId)}
                            className="px-5 py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {copy.stepTwo}
                        </button>
                    ) : (
                        /* No Back button: the breadcrumb above owns that, the
                           way it does on the detail pages. */
                        <button
                            onClick={confirm}
                            disabled={submitting}
                            className="px-5 py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {submitting ? copy.confirming : copy.confirm}
                        </button>
                    )}
                </div>
            }
        >
            {stepIdx > 0 && (
                <div className="flex items-center gap-2 px-5 sm:px-6 py-2.5 border-b border-zinc-100">
                    <button
                        onClick={() => goTo(stepIdx - 1)}
                        aria-label={copy.back}
                        className="h-[26px] w-[26px] rounded-full grid place-items-center cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shrink-0"
                    >
                        {CHEVRON}
                    </button>
                    <button
                        onClick={() => goTo(stepIdx - 1)}
                        className="text-[13px] text-zinc-900 opacity-50 hover:opacity-80 cursor-pointer shrink-0 bg-transparent border-0 p-0"
                    >
                        {stepLabels[stepIdx - 1]}
                    </button>
                    <span className="text-[13px] text-zinc-900 opacity-20 shrink-0">/</span>
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{stepLabels[stepIdx]}</span>
                </div>
            )}

            <div className={`transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${motion}`}>
                {step === 'people' ? (
                    <div>
                        <div className="flex items-center gap-2.5 px-5 sm:px-6 py-2.5 border-b border-zinc-100">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 shrink-0" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={copy.searchPlaceholder}
                                autoFocus
                                /* 16px so iOS Safari does not zoom the sheet on focus. */
                                className="flex-1 min-w-0 text-[16px] sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
                            />
                        </div>

                        {/* Shortcuts. Only while nothing is typed: once you are
                            searching, a row of unrelated names is in the way. */}
                        {shortcuts.length > 0 && !typed && (
                            <div className="px-5 sm:px-6 py-3 border-b border-zinc-100 space-y-2.5">
                                {shortcuts.map((row) => (
                                    <div key={row.label}>
                                        <p className="m-0 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                                            {row.label}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {row.people.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => stage([fromPerson(p)])}
                                                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 cursor-pointer transition-colors"
                                                >
                                                    <UserAvatar user={p} className="w-5 h-5 shrink-0" />
                                                    <span className="text-[12px] text-zinc-700 max-w-[140px] truncate">
                                                        {p.name || copy.unknown}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(roles.length > 0 || emails) && (
                            <div className="flex items-center gap-2 px-5 sm:px-6 py-2 border-b border-zinc-100 text-[12px] text-zinc-500">
                                {roles.length > 0 && (
                                    <>
                                        <span className="hidden sm:inline">{copy.showingLabel}</span>
                                        <select
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            className="border border-zinc-200 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-900 bg-white cursor-pointer"
                                        >
                                            <option value="">{copy.allMembersLabel}</option>
                                            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <span className="tabular-nums">{rosterHitCount || found.length}</span>
                                    </>
                                )}
                                {emails && (
                                    <button
                                        type="button"
                                        onClick={() => csvInput.current?.click()}
                                        className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-colors"
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        {emails.importCsv}
                                    </button>
                                )}
                            </div>
                        )}

                        {emails && (
                            <input
                                ref={csvInput}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) importCsv(f);
                                    /* Cleared so re-picking the same file fires
                                       change again. */
                                    e.currentTarget.value = "";
                                }}
                            />
                        )}

                        {notice && (
                            <p className="px-5 sm:px-6 py-2 m-0 text-[12px] text-zinc-500 border-b border-zinc-100">
                                {notice}
                            </p>
                        )}

                        {/*
                          * The import, before it happens.
                          *
                          * Replaces the list rather than sitting under it: the
                          * host has one decision to make here, and leaving the
                          * roster interactive behind a pending import invites
                          * them to do something else and forget this.
                          */}
                        {plan && tierStep && (
                            <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 space-y-3">
                                <p className="m-0 text-[13px] font-medium text-zinc-900">
                                    {tierStep.copy.importPreviewTitle}
                                </p>

                                <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 space-y-1">
                                    <p className="m-0 text-[12px] text-zinc-700">
                                        {tierStep.copy.importReady(plan.ok.length)}
                                    </p>
                                    {plan.problems.length > 0 && (
                                        <p className="m-0 text-[12px] text-red-600">
                                            {tierStep.copy.importProblems(plan.problems.length)}
                                        </p>
                                    )}
                                    {plan.perTier.map((t) => (
                                        <p key={t.tierId} className="m-0 text-[12px] text-zinc-600">
                                            {tierStep.copy.summary(t.adding, t.name)}
                                            {t.overBy > 0 && (
                                                <span className="text-red-600">
                                                    {" "}{tierStep.copy.overBy(t.overBy, t.name)}
                                                </span>
                                            )}
                                        </p>
                                    ))}
                                </div>

                                {/* Named, with the reason. A count alone does not
                                    tell anybody which line to go and fix. */}
                                {plan.problems.length > 0 && (
                                    <div className="max-h-[160px] overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                                        {plan.problems.map((r) => (
                                            <div key={r.email} className="flex items-center gap-3 px-3 py-2">
                                                <span className="text-[12px] text-zinc-700 min-w-0 flex-1 truncate">
                                                    {r.email}
                                                </span>
                                                <span className="text-[11.5px] text-red-600 shrink-0">
                                                    {r.problem === 'unknown-tier'
                                                        ? tierStep.copy.problemUnknownTier(r.tierName ?? '')
                                                        : r.problem === 'no-tier'
                                                            ? tierStep.copy.problemNoTier
                                                            : tierStep.copy.problemTierFull}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={() => setPlan(null)}
                                        className="px-3 py-1.5 text-[12px] rounded-lg cursor-pointer bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors"
                                    >
                                        {tierStep.copy.importCancel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={commitPlan}
                                        disabled={plan.ok.length === 0}
                                        className="px-3 py-1.5 text-[12px] font-medium rounded-lg cursor-pointer bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {tierStep.copy.importConfirm}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`max-h-[340px] overflow-y-auto ${plan ? "hidden" : ""}`}>
                            {offerTyped && emails && (
                                <button
                                    type="button"
                                    onClick={() => { stage([{ email: typed }]); setQuery(""); }}
                                    className="w-full flex items-center gap-3 px-5 sm:px-6 py-2.5 min-h-[44px] text-left cursor-pointer transition-colors hover:bg-zinc-50 border-b border-zinc-100"
                                >
                                    <span className="w-[17px] h-[17px] rounded-[5px] shrink-0 grid place-items-center border-[1.5px] border-zinc-200 text-zinc-400">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    </span>
                                    <span className="text-[13px] text-zinc-900 truncate">{emails.addRow(typed)}</span>
                                </button>
                            )}

                            {rosterLoading || searching ? (
                                <p className="px-5 py-8 text-center text-[12px] text-zinc-400">{copy.searching}</p>
                            ) : nothingToShow ? (
                                <p className="px-5 py-8 text-center text-[12px] text-zinc-400">
                                    {typed ? copy.noMatches : copy.emptyHint}
                                </p>
                            ) : showSearchResults ? (
                                found.map((p) => (
                                    <Row key={p.id} person={p} picked={isPicked(p.id)} onToggle={toggle} UserAvatar={UserAvatar} unknown={copy.unknown} />
                                ))
                            ) : (
                                groups.map((g) => (
                                    <div key={g.name}>
                                        <p className="px-5 sm:px-6 pt-3 pb-1 m-0 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                                            {g.name}
                                        </p>
                                        {g.people.map((p) => (
                                            <Row key={p.id} person={p} picked={isPicked(p.id)} onToggle={toggle} UserAvatar={UserAvatar} unknown={copy.unknown} />
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>

                        {/*
                          * What is staged, where you can see and undo it.
                          *
                          * Load-bearing rather than decorative: a pick can come
                          * from a shortcut chip, a typed address or a CSV of two
                          * hundred rows, and none of those leave a ticked row on
                          * screen to untick. Without this, removing one of them
                          * is impossible.
                          */}
                        {multiple && picked.length > 0 && (
                            <div className="px-5 sm:px-6 py-3 border-t border-zinc-100 bg-zinc-50/60">
                                <div className="flex items-baseline justify-between mb-2">
                                    <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                                        {copy.selectedTitle}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setPicked([])}
                                        className="text-[11.5px] text-zinc-500 hover:text-zinc-900 cursor-pointer bg-transparent border-0 p-0 transition-colors"
                                    >
                                        {copy.clearAll}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-[92px] overflow-y-auto">
                                    {picked.map((r) => (
                                        <Chip
                                            key={recipientKey(r)}
                                            recipient={r}
                                            UserAvatar={UserAvatar}
                                            unknown={copy.unknown}
                                            removeLabel={copy.remove}
                                            onRemove={() => drop(recipientKey(r))}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && <p className="px-5 sm:px-6 py-3 text-[12px] text-red-600">{error}</p>}
                    </div>
                ) : step === 'tier' && tierStep ? (
                    <div className="px-5 sm:px-6 py-5 space-y-4">
                        {!anyTierOpen && (
                            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-[13px] text-amber-800">
                                {tierStep.copy.allFull}
                            </div>
                        )}

                        <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                            {tierStep.tiers.map((t) => {
                                const chosen = defaultTierId === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        /* Shown but not choosable. Hiding a full tier leaves a
                                           host wondering where it went; showing it full is what
                                           tells them to go raise the cap. */
                                        disabled={t.soldOut}
                                        aria-pressed={chosen}
                                        onClick={() => setDefaultTierId(t.id)}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3 text-left min-h-[52px] transition-colors ${t.soldOut
                                            ? "bg-zinc-50 cursor-not-allowed"
                                            : chosen ? "bg-zinc-50 cursor-pointer" : "bg-white hover:bg-zinc-50 cursor-pointer"}`}
                                    >
                                        <span className={`w-[17px] h-[17px] rounded-full shrink-0 grid place-items-center border-[1.5px] ${chosen ? "bg-zinc-900 border-zinc-900" : "border-zinc-200"}`}>
                                            {chosen && <span className="w-[6px] h-[6px] rounded-full bg-white" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-[13px] truncate ${t.soldOut ? "text-zinc-400" : "text-zinc-900"}`}>
                                                {t.name}
                                            </span>
                                        </span>
                                        <span className="text-[11.5px] text-zinc-400 shrink-0 tabular-nums">
                                            {t.soldOut ? tierStep.copy.soldOut
                                                : t.remaining === null ? tierStep.copy.unlimited
                                                    : tierStep.copy.remaining(t.remaining)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/*
                          * What this actually does, per tier, before it does it.
                          *
                          * Somebody imported with their own tier keeps it, so this is
                          * not simply "everyone into the chosen one" — and a tier that
                          * would overflow says so here rather than failing halfway
                          * through the write.
                          */}
                        {tierSummary.length > 0 && (
                            <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 space-y-1">
                                {tierSummary.map((t) => (
                                    <p key={t.tierId} className="m-0 text-[12px] text-zinc-600">
                                        {tierStep.copy.summary(t.adding, t.name)}
                                        {t.overBy > 0 && (
                                            <span className="text-red-600">
                                                {" "}{tierStep.copy.overBy(t.overBy, t.name)}
                                            </span>
                                        )}
                                    </p>
                                ))}
                            </div>
                        )}

                        {error && <p className="text-[12px] text-red-600">{error}</p>}
                    </div>
                ) : (
                    <div className="px-5 sm:px-6 py-5 space-y-4">
                        {perRecipient ? (
                            /* One row each, because each can be given its own
                               note. The compact avatar stack cannot carry a
                               control per person. */
                            <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                                {picked.map((r) => {
                                    const key = recipientKey(r);
                                    const name = r.name || r.email || copy.unknown;
                                    return (
                                        <div key={key} className="bg-white">
                                            <div className="flex items-center gap-3 px-3.5 py-2.5">
                                                <UserAvatar user={r} className="w-7 h-7 shrink-0" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] text-zinc-900 truncate">{name}</span>
                                                    {r.note && (
                                                        <span className="block text-[11.5px] text-zinc-400 truncate">
                                                            {perRecipient.personalized}
                                                        </span>
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(editing === key ? null : key)}
                                                    className="shrink-0 px-2.5 py-1 rounded-md text-[12px] text-zinc-600 bg-zinc-100 hover:bg-zinc-200 cursor-pointer transition-colors"
                                                >
                                                    {perRecipient.personalize}
                                                </button>
                                            </div>
                                            {editing === key && (
                                                <NoteEditor
                                                    initial={r.note ?? ""}
                                                    maxLength={maxLength}
                                                    placeholder={perRecipient.placeholder(name)}
                                                    save={perRecipient.save}
                                                    cancel={perRecipient.cancel}
                                                    onSave={(note) => setNote(key, note)}
                                                    onCancel={() => setEditing(null)}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                                <div className="flex items-center">
                                    {picked.slice(0, 3).map((r, i) => (
                                        <span key={recipientKey(r)} style={{ marginLeft: i === 0 ? 0 : -9 }}>
                                            <UserAvatar user={r} className="w-9 h-9 ring-2 ring-white rounded-full" />
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[13.5px] text-zinc-700 min-w-0 truncate">
                                    {picked.map((r) => r.name || r.email || copy.unknown).join(", ")}
                                </p>
                            </div>
                        )}

                        {stepTwo.kind === "consequences" ? (
                            <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 text-[12px] text-zinc-600 leading-relaxed">
                                <p className="font-medium text-zinc-800 mb-1">{copy.consequencesTitle}</p>
                                <ul className="space-y-1 list-disc list-inside [&>li]:pl-0">
                                    {stepTwo.items.map((item, i) => <li key={i}>{item}</li>)}
                                </ul>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-[12px] font-medium text-zinc-900 mb-1.5">
                                        {copy.messageLabel}
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
                                        placeholder={copy.messagePlaceholder}
                                        rows={3}
                                        className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-[16px] sm:text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
                                    />
                                    <p className="text-right text-[11px] text-zinc-400 mt-1 tabular-nums">
                                        {message.length} / {maxLength}
                                    </p>
                                </div>
                                {/* The preview re-renders as they type, so the note
                                    is seen in place rather than imagined. */}
                                {stepTwo.preview(message)}
                            </>
                        )}

                        {error && <p className="text-[12px] text-red-600">{error}</p>}
                    </div>
                )}
            </div>
        </ActionModalShell>
    );
}

function Row({
    person, picked, onToggle, UserAvatar, unknown,
}: {
    person: PersonSearchResult;
    picked: boolean;
    onToggle: (p: PersonSearchResult) => void;
    UserAvatar: React.ComponentType<{ user: any; className?: string }>;
    unknown: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={picked}
            onClick={() => onToggle(person)}
            /* 44px minimum so a thumb can hit it; the tick stays on the left
               where a thumb actually reaches. */
            className={`w-full flex items-center gap-3 px-5 sm:px-6 py-2 min-h-[44px] text-left cursor-pointer transition-colors ${picked ? "bg-zinc-50" : "hover:bg-zinc-50"}`}
        >
            <span
                className={`w-[17px] h-[17px] rounded-[5px] shrink-0 grid place-items-center border-[1.5px] ${picked ? "bg-zinc-900 border-zinc-900" : "border-zinc-200"}`}
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
                    className={picked ? "text-white" : "text-transparent"} aria-hidden="true">
                    <path d="m4 12 6 6L20 6" />
                </svg>
            </span>
            <UserAvatar user={person} className="w-7 h-7 shrink-0" />
            <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-zinc-900 truncate">{person.name || unknown}</span>
                {person.usertag && (
                    <span className="block text-[11.5px] text-zinc-400 truncate">@{person.usertag}</span>
                )}
            </span>
        </button>
    );
}

function Chip({
    recipient, UserAvatar, unknown, removeLabel, onRemove,
}: {
    recipient: Recipient;
    UserAvatar: React.ComponentType<{ user: any; className?: string }>;
    unknown: string;
    removeLabel: (name: string) => string;
    onRemove: () => void;
}) {
    const name = recipient.name || recipient.email || unknown;
    return (
        <span className="inline-flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-full border border-zinc-200 bg-white">
            {/* An address with no account has no avatar to show, and a blank
                circle beside a name reads as a failed image. */}
            {recipient.id && <UserAvatar user={recipient} className="w-5 h-5 shrink-0" />}
            <span className={`text-[12px] text-zinc-700 max-w-[160px] truncate ${recipient.id ? "" : "pl-1.5"}`}>
                {name}
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={removeLabel(name)}
                className="h-[18px] w-[18px] rounded-full grid place-items-center shrink-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer transition-colors"
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </span>
    );
}

/**
 * One person's own note.
 *
 * Held locally and committed on save, so a half-typed note does not rewrite the
 * staged list on every keystroke — and Cancel genuinely discards rather than
 * leaving whatever had been typed so far.
 */
function NoteEditor({
    initial, maxLength, placeholder, save, cancel, onSave, onCancel,
}: {
    initial: string;
    maxLength: number;
    placeholder: string;
    save: string;
    cancel: string;
    onSave: (note: string) => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = React.useState(initial);
    return (
        <div className="px-3.5 pb-3 pt-0.5 bg-zinc-50/60">
            <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                placeholder={placeholder}
                rows={2}
                autoFocus
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-[16px] sm:text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 resize-none bg-white"
            />
            <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] text-zinc-400 tabular-nums">{draft.length} / {maxLength}</span>
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 text-[12px] rounded-lg cursor-pointer bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors"
                >
                    {cancel}
                </button>
                <button
                    type="button"
                    onClick={() => onSave(draft)}
                    className="px-3 py-1.5 text-[12px] font-medium rounded-lg cursor-pointer bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                    {save}
                </button>
            </div>
        </div>
    );
}
