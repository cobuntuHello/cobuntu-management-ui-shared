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
  /** "Design · UX" — caller joins category/sub-category. (product layout) */
  taxonomy?: string | null;
  /**
   * The date line shown ABOVE the title in the EVENT layout, already formatted
   * (e.g. "Oct 17 · 7:00 PM"). Mirrors the community-app EventCard, where the
   * date leads the card rather than a taxonomy. Ignored in the product layout.
   */
  dateLabel?: string | null;
  /** Caller-formatted, e.g. "€25.00" or the free label. */
  priceLabel?: string | null;
  /** Render the price in the positive/"free" tone. */
  priceFree?: boolean;
  /** A quiet line beside the price, e.g. "Digital product" / "Course". */
  meta?: string | null;
  /** Rating, when the surface shows it. */
  rating?: { value: number | string | null; count: number | null } | null;
  /*
   * The /marketplace card's anatomy (26 Nov 2026, "Request cards"): who sells
   * it, what it is, and the price with the members' price. Admin's request
   * queues and Manage Products draw the same card members see.
   */
  /** Plain text, two lines on the card. Null shows nothing; "" shows the fallback. */
  description?: string | null;
  /** Shown, muted, when `description` is "" (a listing with no description yet). */
  descriptionFallback?: string | null;
  /** Who sells it: avatars and names, plus a trailing note ("requested 9 days ago"). */
  people?: Array<{ name: string; avatarUrl?: string | null }> | null;
  peopleNote?: string | null;
  /** The full price, struck through, when `priceLabel` is the members' price. */
  listPriceLabel?: string | null;
}

/** A state said in words with a dot, never a pill (house rule): "Waiting for you", "Live". */
export type CardStateTone = "waiting" | "live" | "countered" | "paused" | "closed";
const STATE_TONE: Record<CardStateTone, { text: string; dot: string }> = {
  waiting: { text: "text-amber-700", dot: "bg-amber-500" },
  live: { text: "text-emerald-700", dot: "bg-emerald-500" },
  countered: { text: "text-indigo-700", dot: "bg-indigo-500" },
  paused: { text: "text-sky-700", dot: "bg-sky-500" },
  closed: { text: "text-zinc-500", dot: "bg-zinc-400" },
};

function initialOf(name: string): string {
  const m = name.match(/[\p{L}\p{N}]/u);
  return (m?.[0] ?? "?").toUpperCase();
}

export interface StorefrontCardProps {
  data: StorefrontCardData;
  /**
   * The card body layout. "product" (default) is the 16:10 image + taxonomy +
   * grey/brand price plate. "event" mirrors the community-app EventCard: a 4:3
   * image, the date line above the title, a heading-font title, and a GREEN
   * price (free and paid alike, as events show there).
   */
  variant?: "product" | "event";
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
  /** The card's state, in the price row: "Waiting for you", "Live". */
  state?: { label: string; tone: CardStateTone } | null;
  /** A line above the price row: the terms ("Asks for PBN-promoted · 10%"). */
  note?: ReactNode;
  starCopy?: Partial<StarRatingCopy>;
  className?: string;
}

