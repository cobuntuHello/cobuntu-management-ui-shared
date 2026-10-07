/**
 * Storefront listing cards — the shared card layer both the community-app
 * storefront and the admin review queues render, so they stay identical.
 *
 * PR 1 (this module) is the next-intl-free FOUNDATION: pure helpers and the leaf
 * presentation pieces, copy injected via props with English defaults. The full
 * ProductCard / event card and the Option-A review overlay build on these in the
 * following PRs.
 */
export { htmlToPlainText } from "./htmlToPlainText";
export { StarRating } from "./StarRating";
export type { StarRatingCopy } from "./StarRating";
export { VerifiedBadge } from "./VerifiedBadge";
export { ListingStateChip } from "./ListingStateChip";
export type { CardState } from "./ListingStateChip";
