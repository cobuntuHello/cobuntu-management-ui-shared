/**
 * Discount codes as the backend serves them
 * (backend docs/features/discount-codes.md, core routes under
 * /api/communities/:tag/{products/:id | events/:id}/discount-codes).
 * Money is in the smallest unit of `currency`, as everywhere.
 */
export type DiscountCodeMode = "PERCENT_OFF" | "AMOUNT_OFF";
export type DiscountWarning = "FREE" | "BELOW_MINIMUM" | "HALF_OR_MORE_OFF";

export interface DiscountCode {
  id: string;
  code: string;
  mode: DiscountCodeMode;
  /** A whole percent (1-100) or an amount off each unit. */
  value: number;
  currency: string | null;
  tierIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perBuyerLimit: number | null;
  isActive: boolean;
  archivedAt: string | null;
  uses: { used: number; held: number };
  lowestPrice: { amount: number; currency: string; audience: "EVERYONE" | "MEMBERS" } | null;
}

export interface PriceRow { from: number; price: number; warnings: DiscountWarning[] }

export interface DiscountPreview {
  tiers: {
    tierId: string | null;
    name: string;
    currency: string;
    listPrice: number;
    everyone: PriceRow;
    members: (PriceRow & { segmentId: string; segmentName: string; communityName: string | null })[];
    perInstalmentOf: number | null;
  }[];
  warnings: { tierId: string | null; tierName: string; audience: "EVERYONE" | "MEMBERS"; segmentName: string | null; warning: DiscountWarning }[];
  lowestPrice: DiscountCode["lowestPrice"];
}

/** What the editor sends. Unset fields keep the code's saved values on an update. */
export interface DiscountCodeDraft {
  code: string;
  mode: DiscountCodeMode;
  value: number;
  tierIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perBuyerLimit: number | null;
}

/** A tier the code may cover, for the editor's "Tickets" choice. */
export interface DiscountTierOption {
  id: string;
  name: string;
  /**
   * The tier's own currency, when it can differ from the item's (an event's
   * tiers each sell in their own). An amount off is in this currency, so the
   * editor reads it from the tiers the code covers.
   */
  currency?: string;
}
