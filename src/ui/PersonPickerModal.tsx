"use client";

import * as React from "react";
import { ActionModalShell } from "./ActionModalShell";
import { searchPeople, minQueryLength, type PersonSearchResult } from "../lib/searchPeople";
import { fetchCommunityRoster, groupRoster, rosterRoles, type RosterPerson, type RosterGroup } from "../lib/communityRoster";

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
    /** Label above the message box, compose mode only. */
    messageLabel?: string;
    messagePlaceholder?: string;
    /** Shown while dismissing with a pick staged. Omit for the shell default. */
    discardConfirm?: string;
}

export type PersonPickerStepTwo =
    /** Says what the action will do. Used by add-directly, host, co-seller. */
    | { kind: "consequences"; items: React.ReactNode[] }
    /** Write a note and see the email. Used by invitations. */
    | { kind: "compose"; preview: (message: string) => React.ReactNode; maxLength?: number };

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
    /** Performs the write. Throw an Error to surface its message. */
    onConfirm: (people: PersonSearchResult[], message: string | null) => Promise<void>;
    onAdded?: (people: PersonSearchResult[]) => void;
}

const CHEVRON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

export function PersonPickerModal({
    open, onClose, apiBaseUrl, authHeaders, communityTag, excludeUserIds,
    currentUserId, UserAvatar, multiple = false, copy, stepTwo, onConfirm, onAdded,
}: PersonPickerModalProps) {
    const [step, setStep] = React.useState<1 | 2>(1);
    const [query, setQuery] = React.useState("");
    const [roster, setRoster] = React.useState<RosterPerson[]>([]);
    const [rosterLoading, setRosterLoading] = React.useState(false);
    const [role, setRole] = React.useState<string>("");
    const [found, setFound] = React.useState<PersonSearchResult[]>([]);
    const [searching, setSearching] = React.useState(false);
    const [picked, setPicked] = React.useState<PersonSearchResult[]>([]);
    const [message, setMessage] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const excludeKey = excludeUserIds.join(",");
    const maxLength = stepTwo.kind === "compose" ? (stepTwo.maxLength ?? 500) : 0;

    React.useEffect(() => {
        if (!open) return;
        setStep(1); setQuery(""); setRole(""); setPicked([]);
        setMessage(""); setError(null); setFound([]);
    }, [open]);

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

    /*
     * Search reaches PAST the roster, and only when the roster has nothing to
     * show for the query. Someone who is not a member yet is exactly who an
     * invitation is for, and on a listing no community owns there is no roster
     * at all.
     */
    React.useEffect(() => {
        if (!open || step === 2) return;
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

    function toggle(person: PersonSearchResult) {
        setPicked((prev) => {
            if (!multiple) return prev[0]?.id === person.id ? [] : [person];
            return prev.some((p) => p.id === person.id)
                ? prev.filter((p) => p.id !== person.id)
                : [...prev, person];
        });
    }

    const isPicked = (id: string) => picked.some((p) => p.id === id);

    async function confirm() {
        if (picked.length === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onConfirm(picked, message.trim() || null);
            onAdded?.(picked);
            onClose();
        } catch (e: any) {
            setError(e?.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    }

    const showSearchResults = rosterHitCount === 0 && found.length > 0;
    const nothingToShow = !rosterLoading && !searching && rosterHitCount === 0 && found.length === 0;

    return (
        <ActionModalShell
            isOpen={open}
            onClose={onClose}
            title={copy.title}
            subtitle={step === 2 ? copy.pickedSubtitle : copy.searchSubtitle}
            unsavedCount={picked.length > 0 ? picked.length : 0}
            unsavedMessage={copy.discardConfirm ? () => copy.discardConfirm! : undefined}
            footer={
                <div className="flex items-center gap-3">
                    {step === 1 && multiple && picked.length > 0 && (
                        <span className="text-[12px] text-zinc-500 tabular-nums">
                            {copy.selectedLabel(picked.length)}
                        </span>
                    )}
                    <span className="flex-1" />
                    {step === 1 ? (
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
                                onClick={() => setStep(2)}
                                disabled={picked.length === 0}
                                className="px-5 py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {copy.stepTwo}
                            </button>
                        </>
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
            {step === 2 && (
                <div className="flex items-center gap-2 px-5 sm:px-6 py-2.5 border-b border-zinc-100">
                    <button
                        onClick={() => setStep(1)}
                        aria-label={copy.back}
                        className="h-[26px] w-[26px] rounded-full grid place-items-center cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shrink-0"
                    >
                        {CHEVRON}
                    </button>
                    <button
                        onClick={() => setStep(1)}
                        className="text-[13px] text-zinc-900 opacity-50 hover:opacity-80 cursor-pointer shrink-0 bg-transparent border-0 p-0"
                    >
                        {copy.stepOne}
                    </button>
                    <span className="text-[13px] text-zinc-900 opacity-20 shrink-0">/</span>
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{copy.stepTwo}</span>
                </div>
            )}

            {step === 1 ? (
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

                    {roles.length > 0 && (
                        <div className="flex items-center gap-2 px-5 sm:px-6 py-2 border-b border-zinc-100 text-[12px] text-zinc-500">
                            <span className="hidden sm:inline">{copy.showingLabel}</span>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="border border-zinc-200 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-900 bg-white cursor-pointer"
                            >
                                <option value="">{copy.allMembersLabel}</option>
                                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <span className="ml-auto tabular-nums">{rosterHitCount || found.length}</span>
                        </div>
                    )}

                    <div className="max-h-[340px] overflow-y-auto">
                        {rosterLoading || searching ? (
                            <p className="px-5 py-8 text-center text-[12px] text-zinc-400">{copy.searching}</p>
                        ) : nothingToShow ? (
                            <p className="px-5 py-8 text-center text-[12px] text-zinc-400">
                                {query.trim() ? copy.noMatches : copy.emptyHint}
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

                    {error && <p className="px-5 sm:px-6 py-3 text-[12px] text-red-600">{error}</p>}
                </div>
            ) : (
                <div className="px-5 sm:px-6 py-5 space-y-4">
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                        <div className="flex items-center">
                            {picked.slice(0, 3).map((p, i) => (
                                <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -9 }}>
                                    <UserAvatar user={p} className="w-9 h-9 ring-2 ring-white rounded-full" />
                                </span>
                            ))}
                        </div>
                        <p className="text-[13.5px] text-zinc-700 min-w-0 truncate">
                            {picked.map((p) => p.name || copy.unknown).join(", ")}
                        </p>
                    </div>

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
