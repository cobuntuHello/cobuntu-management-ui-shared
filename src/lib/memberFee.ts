/**
 * The member seller fee as a create wizard states it, in the currency the item
 * is priced in (multi-currency MC3c, decision MC-D7).
 *
 * The fee is 4% of the member's share plus a fixed part worth about EUR 0.30,
 * set per currency at a round amount: GBP 0.25, USD 0.35, JPY 50, and so on.
 * It is all-in: Stripe's processing (about 1.5% plus a fixed part worth about
 * EUR 0.25) is paid out of it, which is the split the PackagePicker shows.
 *
 * MIRRORS the backend, which is what actually charges: FEE_CONSTANTS
 * (services/finances/src/modules/config/feeConstants.ts: memberSellerRate) and
 * CURRENCY_AMOUNTS (services/finances/src/utils/currencyAmounts.ts:
 * memberSellerFixed, stripeFixedEstimate). Change one, change the other. This
 * copy only displays the fee; a currency it does not know reads as the euro's.
 *
 * All fixed amounts in the currency's smallest unit: cents, pence, whole yen
 * and won.
 */

export interface MemberFee {
  /** Percent of the member's share. */
  rate: number;
  /** Fixed part, in the smallest unit of `currency`. */
  fixedCents: number;
  /** ISO code the fixed parts are in. */
  currency: string;
  /** What Stripe takes out of the fee: percent, and fixed part in the same unit. */
  processing: { rate: number; fixedCents: number };
}

const MEMBER_SELLER_RATE = 4;
const STRIPE_RATE_ESTIMATE = 1.5;

const FIXED_BY_CURRENCY: Readonly<Record<string, { memberSellerFixed: number; stripeFixedEstimate: number }>> = {
  EUR: { memberSellerFixed: 30, stripeFixedEstimate: 25 },
  USD: { memberSellerFixed: 35, stripeFixedEstimate: 30 },
  GBP: { memberSellerFixed: 25, stripeFixedEstimate: 20 },
  CAD: { memberSellerFixed: 50, stripeFixedEstimate: 40 },
  AUD: { memberSellerFixed: 50, stripeFixedEstimate: 40 },
  JPY: { memberSellerFixed: 50, stripeFixedEstimate: 45 },
  CHF: { memberSellerFixed: 30, stripeFixedEstimate: 25 },
  NZD: { memberSellerFixed: 60, stripeFixedEstimate: 50 },
  SGD: { memberSellerFixed: 45, stripeFixedEstimate: 35 },
  HKD: { memberSellerFixed: 250, stripeFixedEstimate: 220 },
  SEK: { memberSellerFixed: 350, stripeFixedEstimate: 275 },
  NOK: { memberSellerFixed: 300, stripeFixedEstimate: 250 },
  DKK: { memberSellerFixed: 225, stripeFixedEstimate: 185 },
  MXN: { memberSellerFixed: 600, stripeFixedEstimate: 500 },
  BRL: { memberSellerFixed: 180, stripeFixedEstimate: 150 },
  INR: { memberSellerFixed: 3000, stripeFixedEstimate: 2500 },
  KRW: { memberSellerFixed: 450, stripeFixedEstimate: 350 },
  PLN: { memberSellerFixed: 130, stripeFixedEstimate: 110 },
  ZAR: { memberSellerFixed: 550, stripeFixedEstimate: 450 },
};

/** The member seller fee for an item priced in `currency` (EUR when unknown or absent). */
export function memberFeeFor(currency?: string | null): MemberFee {
  const code = String(currency || "EUR").toUpperCase();
  const known = FIXED_BY_CURRENCY[code];
  const fixed = known ?? FIXED_BY_CURRENCY.EUR!;
  return {
    rate: MEMBER_SELLER_RATE,
    fixedCents: fixed.memberSellerFixed,
    currency: known ? code : "EUR",
    processing: { rate: STRIPE_RATE_ESTIMATE, fixedCents: fixed.stripeFixedEstimate },
  };
}

/**
 * A fee's fixed part in its own currency: "€0.30", "£0.25", "¥50", "₩450".
 * Whole units for a currency without cents (its own decimals, from Intl), so
 * yen are never divided by 100. Always formatted in English, as the fee
 * figures around it are, so the server and the browser agree.
 */
export function formatFixedFee(minor: number, currency: string): string {
  const f = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() });
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  return f.format(minor / 10 ** digits);
}
