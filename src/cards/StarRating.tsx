/**
 * Compact star-rating display for listing cards + detail pages.
 *
 * Ported from the community-app's StarRating, with next-intl removed: copy is an
 * optional prop with English defaults, so the admin renders it with no i18n and
 * the community-app passes its own translations. Behaviour is identical —
 * "4.7/5 ★ (12)", and an unrated listing holds the row and says so rather than
 * showing "0/5".
 */

export interface StarRatingCopy {
  noReviews: string;
  /** e.g. "(12)" compact, or "12 reviews" full. */
  reviewCount: (count: number) => string;
  ariaLabel: (rating: string, count: number) => string;
}

const DEFAULT_COPY: StarRatingCopy = {
  noReviews: "No reviews yet",
  reviewCount: (c) => `(${c})`,
  ariaLabel: (rating, c) => `Rated ${rating} out of 5 from ${c} reviews`,
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

  if (!Number.isFinite(numeric) || reviews <= 0) {
    return (
      <span
        className={`inline-flex items-baseline gap-1 ${className ?? ""}`}
        style={{ color: "var(--mut, #6b7280)" }}
      >
        <span aria-hidden="true" style={{ opacity: 0.45, fontSize: size === "full" ? "15px" : "12px" }}>★</span>
        <span className={size === "full" ? "text-sm" : "text-xs"}>{c.noReviews}</span>
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(5, numeric));
  const display = clamped.toFixed(1);
  const isFull = size === "full";

  return (
    <span
      className={`inline-flex items-baseline gap-1 ${className ?? ""}`}
      aria-label={c.ariaLabel(display, reviews)}
    >
      <span className={isFull ? "text-sm font-semibold" : "text-xs font-semibold"}>
        {display}
        <span className="opacity-50">/5</span>
      </span>
      <span aria-hidden="true" style={{ color: "#f59e0b", fontSize: isFull ? "15px" : "12px" }}>★</span>
      <span className={isFull ? "text-sm opacity-70" : "text-xs opacity-60"}>{c.reviewCount(reviews)}</span>
    </span>
  );
}
