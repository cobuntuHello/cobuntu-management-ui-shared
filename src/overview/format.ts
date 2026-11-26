import type { OverviewStats } from "./types";

/**
 * The arithmetic behind the Overview tiles, kept out of the component.
 *
 * Every function here is one a test can pin without rendering anything, and
 * each exists because getting it wrong would be invisible on screen: a
 * conversion rate that divides by zero, a "last 30 days" window that silently
 * includes week 5, a percentage change against a period with no data.
 */

/** Amounts are stored in the smallest unit. */
export function formatMoney(cents: number, currency = "EUR", locale = "en-GB"): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format((cents ?? 0) / 100);
}

export function formatCount(n: number, locale = "en-GB"): string {
    return new Intl.NumberFormat(locale).format(n ?? 0);
}

/**
 * Viewed to bought.
 *
 * Null rather than 0 when nothing has been viewed: "0%" is a claim that people
 * looked and did not buy, which is a different and more discouraging fact than
 * "nobody has looked yet". The tile renders a dash for null.
 */
export function conversion(sold: number, views: number): number | null {
    if (!views || views <= 0) return null;
    return (sold / views) * 100;
}

/**
 * Sum the last `weeks` buckets, and the `weeks` before them, so a tile can say
 * what changed.
 *
 * Reads the tail of the series rather than filtering on dates: the series is
 * already weekly, already ordered, and already sparse (weeks with no activity
 * are absent), so a date filter would have to reconstruct the gaps to get the
 * same answer.
 */
export function recentWindows<K extends "sold" | "net" | "views">(
    weekly: OverviewStats["weekly"],
    key: K,
    weeks = 4,
): { current: number; previous: number } {
    const sum = (rows: OverviewStats["weekly"]) => rows.reduce((n, w) => n + (w[key] ?? 0), 0);
    const tail = weekly.slice(-weeks);
    const before = weekly.slice(-(weeks * 2), -weeks);
    return { current: sum(tail), previous: sum(before) };
}

/**
 * Percentage change, or null when there is nothing to compare against.
 *
 * A previous period of zero has no percentage change -- "+100%" off a base of
 * nothing is not information, and "+∞" is worse. The caller shows the raw
 * number alone in that case.
 */
export function delta(current: number, previous: number): number | null {
    if (!previous || previous <= 0) return null;
    return ((current - previous) / previous) * 100;
}

/**
 * Whether the per-listing numbers can be presented alongside the total.
 *
 * They always can; this returns whether an explanation is NEEDED, which is
 * whenever some views belong to no listing. The page uses it to decide if a
 * footnote appears, rather than each caller re-deriving the rule.
 */
export function hasUnattributedViews(stats: OverviewStats): boolean {
    return (stats.views?.unattributed ?? 0) > 0;
}

/**
 * Days until an ISO date, floored, or null if it has passed or is absent.
 *
 * `now` is injected so a test is not at the mercy of the clock.
 */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const ms = then - now.getTime();
    if (ms < 0) return null;
    return Math.floor(ms / 86400000);
}

/**
 * Is this listing one a buyer can actually reach?
 *
 * The Overview's most important state is "created, but on no shelf anywhere",
 * and that is a question about listings rather than about the item. ACTIVE is
 * the only status that sells.
 */
export function isSellable(stats: OverviewStats): boolean {
    return (stats.listings ?? []).some((l) => l.status === "ACTIVE");
}

/** The ranges the trend can be sliced to. "all" is every week the API returned. */
export type OverviewRange = "4" | "11" | "all";

/**
 * The weeks inside a range, counted back from the LATEST week in the series.
 *
 * Counted from the series' own last week and not from today's date: the series
 * is sparse (weeks with no activity are absent), so a date cutoff would
 * silently drop a quiet-but-recent tail and show a seller less than they have.
 * The cutoff is measured in calendar weeks so a gap still counts as a week.
 */
export function sliceRange<T extends { week: string }>(weekly: T[], range: OverviewRange): T[] {
    if (range === "all" || weekly.length === 0) return weekly;
    const weeks = range === "4" ? 4 : 11;
    const last = new Date(weekly[weekly.length - 1].week).getTime();
    const cutoff = last - (weeks - 1) * 7 * 86400000;
    return weekly.filter((w) => new Date(w.week).getTime() >= cutoff);
}

const WEEK_MS = 7 * 86400000;

/** Monday 00:00 UTC of the week `d` falls in: the week a weekly series is keyed by. */
function weekStartUtc(d: Date): Date {
    const back = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}

/**
 * The first and last week the EMPTY chart's axis is labelled with, so the
 * placeholder reads as the chart that is coming, for the range the seller
 * picked. It ends at the latest week the series knows (as sliceRange counts),
 * or this week when there is none. "All time" has no span to show yet, so it
 * shows four weeks, as the shortest range does.
 */
export function emptyTrendSpan(weekly: Array<{ week: string }>, range: OverviewRange, now: Date = new Date()): { from: string; to: string } {
    const to = weekly.length ? new Date(weekly[weekly.length - 1].week) : weekStartUtc(now);
    const weeks = range === "11" ? 11 : 4;
    return { from: new Date(to.getTime() - (weeks - 1) * WEEK_MS).toISOString(), to: to.toISOString() };
}

export type ListingSort = "sold" | "views" | "converts" | "keep";

type Row = { sold: number; views: number; net: number; signups?: number };

/**
 * Who CONVERTED on a listing: for an event, everyone who signed up (free or
 * paid); for a product, the sales. Sold stays paid sales; this is the
 * numerator of the conversion rate only.
 */
export function converted(l: { sold: number; signups?: number }): number {
    return l.signups ?? l.sold;
}

/** Sort descending by the chosen measure. Ties keep their given order. */
export function sortListings<L extends Row>(rows: L[], by: ListingSort): L[] {
    const key = (l: L): number => {
        if (by === "views") return l.views;
        if (by === "keep") return l.net;
        if (by === "converts") return l.views > 0 ? converted(l) / l.views : -1;
        return l.sold;
    };
    return rows
        .map((l, i) => ({ l, i }))
        .sort((a, b) => key(b.l) - key(a.l) || a.i - b.i)
        .map((x) => x.l);
}

/** Count listings per status, for "8 live, 1 in review". Skips zero counts. */
export function countByStatus(rows: Array<{ status: string }>): Array<{ status: string; count: number }> {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return [...m.entries()].map(([status, count]) => ({ status, count }));
}

/**
 * Past a handful of communities a table stops being scannable: show the top few
 * and fold the rest into one row of totals, with the rest a press away.
 */
export const LISTING_TOP_N = 5;
export const LISTING_PICKER_MIN = 4;

export function rollupOthers<L extends { sold: number; views: number; gross: number; net: number; signups?: number }>(
    rest: L[],
): { sold: number; views: number; gross: number; net: number; count: number; signups: number } {
    return rest.reduce(
        (a, l) => ({ sold: a.sold + l.sold, views: a.views + l.views, gross: a.gross + l.gross, net: a.net + l.net, count: a.count + 1, signups: a.signups + converted(l) }),
        { sold: 0, views: 0, gross: 0, net: 0, count: 0, signups: 0 },
    );
}
