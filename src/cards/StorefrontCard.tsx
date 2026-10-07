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
  /**
   * Makes the WHOLE card a link to this href (the card root becomes an <a>, with
   * a hover lift). Any footer action is then illustrative — render it as plain
   * markup, never a nested <a>/<button>, since interactive content can't nest in
   * a link. Omit for a static card.
   */
  href?: string;
  /** Accessible label for the whole-card link (e.g. "Review request: <title>"). */
  ariaLabel?: string;
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
  data, href, ariaLabel, mediaTopLeft, mediaTopRight, mediaBottomLeft, footer, starCopy, className,
}: StorefrontCardProps) {
  const base = `flex flex-col min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_10px_26px_-18px_rgba(24,24,27,0.22)] ${className ?? ""}`;
  /* When the whole card is the link: a pointer, no underline, and a hover lift so
     it reads as one big click target rather than a static tile. */
  const interactive =
    " cursor-pointer text-inherit no-underline transition-shadow duration-150 hover:shadow-[0_2px_4px_rgba(24,24,27,0.06),0_18px_38px_-18px_rgba(24,24,27,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";

  const inner = (
    <>
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
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {data.taxonomy}
          </div>
        )}
        <h3 className="m-0 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-zinc-900">
          {data.title}
        </h3>
        {(data.priceLabel || data.meta) && (
          <div className="flex items-center gap-2">
            {data.priceLabel && (
              /*
               * Price plate mirrors the community-app storefront ProductCard
               * exactly: a FREE price is a neutral GREY plate (not green — green
               * is the event card's own treatment there), a paid price is a
               * brand-tinted plate falling back to neutral ink when no brand var
               * is set (the admin review queue runs un-branded). Keeping these
               * byte-for-byte the storefront's means a reviewer sees the price
               * exactly as a member will.
               */
              <span
                className={`shrink-0 whitespace-nowrap rounded-lg tabular-nums ${
                  data.priceFree
                    ? "px-1.5 py-0.5 text-[12.5px] font-semibold"
                    : "px-2 py-0.5 text-[14px] font-bold"
                }`}
                style={
                  data.priceFree
                    ? { background: "rgba(128,128,128,0.10)", color: "var(--mut, #6b7280)" }
                    : {
                        background: "color-mix(in srgb, var(--brand-color, #18181b) 12%, transparent)",
                        color: "var(--text-color, #18181b)",
                      }
                }
              >
                {data.priceLabel}
              </span>
            )}
            {data.meta && <span className="text-[12px] text-zinc-400">{data.meta}</span>}
          </div>
        )}
        {data.rating && (
          <StarRating value={data.rating.value} count={data.rating.count} copy={starCopy} />
        )}
        {footer && <div className="mt-auto">{footer}</div>}
      </div>
    </>
  );

  return href ? (
    <a href={href} aria-label={ariaLabel} className={`${base}${interactive}`}>
      {inner}
    </a>
  ) : (
    <article className={base}>{inner}</article>
  );
}
