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
