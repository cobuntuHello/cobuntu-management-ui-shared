/**
 * The donation draft, owned here so the two management packages stop keeping
 * byte-identical copies of it. See ./DonationsField.tsx for the full story.
 *
 * A donation is an optional contribution a buyer adds at checkout, ON TOP of
 * whatever they already pay. It is listing-level: one prompt covers every tier
 * or variant. This is NOT the tier-level pay-what-you-want PRICE mode, which
 * sets the price of the item itself.
 */
export interface DonationDraft {
  enabled: boolean;
  mode: "fixed" | "pwyw";
  /** Display-unit amounts (e.g. "5", "10", "25" for euros). */
  amounts: string[];
  /** Display-unit floor for pwyw mode. */
  minAmount: string;
  currency: string;
  label: string;
  /**
   * EVENTS only: WHEN the event asks. `checkout` = an optional extra when
   * someone signs up or buys a ticket; `afterEvent` = on the "How was it?"
   * review screen and its email link, for 30 days after the event. Absent =
   * both, which is how an event's donations behaved before this choice
   * existed (one switch powered both asks). Products have no "after".
   */
  moments?: DonationMoments;
}

export interface DonationMoments {
  checkout: boolean;
  afterEvent: boolean;
}

/** Absent or partial moments mean "ask": both default to true. */
export function resolveMoments(m: Partial<DonationMoments> | null | undefined): DonationMoments {
  return { checkout: m?.checkout !== false, afterEvent: m?.afterEvent !== false };
}

/**
 * Can the host receive a donation right now (a connected Stripe account that
 * takes charges)? Passed by the calling package, which already knows. When
 * not, the editor offers "Connect Stripe" instead of a switch that would only
 * fail on save, because asking people for money that has nowhere to land is
 * the one thing donations must never do.
 */
export interface DonationReceive {
  ready: boolean;
  /** Takes the host to connect Stripe. Without it, the row only explains. */
  onConnect?: () => void;
}

/**
 * Resolve a currency code to its display symbol.
 *
 * Injected rather than owned here on purpose. Both packages already carry a
 * SUPPORTED_CURRENCIES list (identical today, 8 entries), and pulling currency
 * DATA into shared would trade one duplication for another while forcing a
 * decision about which list wins. A three-line resolver is a cheaper seam.
 */
export type SymbolFor = (code: string) => string;
