"use client";

import * as React from "react";
import { ActionModalShell } from "./ActionModalShell";
import { searchPeople, minQueryLength, type PersonSearchResult } from "../lib/searchPeople";

/**
 * Search for a person, pick them, see what it will do, confirm.
 *
 * ── Why this is shared ──────────────────────────────────────────────
 *
 * Adding a host to an event and adding a co-seller to a product are the same
 * act: grant this person management access to this thing. They had three
 * implementations. The events one (shared package, both apps) searched with a
 * debounced type-ahead. The community app's product one was a faithful port of
 * it. The product PACKAGE's one — the one admin renders — was a bare
 * "@usertag" text box that posted `{ usertag }` to an endpoint that only ever
 * read `userId`, so it answered "userId is required" and had never once
 * worked.
 *
 * Three copies is how that survives: the two that worked were not the one that
 * was broken, and nobody compares three files. There is one now.
 *
 * ── What the caller still owns ──────────────────────────────────────
 *
 * The WRITE. `onConfirm` receives the picked person and does its own POST, so
 * the endpoint, its body and its error vocabulary stay with the feature that
 * owns them. Throw from it to show a message; the modal stays open on the
 * confirm step so the operator can retry without losing their pick.
 *
 * Every string is a prop. The community app translates with next-intl and the
 * packages ship English, and baking copy in here would have forced one of them
 * to be wrong.
 *
 * The avatar is a prop too — each app has its own image pipeline (signed URLs,
 * fallbacks, initials) and this component has no business knowing about it.
 */

export interface PersonPickerCopy {
    title: string;
    /** Subtitle while searching. */
    searchSubtitle: string;
    /** Subtitle once someone is picked. */
    pickedSubtitle: string;
    searchPlaceholder: string;
    /** Shown before the query is long enough to search. */
    emptyHint: string;
    searching: string;
    noMatches: string;
    /** Name shown when the person has none. */
    unknown: string;
    /** Heading above the consequence bullets. */
    consequencesTitle: string;
    back: string;
    cancel: string;
    confirm: string;
    confirming: string;
    /**
     * Shown when dismissing with someone picked but not yet confirmed. Omit to
     * take the shell's English default — which is what the events package
     * does, so its modal keeps the exact wording it has today. The community
     * app passes a translated string.
     */
    discardConfirm?: string;
}

export interface PersonPickerModalProps {
    open: boolean;
    onClose: () => void;
    apiBaseUrl: string;
    authHeaders: () => Record<string, string>;
    /** Truthy → community member search. Null → global user search. */
    communityTag: string | null;
    /** Already on the list, excluded from results. */
    excludeUserIds: string[];
    /** The signed-in user, excluded from global-search results. */
    currentUserId?: string | null;
    /** Each app's own avatar component. */
    UserAvatar: React.ComponentType<{ user: any; className?: string }>;
    copy: PersonPickerCopy;
    /** What granting this access actually does, in plain sentences. */
    consequences: React.ReactNode[];
    /** Performs the write. Throw an Error to surface its message. */
    onConfirm: (person: PersonSearchResult) => Promise<void>;
    /** Called after a successful confirm, before the modal closes. */
    onAdded?: (person: PersonSearchResult) => void;
}

