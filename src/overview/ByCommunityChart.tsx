import type { OverviewListing } from "./types";
import { sliceRange, type OverviewRange } from "./format";

type T = (key: string, vars?: Record<string, string | number>) => string;

const SERIES = ["bg-zinc-900", "bg-amber-700", "bg-sky-600"];
const OTHER = "bg-zinc-300";

/**
 * Sold per week, split by community: the top three by tickets sold, everyone
 * else folded into one grey "others" band. Ten colours cannot be told apart, so
 * past three this draws three and says how many it folded.
 *
 * Needs `listing.weekly`; a backend that does not send it simply gets no chart.
 * Drawn only when two or more communities have sold something, because one
 * community's series is the hero chart again.
 */
export function ByCommunityChart({
    listings, range, t,
}: { listings: OverviewListing[]; range: OverviewRange; t: T }) {
    const withSeries = listings.filter((l) => (l.weekly?.length ?? 0) > 0);
    const sellers = withSeries.filter((l) => (l.weekly ?? []).some((w) => w.sold > 0));
    if (sellers.length < 2) return null;

    const ranked = [...sellers].sort((a, b) => b.sold - a.sold);
    const top = ranked.slice(0, 3);
    const rest = ranked.slice(3);

    const weeks = sliceRange(
        [...new Set(sellers.flatMap((l) => (l.weekly ?? []).map((w) => w.week)))].sort().map((week) => ({ week })),
        range,
    ).map((w) => w.week);
    if (weeks.length < 2) return null;

    const soldIn = (l: OverviewListing, wk: string) => (l.weekly ?? []).find((w) => w.week === wk)?.sold ?? 0;
    const columns = weeks.map((wk) => {
        const parts = top.map((l) => soldIn(l, wk));
        const others = rest.reduce((n, l) => n + soldIn(l, wk), 0);
        return { wk, parts, others, total: parts.reduce((a, b) => a + b, 0) + others };
    });
    const max = Math.max(1, ...columns.map((c) => c.total));
    const label = `${t("overviewByCommunityTitle")}: ${columns.map((c) => c.total).join(", ")}`;

    return (
        <figure className="m-0 rounded-xl border border-zinc-200/70 bg-white p-4">
            <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">{t("overviewByCommunityTitle")}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-600">
                    {top.map((l, i) => (
                        <span key={l.listingId} className="flex items-center gap-1.5">
                            <i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${SERIES[i]}`} />
                            {l.communityName}
                        </span>
                    ))}
                    {rest.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${OTHER}`} />
                            {t("overviewOtherCommunities", { count: rest.length })}
                        </span>
                    )}
                </span>
            </figcaption>
            <div role="img" aria-label={label} className="mt-3 flex h-36 items-end gap-1.5">
                {columns.map((c) => (
                    <div key={c.wk} className="flex h-full flex-1 flex-col justify-end gap-px">
                        {c.others > 0 && <div className={`${OTHER} rounded-[2px]`} style={{ height: `${(c.others / max) * 100}%` }} />}
                        {c.parts.map((n, i) => n > 0 && (
                            <div key={i} className={`${SERIES[i]} rounded-[2px]`} style={{ height: `${(n / max) * 100}%` }} />
                        ))}
                    </div>
                ))}
            </div>
        </figure>
    );
}