export function StorefrontCard({
  data, variant = "product", href, ariaLabel, mediaTopLeft, mediaTopRight, mediaBottomLeft, footer, state, note, starCopy, className,
}: StorefrontCardProps) {
  const isEvent = variant === "event";
  if (!isEvent) {
    return <MarketCard data={data} href={href} ariaLabel={ariaLabel} mediaTopLeft={mediaTopLeft} mediaTopRight={mediaTopRight}
      mediaBottomLeft={mediaBottomLeft} footer={footer} state={state} note={note} starCopy={starCopy} className={className} />;
  }
  const base = `flex flex-col min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_10px_26px_-18px_rgba(24,24,27,0.22)] ${className ?? ""}`;
  /* When the whole card is the link: a pointer, no underline, and a hover lift so
     it reads as one big click target rather than a static tile. */
  const interactive =
    " cursor-pointer text-inherit no-underline transition-shadow duration-150 hover:shadow-[0_2px_4px_rgba(24,24,27,0.06),0_18px_38px_-18px_rgba(24,24,27,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";

  const inner = (
    <>
      <div className={`relative ${isEvent ? "aspect-[4/3]" : "aspect-[16/10]"}`}>
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
        {/* Event leads with the DATE (above the title); product leads with its
            taxonomy. Mirrors the two community-app cards. */}
        {isEvent
          ? data.dateLabel && (
              <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
                {data.dateLabel}
              </div>
            )
          : data.taxonomy && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {data.taxonomy}
              </div>
            )}
        <h3
          className={`m-0 font-semibold leading-tight text-zinc-900 ${
            isEvent ? "text-[17px] line-clamp-2" : "text-[15px] tracking-[-0.01em]"
          }`}
          style={isEvent ? { fontFamily: "var(--heading-font, inherit)" } : undefined}
        >
          {data.title}
        </h3>
        {(data.priceLabel || data.meta) && (
          <div className="flex items-center gap-2">
            {data.priceLabel && (
              isEvent ? (
                /* Events show the price GREEN (free and paid alike), matching
                   the community-app EventStatusBadge. */
                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-semibold tabular-nums bg-green-500/10 text-green-600">
                  {data.priceLabel}
                </span>
              ) : (
                /*
                 * Product/course price plate mirrors the storefront ProductCard:
                 * a FREE price is a neutral GREY plate, a paid price is a
                 * brand-tinted plate falling back to neutral ink when un-branded.
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
              )
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

/**
 * The /marketplace card (the community app's ProductCard), for the admin:
 * a 4:3 picture, what it is, the title over two lines, who sells it, two
 * lines of description, the terms, then the state and rating beside the
 * price. Admin's request queues and Manage Products draw this, so a reviewer
 * judges a listing as members will see it (26 Nov 2026, "Request cards").
 */
function MarketCard({
  data, href, ariaLabel, mediaTopLeft, mediaTopRight, mediaBottomLeft, footer, state, note, starCopy, className,
}: Omit<StorefrontCardProps, "variant">) {
  const base = `group flex flex-col min-w-0 overflow-hidden rounded-[14px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] ${className ?? ""}`;
  const interactive =
    " cursor-pointer text-inherit no-underline transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";
  const people = (data.people ?? []).filter((p) => p.name);
  const tone = state ? STATE_TONE[state.tone] : null;
  const inner = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: "rgba(128,128,128,0.04)" }}>
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <BannerPlaceholder seed={data.seed} className="absolute inset-0" />
        )}
        {mediaTopLeft && <div className="absolute left-2.5 top-2.5">{mediaTopLeft}</div>}
        {mediaTopRight && <div className="absolute right-2.5 top-2.5">{mediaTopRight}</div>}
        {mediaBottomLeft && <div className="absolute bottom-2.5 left-2.5">{mediaBottomLeft}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {data.taxonomy && <div className="text-[12px] text-zinc-500">{data.taxonomy}</div>}
        <h3 className="m-0 line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-zinc-900">{data.title}</h3>
        {people.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500">
            <span className="flex shrink-0 items-center">
              {people.slice(0, 3).map((p, i) => (
                <span key={`${p.name}-${i}`} className={`relative h-5 w-5 overflow-hidden rounded-full ring-2 ring-white ${i > 0 ? "-ml-1.5" : ""}`}>
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-zinc-900 text-[9px] font-bold text-white">{initialOf(p.name)}</span>
                  )}
                </span>
              ))}
            </span>
            <span className="min-w-0 truncate">
              <span className="font-medium text-zinc-700">{people.map((p) => p.name).join(", ")}</span>
              {data.peopleNote ? <span className="text-zinc-400"> · {data.peopleNote}</span> : null}
            </span>
          </div>
        )}
        {data.description != null && (
          data.description
            ? <p className="m-0 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">{data.description}</p>
            : data.descriptionFallback
              ? <p className="m-0 text-[13px] leading-relaxed text-zinc-400">{data.descriptionFallback}</p>
              : null
        )}
        {note && <div className="text-[12.5px] text-zinc-700">{note}</div>}
        <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-zinc-500">
            {state && tone && (
              <span className={`inline-flex shrink-0 items-center gap-1.5 font-semibold ${tone.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                {state.label}
              </span>
            )}
            {data.rating && <StarRating value={data.rating.value} count={data.rating.count} copy={starCopy} />}
          </span>
          {data.priceLabel && (
            <span
              className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-[13px] font-semibold tabular-nums ${
                data.priceFree ? "text-zinc-500" : "text-green-700"
              }`}
              style={{ background: data.priceFree ? "rgba(128,128,128,0.10)" : "rgba(34,197,94,0.10)" }}
            >
              {data.listPriceLabel && <span className="font-normal line-through opacity-60">{data.listPriceLabel}</span>}
              {data.priceLabel}
            </span>
          )}
        </div>
        {footer && <div className="pt-1.5">{footer}</div>}
      </div>
    </>
  );
  return href ? (
    <a href={href} aria-label={ariaLabel} className={`${base}${interactive}`}>{inner}</a>
  ) : (
    <article className={base}>{inner}</article>
  );
}
