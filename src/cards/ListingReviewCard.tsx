import { StorefrontCard, type StorefrontCardData, type CardStateTone } from "./StorefrontCard";
import type { StarRatingCopy } from "./StarRating";

/**
 * A listing-REQUEST card for the admin review queues: the shared StorefrontCard
 * (the /marketplace card's anatomy) with the reviewer's layer: who asks and
 * when, the terms as a sentence, the state in words, and a full-width Review
 * action. Until 26 Nov 2026 the status and commission sat on the picture as
 * pills ("Option A"); the house rule is no pastel status pills.
 *
 * The storefront card underneath is the same component the community-app renders,
 * so a reviewer sees the listing as members will. Everything here is copy-prop
 * driven and next-intl-free.
 */

export type ReviewStatusTone = "pending" | "approved" | "countered" | "paused" | "dismissed" | "ended";


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
  /** Card body layout — "event" uses the EventCard look (4:3, date-above-title,
      green price). Defaults to "product". */
  variant?: "product" | "event";
  starCopy?: Partial<StarRatingCopy>;
  className?: string;
}

export function ListingReviewCard({
  data, kind, status, commission, requester, requestedAtLabel,
  reviewHref, onReview, reviewLabel = "Review request", reviewGhost, variant = "product", starCopy, className,
}: ListingReviewCardProps) {
  /*
   * The /marketplace card, with the reviewer's layer (26 Nov 2026, "Request
   * cards"): who asks and when in the sellers line, the terms as a sentence,
   * the state in words beside the price, and the review action. No pills on
   * the picture: a pastel status pill and a commission chip used to sit there.
   */
  const reviewClasses =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold transition-colors " +
    (reviewGhost
      ? "border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
      : "bg-zinc-900 text-white hover:bg-zinc-800");
  const arrow = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
  const action = reviewHref
    /* The WHOLE card is the link, so this is illustrative markup, never a
       nested <a>/<button>; the card's aria-label announces the action. */
    ? <span className={reviewClasses} aria-hidden="true">{reviewLabel}{arrow}</span>
    : <button type="button" onClick={onReview} className={reviewClasses}>{reviewLabel}{arrow}</button>;

  const open = status.tone === "pending" || status.tone === "countered";
  const terms = commission ? (
    <span>{open ? "Asks for " : "On "}<b className="font-semibold text-zinc-900">{commission}</b></span>
  ) : undefined;

  const card: StorefrontCardData = {
    ...data,
    // "Course · Design": the kind leads the taxonomy line.
    taxonomy: kind ? [kind.label, data.taxonomy].filter(Boolean).join(" · ") : data.taxonomy,
    people: data.people && data.people.length > 0 ? data.people : [{ name: requester.name, avatarUrl: requester.avatarUrl ?? null }],
    peopleNote: data.peopleNote ?? lowerFirst(requestedAtLabel),
  };

  return (
    <StorefrontCard
      data={card}
      variant={variant}
      href={reviewHref}
      ariaLabel={reviewHref ? `${reviewLabel}: ${data.title}` : undefined}
      className={className}
      starCopy={starCopy}
      state={{ label: status.label, tone: STATE_OF[status.tone] }}
      note={terms}
      footer={action}
    />
  );
}

/** "Requested 6h ago" reads "requested 6h ago" after a name. */
function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

const STATE_OF: Record<ReviewStatusTone, CardStateTone> = {
  pending: "waiting",
  approved: "live",
  countered: "countered",
  paused: "paused",
  dismissed: "closed",
  ended: "closed",
};
