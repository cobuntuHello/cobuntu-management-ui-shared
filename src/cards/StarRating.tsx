/**
 * Compact star-rating display for listing cards + detail pages.
 *
 * A verbatim port of the community-app's current StarRating (the 2026-09-23
 * behaviour), with next-intl removed: copy is an optional prop with English
 * defaults, so the admin renders it with no i18n and the community-app threads
 * its own translations. An UNRATED listing shows "0/5 ★ (0)" — the same shape as
 * a real rating, never hidden and never a sentence — because reviews are empty
 * across production and hiding would make the control read as broken. The "no
 * reviews" string is the aria-label only.
 */

export interface StarRatingCopy {
  /** aria-label when the listing has a rating. */
  ariaLabel: (rating: string, count: number) => string;
  /** aria-label when unrated (there is no visible "no reviews" text). */
  noReviewsAria: string;
  /** The full-size suffix, e.g. "12 reviews". Compact is always "(n)". */
  reviewSuffixFull: (count: number) => string;
}

const DEFAULT_COPY: StarRatingCopy = {
  ariaLabel: (rating, c) => `Rated ${rating} out of 5 from ${c} reviews`,
  noReviewsAria: "No reviews yet",
  reviewSuffixFull: (c) => `${c} ${c === 1 ? "review" : "reviews"}`,
};

interface Props {
  value: number | string | null | undefined;
  count: number | null | undefined;
  size?: "compact" | "full";
  className?: string;
  copy?: Partial<StarRatingCopy>;
}

export function StarRating({ value, count, size = "compact", className, copy }: Props) {
  const c = { ...DEFAULT_COPY, ...copy };
  const numeric = typeof value === "number" ? value : parseFloat(value ?? "");
  const reviews = typeof count === "number" ? count : 0;
  const hasRating = Number.isFinite(numeric) && reviews > 0;

  const clamped = hasRating ? Math.max(0, Math.min(5, numeric)) : 0;
  const display = hasRating ? clamped.toFixed(1) : "0";
  const isFull = size === "full";

  return (
    <span
      className={`inline-flex items-baseline gap-1 whitespace-nowrap ${className ?? ""}`}
      aria-label={hasRating ? c.ariaLabel(display, reviews) : c.noReviewsAria}
    >
      <span className={isFull ? "text-sm font-semibold" : "text-xs font-semibold"}>
        {display}
        <span className="opacity-50">/5</span>
      </span>
      <span aria-hidden="true" style={{ color: "#f59e0b", fontSize: isFull ? "15px" : "12px" }}>★</span>
      <span className={isFull ? "text-sm opacity-70" : "text-xs opacity-60"}>
        {isFull ? c.reviewSuffixFull(reviews) : `(${reviews})`}
      </span>
    </span>
  );
}
