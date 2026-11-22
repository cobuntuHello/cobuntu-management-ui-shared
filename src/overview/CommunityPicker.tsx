import { useEffect, useMemo, useRef, useState } from "react";
import type { OverviewListing } from "./types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Pick one community to rescope the Overview to, or all of them. A plain select
 * stopped working at ten communities: a long unordered list with no way to
 * type. This opens a small panel with a search field, filters as you type,
 * and closes on a choice, Escape or a click outside.
 */
export function CommunityPicker({
    listings, value, onChange, t,
}: {
    listings: OverviewListing[];
    value: string | null;
    onChange: (listingId: string | null) => void;
    t: T;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    }, [open]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? listings.filter((l) => l.communityName.toLowerCase().includes(q)) : listings;
    }, [listings, query]);

    const current = value ? listings.find((l) => l.listingId === value) : null;
    const label = current ? current.communityName : `${t("overviewAllCommunities")} (${listings.length})`;
    const choose = (id: string | null) => { onChange(id); setOpen(false); setQuery(""); };

    return (
        <div ref={root} className="relative">
            <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={t("overviewAllCommunities")}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="max-w-[220px] truncate">{label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-zinc-400" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {open && (
                <div role="dialog" aria-label={t("overviewSearchCommunities")} className="absolute right-0 z-20 mt-2 w-[280px] rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("overviewSearchCommunities")}
                        aria-label={t("overviewSearchCommunities")}
                        className="mb-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400"
                    />
                    <ul className="m-0 max-h-[280px] list-none overflow-y-auto p-0">
                        {!query && (
                            <li>
                                <button type="button" aria-pressed={value === null} onClick={() => choose(null)}
                                    className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] ${value === null ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"}`}>
                                    {t("overviewAllCommunities")} ({listings.length})
                                </button>
                            </li>
                        )}
                        {matches.map((l) => (
                            <li key={l.listingId}>
                                <button type="button" aria-pressed={value === l.listingId} onClick={() => choose(l.listingId)}
                                    className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] ${value === l.listingId ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"}`}>
                                    {l.communityName}
                                </button>
                            </li>
                        ))}
                        {matches.length === 0 && (
                            <li className="px-3 py-2 text-[13px] text-zinc-500">{t("overviewNoCommunityMatch")}</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
