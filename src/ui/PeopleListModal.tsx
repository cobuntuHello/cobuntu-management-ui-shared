"use client";

import { useEffect, useState } from "react";

/**
 * PeopleListModal — one list of people, one design, both apps.
 *
 * Ported from the community app's PeopleModal so the admin's "friends" list is
 * not a lookalike that drifts. Presentational ONLY: it takes the people it
 * shows and every string it prints. The community app fetches over its own
 * apiClient and the admin already has `friends[]` in the member payload, so
 * putting the fetching in here would have dragged one app's data layer into
 * the other's.
 *
 * SHAPE, which is the part worth preserving:
 *   mobile   full-screen panel sliding in from the right edge
 *   desktop  centred 400px card, fixed height, fading in
 * Only the list scrolls; header and search stay put. That is what makes it
 * usable with 400 friends on a phone.
 *
 * The memberships tab the original carried is deliberately not here. It was
 * commented out in the community app in July 2026 and the admin never wanted
 * it — a modal that lists people should list people.
 */

export interface PeopleListPerson {
    /** Stable key and, with `hrefFor`, the link target. */
    usertag: string;
    name: string;
    profileImage: string | null;
    /** Optional second line. Falls back to @usertag. */
    subtitle?: string | null;
}

export interface PeopleListModalCopy {
    /** Heading, e.g. "Friends". Rendered after the count. */
    title: string;
    close: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptySubtitle: string;
    noResultsTitle: string;
    /** Receives the query the reader typed. */
    noResultsSubtitle: (query: string) => string;
}

export interface PeopleListModalProps {
    people: PeopleListPerson[];
    /** Shown beside the title. Defaults to people.length — pass it when the
     *  true total differs from the page you loaded. */
    count?: number;
    copy: PeopleListModalCopy;
    onClose: () => void;
    /** Omit to render rows as plain, unclickable entries. */
    hrefFor?: (person: PeopleListPerson) => string;
    loading?: boolean;
}

const ROW_RADIUS = "var(--input-radius, 10px)";

function EmptyState({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
    return (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <svg
                width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ opacity: 0.25, margin: "0 auto 12px", display: "block" }}
                aria-hidden="true"
            >
                {icon}
            </svg>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>{title}</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.5, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
    );
}

function Avatar({ person }: { person: PeopleListPerson }) {
    if (person.profileImage) {
        return (
            <img
                src={person.profileImage}
                alt=""
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
        );
    }
    /*
     * Initials fallback. An avatar slot that renders nothing leaves a hole in
     * the row and reads as a broken image — the same gap this modal is being
     * shared to close on the admin side.
     */
    const initial = (person.name || person.usertag || "?").trim().charAt(0).toUpperCase();
    return (
        <div
            style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "rgba(128,128,128,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 600,
            }}
            aria-hidden="true"
        >
            {initial}
        </div>
    );
}

