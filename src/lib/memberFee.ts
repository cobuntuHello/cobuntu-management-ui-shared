/**
 * The member seller fee as a create wizard states it, in the currency the item
 * is priced in (multi-currency MC3c, decision MC-D7; Cobuntu Premium Phase 3).
 *
 * Since Premium Phase 3 the fee is Cobuntu's own and NOT all-in:
 *
 *   Free member     2.5% of the member's share plus a fixed part worth about
 *                   EUR 0.05, set per currency at a round amount (GBP 0.05,
 *                   JPY 10, KRW 80, ...), and Stripe's processing ON TOP.
 *   Premium member  no Cobuntu fee at all; Stripe's processing only.
 *
 * Until Phase 3 it was 4% + about EUR 0.30 and Cobuntu paid Stripe out of it.
 * `processing` is Stripe's estimate (about 1.5% + about EUR 0.25): a separate
 * charge on the member's share now, never a part of Cobuntu's fee, which is
 * why `processingOnTop` is set and the PackagePicker shows it as its own line.
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
  /** Cobuntu's fee, percent of the member's share: 2.5, or 0 for a Premium seller. */
  rate: number;
  /** Its fixed part, in the smallest unit of `currency`: 0 for a Premium seller. */
  fixedCents: number;
  /** ISO code the fixed parts are in. */
  currency: string;
  /** Stripe's processing estimate, charged ON TOP of Cobuntu's fee: percent, and fixed part in the same unit. */
  processing: { rate: number; fixedCents: number };
  /** Stripe comes on top of `rate`/`fixedCents`, not out of them (Premium Phase 3). */
  processingOnTop: true;
  /** The seller has an active Cobuntu Premium subscription: no Cobuntu fee. */
  premium: boolean;
}

const MEMBER_SELLER_RATE = 2.5;
const STRIPE_RATE_ESTIMATE = 1.5;

const FIXED_BY_CURRENCY: Readonly<Record<string, { memberSellerFixed: number; stripeFixedEstimate: number }>> = {
  EUR: { memberSellerFixed: 5, stripeFixedEstimate: 25 },
  USD: { memberSellerFixed: 5, stripeFixedEstimate: 30 },
  GBP: { memberSellerFixed: 5, stripeFixedEstimate: 20 },
  CAD: { memberSellerFixed: 10, stripeFixedEstimate: 40 },
  AUD: { memberSellerFixed: 10, stripeFixedEstimate: 40 },
  JPY: { memberSellerFixed: 10, stripeFixedEstimate: 45 },
  CHF: { memberSellerFixed: 5, stripeFixedEstimate: 25 },
  NZD: { memberSellerFixed: 10, stripeFixedEstimate: 50 },
  SGD: { memberSellerFixed: 10, stripeFixedEstimate: 35 },
  HKD: { memberSellerFixed: 50, stripeFixedEstimate: 220 },
  SEK: { memberSellerFixed: 50, stripeFixedEstimate: 275 },
  NOK: { memberSellerFixed: 50, stripeFixedEstimate: 250 },
  DKK: { memberSellerFixed: 40, stripeFixedEstimate: 185 },
  MXN: { memberSellerFixed: 100, stripeFixedEstimate: 500 },
  BRL: { memberSellerFixed: 30, stripeFixedEstimate: 150 },
  INR: { memberSellerFixed: 500, stripeFixedEstimate: 2500 },
  KRW: { memberSellerFixed: 80, stripeFixedEstimate: 350 },
  PLN: { memberSellerFixed: 20, stripeFixedEstimate: 110 },
  ZAR: { memberSellerFixed: 100, stripeFixedEstimate: 450 },
};

/**
 * The member seller fee for an item priced in `currency` (EUR when unknown or
 * absent). `premium` is the SELLER's Cobuntu Premium status: Cobuntu then takes
 * nothing, and Stripe's processing is all that is deducted.
 */
export function memberFeeFor(currency?: string | null, opts: { premium?: boolean } = {}): MemberFee {
  const code = String(currency || "EUR").toUpperCase();
  const known = FIXED_BY_CURRENCY[code];
  const fixed = known ?? FIXED_BY_CURRENCY.EUR!;
  const premium = opts.premium === true;
  return {
    rate: premium ? 0 : MEMBER_SELLER_RATE,
    fixedCents: premium ? 0 : fixed.memberSellerFixed,
    currency: known ? code : "EUR",
    processing: { rate: STRIPE_RATE_ESTIMATE, fixedCents: fixed.stripeFixedEstimate },
    processingOnTop: true,
    premium,
  };
}

/**
 * A fee's fixed part in its own currency: "€0.05", "£0.05", "¥10", "₩80".
 * Whole units for a currency without cents (its own decimals, from Intl), so
 * yen are never divided by 100. Always formatted in English, as the fee
 * figures around it are, so the server and the browser agree.
 */
export function formatFixedFee(minor: number, currency: string): string {
  const f = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() });
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  return f.format(minor / 10 ** digits);
}
