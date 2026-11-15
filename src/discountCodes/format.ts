import type { DiscountCode, DiscountCodeDraft } from "./types";

/** Units of the smallest denomination in one major unit: 100 for EUR, 1 for JPY and KRW. */
export function minorUnits(currency = "EUR"): number {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    return 10 ** (digits ?? 2);
  } catch {
    return 100;
  }
}

/** An amount in the smallest unit, as the app shows money: €220, €12.50, ¥1,000. Whole amounts drop their cents. */
export function money(minor: number, currency = "EUR", locale = "en-GB"): string {
  const major = minor / minorUnits(currency);
  const whole = Number.isInteger(major);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency,
      minimumFractionDigits: whole ? 0 : undefined,
      maximumFractionDigits: whole ? 0 : undefined,
    }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}

/** "20% off" or "€10 off each". */
export function discountLabel(c: Pick<DiscountCode, "mode" | "value" | "currency">, t: (k: string, v?: Record<string, string | number>) => string): string {
  return c.mode === "PERCENT_OFF"
    ? t("percentOff", { percent: c.value })
    : t("amountOffEach", { amount: money(c.value, c.currency ?? "EUR") });
}

/** The approved design's one-row summary of everything optional: "All · Unlimited · Always". */
export function optionsSummary(d: Pick<DiscountCodeDraft, "tierIds" | "maxRedemptions" | "endsAt">, t: (k: string, v?: Record<string, string | number>) => string, tierCount: number): string {
  const tiers = d.tierIds.length === 0 ? t("allTickets") : t("someTickets", { n: d.tierIds.length, total: tierCount });
  const uses = d.maxRedemptions == null ? t("unlimited") : t("usesLimit", { n: d.maxRedemptions });
  const until = d.endsAt ? t("untilDate", { date: shortDate(d.endsAt) }) : t("always");
  return `${tiers} · ${uses} · ${until}`;
}

export function shortDate(iso: string, locale = "en-GB"): string {
  try { return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return iso.slice(0, 10); }
}

/**
 * A code to start from, so the seller does not have to invent one: a word from
 * the item's name and the discount, "SUMMER20". Letters and digits only, 3-32
 * characters, which is the backend's rule.
 */
export function suggestCode(itemName: string, percent: number | null, salt = Math.random()): string {
  const word = (itemName.normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).find((w) => w.length >= 3) ?? "SAVE")
    .slice(0, 10).toUpperCase();
  const tail = percent && percent > 0 ? String(percent) : String(Math.floor(10 + salt * 89));
  return `${word}${tail}`.slice(0, 32);
}

export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;

/** "12 of 40", or "41 used" without a limit. */
export function usesLabel(c: Pick<DiscountCode, "uses" | "maxRedemptions">, t: (k: string, v?: Record<string, string | number>) => string): string {
  const used = c.uses.used + c.uses.held;
  return c.maxRedemptions == null ? t("usedCount", { n: used }) : t("usedOf", { n: used, max: c.maxRedemptions });
}
