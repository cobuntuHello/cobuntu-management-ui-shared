import { useEffect, useState } from "react";
import type { OverviewListing, OverviewViewerRole } from "./types";
import { CommunityPicker } from "./CommunityPicker";
import {
    LISTING_PICKER_MIN, LISTING_TOP_N,
    conversion, countByStatus, formatCount, rollupOthers, sortListings, type ListingSort,
} from "./format";

type T = (key: string, vars?: Record<string, string | number>) => string;

const STATUS_TONE: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-amber-50 text-amber-700",
    PAUSED: "bg-blue-50 text-blue-700",
    CANCELLED: "bg-zinc-100 text-zinc-500",
    REVOKED: "bg-zinc-100 text-zinc-500",
};

type KeepColumn = { label: string; of: (l: OverviewListing) => number };

/**
 * Whose money the money column(s) are, by who is looking.
 *
 * ONE column named for the viewer when the backend says who is looking. When it
 * does not (an older payload) BOTH sides of the sale are shown and named, as the
 * card version always did: the same sale is two different numbers depending on
 * whose it is, and a lone "net" was once read by a leader as the community's.
 */
function keepColumns(role: OverviewViewerRole | undefined, t: T): KeepColumn[] {
    if (role === "carrier") return [{ label: t("overviewYourCommunityEarned"), of: (l) => l.communityNet ?? 0 }];
    if (role === "community-leader") return [{ label: t("overviewCommunityKeeps"), of: (l) => l.net }];
    if (role === "co-owner" || role === "admin") return [{ label: t("overviewSellerNet"), of: (l) => l.net }];
    if (role === "owner") return [{ label: t("overviewColYouKeep"), of: (l) => l.net }];
    return [
        { label: t("overviewCommunityEarned"), of: (l) => l.communityNet ?? 0 },
        { label: t("overviewSellerNet"), of: (l) => l.net },
    ];
}

/** One render per width, so a phone's list and a desktop's table never both sit in the DOM. */
function useIsNarrow(): boolean {
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(max-width: 767px)");
        const sync = () => setNarrow(mq.matches);
        sync();
        mq.addEventListener?.("change", sync);
        return () => mq.removeEventListener?.("change", sync);
    }, []);
    return narrow;
}

function Icon({ l }: { l: OverviewListing }) {
    return l.communityIcon ? (
        <img src={l.communityIcon} alt="" className="h-9 w-9 flex-none rounded-lg object-cover" />
    ) : (
        <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-zinc-100 text-[14px] font-bold text-zinc-500">
            {l.communityName.trim().charAt(0).toUpperCase()}
        </span>
    );
}

/**
 * Where it is listed, one row per community.
 *
 * It scales on purpose. With three or fewer communities it is a plain table;
 * from four it gains a summary line, a community picker (which rescopes the
 * whole page) and a sort, and shows the top five with the rest folded into one
 * row of totals and a press to see them all. A Premium member can carry an item
 * in many communities and a flat list of ten rows is not a summary.
 *
 * Three rules carried over from the card version, none of them negotiable:
 *
 *  - A listing that cannot sell shows its STATE in words, never figures. Four
 *    zeroes read as "nobody bought it" where the truth is nobody could.
 *  - The money column is named for WHOSE money it is (see `keepColumn`), because
 *    a leader once read the seller's net as the community's.
 *  - One link per row, a real href. No shelf control here: taking a live listing
 *    down belongs on the listing's own page.
 */
