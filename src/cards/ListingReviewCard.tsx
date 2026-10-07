import { StorefrontCard, type StorefrontCardData } from "./StorefrontCard";
import type { StarRatingCopy } from "./StarRating";

/**
 * A listing-REQUEST card for the admin review queues: the shared StorefrontCard
 * with the review overlay on top (design "Option A" — status and commission on
 * the image corners, requester and wait-time above a full-width Review action).
 *
 * The storefront card underneath is the same component the community-app renders,
 * so a reviewer sees the listing as members will. Everything here is copy-prop
 * driven and next-intl-free.
 */

export type ReviewStatusTone = "pending" | "approved" | "countered" | "paused" | "dismissed" | "ended";

const TONE: Record<ReviewStatusTone, string> = {
  pending: "text-amber-700 bg-amber-50/90",
  approved: "text-emerald-700 bg-emerald-50/90",
  countered: "text-indigo-700 bg-indigo-50/90",
  paused: "text-sky-700 bg-sky-50/90",
  dismissed: "text-zinc-500 bg-zinc-100/90",
  ended: "text-zinc-500 bg-zinc-100/90",
};

export interface ListingReviewCardKind {
  label: string;
  icon?: "course" | "event";
}

export interface ListingReviewCardProps {
  data: StorefrontCardData;
  /** A bottom-left image badge, e.g. "Course · 4 lessons" or "Oct 21 · Lisbon". */
  kind?: ListingReviewCardKind | null;
  status: { label: string; tone: ReviewStatusTone };
  /** Already-formatted, e.g. "10% commission" or "You offered 15%". Null hides it. */
  commission?: string | null;
  requester: { name: string; avatarUrl?: string | null };
  /** Already-formatted, e.g. "Requested 6h ago". */
  requestedAtLabel: string;
  /** The review action. An href renders a link; otherwise onReview renders a button. */
  reviewHref?: string;
  onReview?: () => void;
  reviewLabel?: string;
  /** Muted (ghost) action, for resolved rows where there is nothing to decide. */
  reviewGhost?: boolean;
  starCopy?: Partial<StarRatingCopy>;
  className?: string;
}

/** First letter or digit, skipping punctuation/emoji — never a stray glyph. */
function initial(name: string): string {
  return name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "?";
}

const KIND_ICON = {
  course: <path d="M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" />,
  event: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
};

export function ListingReviewCard({
  data, kind, status, commission, requester, requestedAtLabel,
  reviewHref, onReview, reviewLabel = "Review request", reviewGhost, starCopy, className,
}: ListingReviewCardProps) {
  const reviewClasses =
    "inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors " +
    (reviewGhost
      ? "border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
      : "bg-zinc-900 text-white hover:bg-zinc-800");

  const chevron = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );

  const footer = (
    <div className="flex flex-col gap-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-zinc-500">
        {requester.avatarUrl ? (
          <img src={requester.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9.5px] font-bold text-white">
            {initial(requester.name)}
          </span>
        )}
        <span className="truncate font-semibold text-zinc-800">{requester.name}</span>
        <span className="shrink-0 text-zinc-300">·</span>
        <span className="shrink-0 whitespace-nowrap text-zinc-400">{requestedAtLabel}</span>
      </div>
      <div className="h-px bg-zinc-100" />
      {reviewHref ? (
        /*
         * The WHOLE card is the link (see the StorefrontCard href below), so this
         * action is illustrative — a styled <span>, never a nested <a>/<button>
         * (interactive content cannot nest inside a link). aria-hidden because the
         * card's own aria-label already announces the action.
         */
        <span className={reviewClasses} aria-hidden="true">{reviewLabel}{chevron}</span>
      ) : (
        <button type="button" onClick={onReview} className={reviewClasses}>{reviewLabel}{chevron}</button>
      )}
    </div>
  );

  const statusPill = (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${TONE[status.tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status.label}
    </span>
  );

  const commissionChip = commission ? (
    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 backdrop-blur-sm">
      {commission}
    </span>
  ) : undefined;

  const kindBadge = kind ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
      {kind.icon && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {KIND_ICON[kind.icon]}
        </svg>
      )}
      {kind.label}
    </span>
  ) : undefined;

  return (
    <StorefrontCard
      data={data}
      href={reviewHref}
      ariaLabel={reviewHref ? `${reviewLabel}: ${data.title}` : undefined}
      className={className}
      starCopy={starCopy}
      mediaTopLeft={statusPill}
      mediaTopRight={commissionChip}
      mediaBottomLeft={kindBadge}
      footer={footer}
    />
  );
}
