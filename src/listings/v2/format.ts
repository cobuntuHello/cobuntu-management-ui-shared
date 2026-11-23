/**
 * Money and dates for the listing page v2.
 *
 * Money arrives in the currency's smallest unit (cents; whole yen). It is
 * printed in en-GB with the currency's own decimals, so "€16.98" and "¥1,800"
 * both read right. Dates are short and named ("18 Nov"), never numeric, and in
 * the event's own time zone when the page knows it.
 */

const decimalsCache = new Map<string, number>();

/** How many minor units make one major unit: 100 for EUR, 1 for JPY. */
export function minorPerMajor(currency: string): number {
    const c = (currency || "EUR").toUpperCase();
    if (!decimalsCache.has(c)) {
        let digits = 2;
        try { digits = new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits ?? 2; } catch { digits = 2; }
        decimalsCache.set(c, digits);
    }
    return 10 ** (decimalsCache.get(c) ?? 2);
}

/** "€16.98", "€369.00", "¥1,800". Always the full decimals: this is money, not a headline. */
export function money(minor: number, currency = "EUR"): string {
    const c = (currency || "EUR").toUpperCase();
    const per = minorPerMajor(c);
    try {
        return new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).format((minor || 0) / per);
    } catch {
        return `${((minor || 0) / per).toFixed(per === 1 ? 0 : 2)} ${c}`;
    }
}

/** "− €0.52": a deduction, with a true minus sign. Zero prints without a sign. */
export function minus(minor: number, currency = "EUR"): string {
    return minor > 0 ? `− ${money(minor, currency)}` : money(0, currency);
}

/** "+ €101.62" / "− €82.88". */
export function signed(minor: number, currency = "EUR"): string {
    return minor < 0 ? `− ${money(-minor, currency)}` : `+ ${money(minor, currency)}`;
}

/** A percent as people write it: 10%, 12.5%, 0%. */
export function percent(rate: number): string {
    const r = Math.round(rate * 100) / 100;
    return `${r % 1 === 0 ? r.toFixed(0) : r}%`;
}

const parse = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "18 Nov". */
export function shortDate(iso: string | null | undefined, timeZone?: string): string {
    const d = parse(iso);
    if (!d) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(timeZone ? { timeZone } : {}) });
}

/** The pieces of a date tile: "DEC", "9", "WED". */
export function dateTile(iso: string | null | undefined, timeZone?: string): { mon: string; day: string; dow: string } | null {
    const d = parse(iso);
    if (!d) return null;
    const tz = timeZone ? { timeZone } : {};
    return {
        mon: d.toLocaleDateString("en-GB", { month: "short", ...tz }).toUpperCase(),
        day: d.toLocaleDateString("en-GB", { day: "numeric", ...tz }),
        dow: d.toLocaleDateString("en-GB", { weekday: "short", ...tz }).toUpperCase(),
    };
}

/** "18:00". */
export function clockOf(iso: string | null | undefined, timeZone?: string): string {
    const d = parse(iso);
    if (!d) return "";
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) });
}

/** "MS" for Marta Silva. */
export function initials(name: string | null | undefined): string {
    const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "·";
}

/** A rate column (Prisma Decimal, string or number) as a number; null when unset. */
export function toRate(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v as never);
    return Number.isFinite(n) ? n : null;
}
