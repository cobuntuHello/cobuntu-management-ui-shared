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
