/**
 * Value lines: what the buyer gets, each line with a value (PBN feedback L2;
 * backend docs/features/value-lines.md).
 *
 * Stored as [{ label, value }] with `value` in CENTS, like every amount in
 * Cobuntu. The seller types amounts in whole currency units ("120"), so the
 * editor converts at the edge. Only the lines are stored: the page sums them
 * into "Total value" and computes the member discount from real member pricing.
 */

export type ValueLine = { label: string; value: number };

/** Backend limits (shared/valueLines.ts). Mirrored so the editor stops early. */
export const MAX_VALUE_LINES = 12;
export const MAX_VALUE_LINE_LABEL = 80;

/** "120", "120.5", "1 200,50" → cents; null when not a non-negative amount. */
export function amountToCents(input: string): number | null {
    const cleaned = input.replace(/\s/g, "").replace(",", ".");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
}

/** cents → "120" or "120.50", for the amount field. */
export function centsToAmount(cents: number): string {
    return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function sumValueLines(lines: ValueLine[]): number {
    return lines.reduce((sum, l) => sum + l.value, 0);
}

/** Same JSON, same lines: used to send the field only when it changed. */
export function sameValueLines(a: ValueLine[] | null | undefined, b: ValueLine[] | null | undefined): boolean {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}