export function PeopleListModal({
    people, count, copy, onClose, hrefFor, loading = false,
}: PeopleListModalProps) {
    const [search, setSearch] = useState("");

    // Escape closes, and the page behind must not scroll while this is open.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", handler);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    /*
     * A usertag is stored WITHOUT its "@" and only displayed with one, so the
     * character a reader naturally types to search by tag matched nothing and
     * the list went empty. Stripping one leading "@" makes "@ana" and "ana"
     * the same query; an "@" further in is left alone, since that is someone
     * searching an email address.
     */
    const q = search.trim().replace(/^@/, "").toLowerCase();
    const filtered = q
        ? people.filter(p =>
            (p.name || "").toLowerCase().includes(q) || (p.usertag || "").toLowerCase().includes(q))
        : people;

    const total = count ?? people.length;

    return (
        <div
            className="fixed inset-0 z-[9999] flex bg-black/50 md:items-center md:justify-center md:p-4"
            style={{ animation: "plm-fadeIn 0.15s ease-out" }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
        >
            <style>{`
                @keyframes plm-fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes plm-slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes plm-fadeScale { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                .plm-panel { position: fixed; inset: 0; animation: plm-slideRight 0.24s ease-out; }
                @media (min-width: 768px) {
                    .plm-panel { position: relative; inset: auto; height: min(580px, 85vh); animation: plm-fadeScale 0.18s ease-out; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .plm-panel { animation: none; }
                }
            `}</style>

            <div
                className="plm-panel flex flex-col overflow-hidden md:w-full md:max-w-[400px] md:rounded-2xl md:border"
                style={{
                    background: "var(--bg-color, #fff)",
                    color: "var(--text-color, #1a1a1a)",
                    borderColor: "rgba(128,128,128,0.15)",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.1)",
                    fontFamily: "var(--body-font, system-ui)",
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header. A title with its count, and a muted round close —
                    never a bare glyph, which disappears on a dark theme. */}
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "14px 12px 14px 16px", flexShrink: 0,
                        borderBottom: "1px solid rgba(128,128,128,0.1)",
                    }}
                >
                    <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 600, textAlign: "center", paddingLeft: 32 }}>
                        <span style={{ fontWeight: 700 }}>{total}</span> {copy.title}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={copy.close}
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                            border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "color-mix(in srgb, currentColor 7%, transparent)",
                            color: "inherit", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, currentColor 13%, transparent)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "color-mix(in srgb, currentColor 7%, transparent)")}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Search. Hidden when there is nothing to search. */}
                {people.length > 0 && (
                    <div style={{ padding: "12px 16px", flexShrink: 0 }}>
                        <div style={{ position: "relative" }}>
                            <svg
                                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.25, pointerEvents: "none" }}
                            >
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={copy.searchPlaceholder}
                                style={{
                                    width: "100%", padding: "10px 12px 10px 34px", fontSize: 13,
                                    border: "1px solid rgba(128,128,128,0.12)",
                                    borderRadius: "var(--input-radius, 8px)",
                                    background: "rgba(128,128,128,0.03)", outline: "none",
                                    boxSizing: "border-box",
                                    color: "inherit", fontFamily: "var(--body-font, system-ui)",
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Only this scrolls, so the panel keeps its size. */}
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 8px 12px" }}>
                    {loading ? (
                        <div style={{ padding: "40px 0", textAlign: "center" }}>
                            <div
                                className="animate-spin"
                                style={{
                                    width: 20, height: 20, borderRadius: "50%", margin: "0 auto",
                                    border: "2px solid rgba(128,128,128,0.15)",
                                    borderTopColor: "var(--brand-color, currentColor)",
                                }}
                            />
                        </div>
                    ) : filtered.length === 0 ? (
                        search ? (
                            <EmptyState
                                title={copy.noResultsTitle}
                                subtitle={copy.noResultsSubtitle(search)}
                                icon={<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>}
                            />
                        ) : (
                            <EmptyState
                                title={copy.emptyTitle}
                                subtitle={copy.emptySubtitle}
                                icon={<>
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </>}
                            />
                        )
                    ) : (
                        filtered.map(person => {
                            const body = (
                                <>
                                    <Avatar person={person} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {person.name}
                                        </p>
                                        <p style={{ margin: "1px 0 0", fontSize: 12, opacity: 0.35 }}>
                                            {person.subtitle ?? `@${person.usertag}`}
                                        </p>
                                    </div>
                                </>
                            );
                            const rowStyle: React.CSSProperties = {
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 12px", borderRadius: ROW_RADIUS,
                                textDecoration: "none", color: "inherit",
                                transition: "background 0.1s",
                            };
                            return hrefFor ? (
                                <a
                                    key={person.usertag}
                                    href={hrefFor(person)}
                                    style={rowStyle}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(128,128,128,0.04)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                    {body}
                                </a>
                            ) : (
                                <div key={person.usertag} style={rowStyle}>{body}</div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