export function ListingsTable({
    listings, viewerRole, scopeId, onScope, listingHref, t, locale, cash,
}: {
    listings: OverviewListing[];
    viewerRole?: OverviewViewerRole;
    scopeId: string | null;
    onScope: (listingId: string | null) => void;
    listingHref: (l: OverviewListing) => string;
    t: T;
    locale: string;
    cash: (n: number) => string;
}) {
    const [sort, setSort] = useState<ListingSort>("sold");
    const [expanded, setExpanded] = useState(false);

    const many = listings.length >= LISTING_PICKER_MIN;
    const narrow = useIsNarrow();
    const keeps = keepColumns(viewerRole, t);
    const keep = keeps[keeps.length - 1];
    const visible = scopeId ? listings.filter((l) => l.listingId === scopeId) : listings;
    // Live rows lead: a listing that cannot sell has no figures to rank by.
    const live = sortListings(visible.filter((l) => l.status === "ACTIVE"), sort);
    const notLive = visible.filter((l) => l.status !== "ACTIVE");
    const ordered = [...live, ...notLive];

    const fold = many && !expanded && !scopeId && ordered.length > LISTING_TOP_N;
    const shown = fold ? ordered.slice(0, LISTING_TOP_N) : ordered;
    const rest = fold ? ordered.slice(LISTING_TOP_N) : [];
    const others = rest.length > 0 ? rollupOthers(rest.filter((l) => l.status === "ACTIVE")) : null;
    const totalSold = live.reduce((n, l) => n + l.sold, 0) || 1;

    /* WHAT WAS AGREED, in one line: the package, the rate, and since when. A rate
       on its own does not say what for. */
    const agreement = (l: OverviewListing) =>
        [
            l.packageName,
            l.commissionRate !== null ? t("overviewCommission", { rate: l.commissionRate }) : null,
            l.approvedAt
                ? t("overviewApprovedOn", { date: new Date(l.approvedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })
                : l.requestedAt
                    ? t("overviewRequestedOn", { date: new Date(l.requestedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })
                    : null,
        ].filter(Boolean).join(" · ");

    const pct = (l: OverviewListing) => {
        const c = conversion(l.sold, l.views);
        return c === null ? "—" : `${c.toFixed(1)}%`;
    };

    const name = (l: OverviewListing) => (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[14.5px] font-semibold text-zinc-900">{l.communityName}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[l.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                    {t(`overviewStatus_${l.status}`)}
                </span>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-zinc-500">{agreement(l)}</p>
        </div>
    );

    return (
        <div className="space-y-3">
            {many && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[14px] text-zinc-700">
                        <span className="font-semibold text-zinc-900">{t("overviewCommunitiesCount", { count: listings.length })}</span>
                        {countByStatus(listings).map((s) => (
                            <span key={s.status} className="text-zinc-500">{" · "}{s.count} {t(`overviewStatus_${s.status}`).toLowerCase()}</span>
                        ))}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <CommunityPicker listings={listings} value={scopeId} onChange={onScope} t={t} />
                        <select
                            aria-label={t("overviewSortBy")}
                            value={sort}
                            onChange={(e) => setSort(e.target.value as ListingSort)}
                            className="min-h-[40px] cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 font-semibold text-zinc-800"
                        >
                            <option value="sold">{t("overviewSortBy")}: {t("overviewSortSold")}</option>
                            <option value="views">{t("overviewSortBy")}: {t("overviewSortViews")}</option>
                            <option value="converts">{t("overviewSortBy")}: {t("overviewSortConverts")}</option>
                            <option value="keep">{t("overviewSortBy")}: {t("overviewSortKeep")}</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Wide: a real table. */}
            {!narrow && <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white">
                <table className="w-full border-collapse text-[14px]">
                    <thead>
                        <tr className="text-left text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">
                            <th scope="col" className="px-5 py-3">&nbsp;</th>
                            <th scope="col" className="px-3 py-3 text-right">{t("overviewViews")}</th>
                            <th scope="col" className="px-3 py-3 text-right">{t("overviewSold")}</th>
                            <th scope="col" className="px-3 py-3 text-right">{t("overviewConverts")}</th>
                            <th scope="col" className="px-3 py-3 text-right">{t("overviewGross")}</th>
                            {keeps.map((k) => <th key={k.label} scope="col" className="px-3 py-3 text-right">{k.label}</th>)}
                            <th scope="col" className="px-3 py-3 text-right">{t("overviewColShare")}</th>
                            <th scope="col" className="px-5 py-3">&nbsp;</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((l) => {
                            const sells = l.status === "ACTIVE";
                            return (
                                <tr key={l.listingId} className="border-t border-zinc-200/70 align-middle tabular-nums">
                                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><Icon l={l} />{name(l)}</div></td>
                                    {sells ? (
                                        <>
                                            <td className="px-3 py-3.5 text-right">{formatCount(l.views, locale)}</td>
                                            <td className="px-3 py-3.5 text-right font-semibold">{formatCount(l.sold, locale)}</td>
                                            <td className="px-3 py-3.5 text-right">{pct(l)}</td>
                                            <td className="px-3 py-3.5 text-right">{cash(l.gross)}</td>
                                            {keeps.map((k) => <td key={k.label} className="px-3 py-3.5 text-right font-semibold">{cash(k.of(l))}</td>)}
                                            <td className="px-3 py-3.5">
                                                <div className="ml-auto h-2 w-20 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
                                                    <div className="h-full rounded-full bg-zinc-900" style={{ width: `${Math.round((l.sold / totalSold) * 100)}%` }} />
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <td colSpan={4 + keeps.length} className="px-3 py-3.5 text-[12.5px] text-zinc-500">{t(`overviewListingState_${l.status}`)}</td>
                                    )}
                                    <td className="px-5 py-3.5 text-right">
                                        <a href={listingHref(l)} className="cursor-pointer whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-zinc-700">
                                            {t("overviewManageListing")}
                                        </a>
                                    </td>
                                </tr>
                            );
                        })}
                        {others && (
                            <tr className="border-t border-zinc-200/70 bg-zinc-50/60 tabular-nums text-zinc-700">
                                <td className="px-5 py-3.5 font-semibold">{t("overviewOthers", { count: rest.length })}</td>
                                <td className="px-3 py-3.5 text-right">{formatCount(others.views, locale)}</td>
                                <td className="px-3 py-3.5 text-right font-semibold">{formatCount(others.sold, locale)}</td>
                                <td className="px-3 py-3.5 text-right">{(() => { const c = conversion(others.sold, others.views); return c === null ? "—" : `${c.toFixed(1)}%`; })()}</td>
                                <td className="px-3 py-3.5 text-right">{cash(others.gross)}</td>
                                {keeps.map((k) => <td key={k.label} className="px-3 py-3.5 text-right font-semibold">{cash(rest.filter((l) => l.status === "ACTIVE").reduce((n, l) => n + k.of(l), 0))}</td>)}
                                <td className="px-3 py-3.5" /><td className="px-5 py-3.5" />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>}

            {/* Narrow: compact rows, same facts. */}
            {narrow && <ul className="m-0 list-none rounded-2xl border border-zinc-200/70 bg-white px-4 py-1">
                {shown.map((l) => (
                    <li key={l.listingId} className="flex items-center gap-3 border-t border-zinc-200/70 py-3 first:border-t-0">
                        <Icon l={l} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2">
                                <span className="text-[14px] font-semibold text-zinc-900">{l.communityName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[l.status] ?? "bg-zinc-100 text-zinc-500"}`}>{t(`overviewStatus_${l.status}`)}</span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-zinc-500">
                                {l.status === "ACTIVE"
                                    ? `${formatCount(l.views, locale)} ${t("overviewViews").toLowerCase()} · ${pct(l)} ${t("overviewConverts").toLowerCase()}`
                                    : t(`overviewListingState_${l.status}`)}
                            </p>
                        </div>
                        {l.status === "ACTIVE" && (
                            <div className="text-right tabular-nums">
                                <div className="text-[14px] font-semibold text-zinc-900">{formatCount(l.sold, locale)} {t("overviewSold").toLowerCase()}</div>
                                <div className="text-[12px] font-semibold text-emerald-700">{cash(keep.of(l))}</div>
                            </div>
                        )}
                        <a href={listingHref(l)} className="flex-none text-[12.5px] font-semibold text-zinc-700 underline">{t("overviewManageListing")}</a>
                    </li>
                ))}
            </ul>}

            {fold && (
                <button type="button" onClick={() => setExpanded(true)} className="min-h-[44px] cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50">
                    {t("overviewShowAll", { count: listings.length })}
                </button>
            )}
            {many && expanded && ordered.length > LISTING_TOP_N && (
                <button type="button" onClick={() => setExpanded(false)} className="min-h-[44px] cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50">
                    {t("overviewShowFewer")}
                </button>
            )}
        </div>
    );
}
