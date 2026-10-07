import type { ReactNode } from "react";
import { BannerPlaceholder } from "../ui/BannerPlaceholder";
import { StarRating, type StarRatingCopy } from "./StarRating";

/**
 * The shared storefront card BODY — image, taxonomy, title, price, rating — with
 * slots so both surfaces compose the same card:
 *   - the community-app storefront adds its member-price pills / sale chips,
 *   - the admin review queue adds the status / commission / requester overlay
 *     (see ListingReviewCard).
 *
 * Typed on a minimal StorefrontCardData the caller maps its domain object into,
 * rather than the full community-app `Product`, so the card stays decoupled from
 * either app's data layer. next-intl-free: price/meta/taxonomy arrive already
 * formatted; star copy is injected.
 */
export interface StorefrontCardData {
  /** Already-formatted title. */
  title: string;
  /** Real image if present; otherwise the deterministic placeholder uses `seed`. */
  imageUrl?: string | null;
  /** Stable per listing (id or name) — drives the placeholder gradient. */
  seed: string;
  /** "Design · UX" — caller joins category/sub-category. */
  taxonomy?: string | null;
  /** Caller-formatted, e.g. "€25.00" or the free label. */
  priceLabel?: string | null;
  /** Render the price in the positive/"free" tone. */
  priceFree?: boolean;
  /** A quiet line beside the price, e.g. "Digital product" / "Course". */
  meta?: string | null;
  /** Rating, when the surface shows it. */
  rating?: { value: number | string | null; count: number | null } | null;
}

export interface StorefrontCardProps {
  data: StorefrontCardData;
  /** Overlay slots on the image corners. */
  mediaTopLeft?: ReactNode;
  mediaTopRight?: ReactNode;
  mediaBottomLeft?: ReactNode;
  /** Below the body — requester + action (admin) or price pills (storefront). */
  footer?: ReactNode;
  starCopy?: Partial<StarRatingCopy>;
  className?: string;
}

export function StorefrontCard({
  data, mediaTopLeft, mediaTopRight, mediaBottomLeft, footer, starCopy, className,
}: StorefrontCardProps) {
  return (
    <article
      className={`flex flex-col min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_10px_26px_-18px_rgba(24,24,27,0.22)] dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}
    >
      <div className="relative aspect-[16/10]">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <BannerPlaceholder seed={data.seed} className="absolute inset-0" />
        )}
        {mediaTopLeft && <div className="absolute left-2.5 top-2.5">{mediaTopLeft}</div>}
        {mediaTopRight && <div className="absolute right-2.5 top-2.5">{mediaTopRight}</div>}
        {mediaBottomLeft && <div className="absolute bottom-2.5 left-2.5">{mediaBottomLeft}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3.5 py-3.5">
        {data.taxonomy && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {data.taxonomy}
          </div>
        )}
        <h3 className="m-0 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
          {data.title}
        </h3>
        {(data.priceLabel || data.meta) && (
          <div className="flex items-center gap-2">
            {data.priceLabel && (
              <span
                className={`text-[15px] font-bold tabular-nums ${data.priceFree ? "text-[13px] font-semibold text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}
              >
                {data.priceLabel}
              </span>
            )}
            {data.meta && <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{data.meta}</span>}
          </div>
        )}
        {data.rating && (
          <StarRating value={data.rating.value} count={data.rating.count} copy={starCopy} />
        )}
        {footer && <div className="mt-auto">{footer}</div>}
      </div>
    </article>
  );
}