export function PersonPickerModal({
    open,
    onClose,
    apiBaseUrl,
    authHeaders,
    communityTag,
    excludeUserIds,
    currentUserId,
    UserAvatar,
    copy,
    consequences,
    onConfirm,
    onAdded,
}: PersonPickerModalProps) {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<PersonSearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [picked, setPicked] = React.useState<PersonSearchResult | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const minLen = minQueryLength(communityTag);

    React.useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setPicked(null);
            setError(null);
        }
    }, [open]);

    /*
     * Debounced server-side search. 250ms is the events number, kept because
     * it is what the surface people already like feels like.
     *
     * `excludeUserIds` is joined rather than passed by reference: a caller that
     * builds the array inline gives a new identity on every render, which would
     * restart the debounce forever and never fire.
     */
    const excludeKey = excludeUserIds.join(",");
    React.useEffect(() => {
        if (!open || picked) return;
        const q = query.trim();
        if (q.length < minLen) {
            setResults([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            const found = await searchPeople({
                apiBaseUrl,
                communityTag,
                query: q,
                excludeUserIds: excludeKey ? excludeKey.split(",") : [],
                currentUserId,
                headers: authHeaders(),
            });
            if (cancelled) return;
            setResults(found);
            setLoading(false);
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, query, communityTag, excludeKey, currentUserId, picked, minLen, apiBaseUrl]);

    async function confirm() {
        if (!picked || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onConfirm(picked);
            onAdded?.(picked);
            onClose();
        } catch (e: any) {
            setError(e?.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <ActionModalShell
            isOpen={open}
            onClose={onClose}
            title={copy.title}
            subtitle={picked ? copy.pickedSubtitle : copy.searchSubtitle}
            /*
             * A picked-but-unconfirmed person counts as unsaved, so dismissing
             * asks first — the same guard the attendee modals use for staged
             * recipients.
             */
            unsavedCount={picked ? 1 : 0}
            unsavedMessage={copy.discardConfirm ? () => copy.discardConfirm! : undefined}
            footer={
                <div className="flex items-center justify-between gap-3">
                    {picked ? (
                        <>
                            <button
                                onClick={() => setPicked(null)}
                                disabled={submitting}
                                className="hidden sm:inline-flex px-4 py-2.5 text-[13px] text-zinc-600 rounded-lg hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                            >
                                {copy.back}
                            </button>
                            <button
                                onClick={confirm}
                                disabled={submitting}
                                className="flex-1 sm:flex-none px-5 py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {submitting ? copy.confirming : copy.confirm}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-[13px] text-zinc-600 rounded-lg hover:bg-zinc-100 cursor-pointer ml-auto"
                        >
                            {copy.cancel}
                        </button>
                    )}
                </div>
            }
        >
            <div className="px-5 sm:px-6 py-5">
                {picked ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
                            <UserAvatar user={picked} className="w-12 h-12" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-zinc-900 truncate">
                                    {picked.name || copy.unknown}
                                </p>
                                {picked.usertag && (
                                    <p className="text-[12px] text-zinc-500 truncate">@{picked.usertag}</p>
                                )}
                            </div>
                        </div>
                        <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 text-[12px] text-zinc-600 leading-relaxed">
                            <p className="font-medium text-zinc-800 mb-1">{copy.consequencesTitle}</p>
                            <ul className="space-y-1 list-disc list-inside [&>li]:pl-0">
                                {consequences.map((c, i) => (
                                    <li key={i}>{c}</li>
                                ))}
                            </ul>
                        </div>
                        {error && <p className="text-[12px] text-red-600">{error}</p>}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 shrink-0">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={copy.searchPlaceholder}
                                autoFocus
                                className="flex-1 min-w-0 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
                            />
                        </div>

                        <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-100 max-h-[380px] overflow-y-auto">
                            {loading ? (
                                <p className="px-4 py-8 text-center text-[12px] text-zinc-400">{copy.searching}</p>
                            ) : query.trim().length < minLen ? (
                                <p className="px-4 py-8 text-center text-[12px] text-zinc-400">{copy.emptyHint}</p>
                            ) : results.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[12px] text-zinc-400">{copy.noMatches}</p>
                            ) : (
                                results.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setPicked(m)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 text-left cursor-pointer"
                                    >
                                        <UserAvatar user={m} className="w-8 h-8 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-medium text-zinc-900 truncate">
                                                {m.name || copy.unknown}
                                            </p>
                                            {m.usertag && (
                                                <p className="text-[11px] text-zinc-400 truncate">@{m.usertag}</p>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {error && <p className="text-[12px] text-red-600">{error}</p>}
                    </div>
                )}
            </div>
        </ActionModalShell>
    );
}
