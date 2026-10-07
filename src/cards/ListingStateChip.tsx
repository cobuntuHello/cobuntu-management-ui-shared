/**
 * The owner's view of where a listing stands, rendered inside the card footer.
 *
 * Ported from the community-app's ListingStateChip with next-intl removed: the
 * label per state is a prop (`copy`) with English defaults. Only LIVE / PENDING
 * / HIDDEN carry a distinguishing colour (the three states a seller acts on
 * differently); the rest stay muted. The dot shows for those three only.
 */

export type CardState = "LIVE" | "PENDING" | "HIDDEN" | "REJECTED" | "DRAFT" | "UNFINISHED";

const TONE: Record<CardState, string> = {
  LIVE: "#15803d",
  PENDING: "#a4630a",
  HIDDEN: "#40668c",
  REJECTED: "var(--mut, #6b7280)",
  DRAFT: "var(--mut, #6b7280)",
  UNFINISHED: "var(--mut, #6b7280)",
};

const DEFAULT_LABELS: Record<CardState, string> = {
  LIVE: "Live",
  PENDING: "In review",
  HIDDEN: "Off shelf",
  REJECTED: "Declined",
  DRAFT: "Unpublished",
  UNFINISHED: "Draft",
};

export function ListingStateChip({
  status,
  labels,
}: {
  status: CardState;
  labels?: Partial<Record<CardState, string>>;
}) {
  const tone = TONE[status];
  const label = labels?.[status] ?? DEFAULT_LABELS[status];
  const showDot = status === "LIVE" || status === "PENDING" || status === "HIDDEN";

  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: tone }}>
        {showDot && (
          <span
            aria-hidden
            style={{ width: 6, height: 6, borderRadius: "50%", background: tone, display: "inline-block" }}
          />
        )}
        {label}
      </span>
    </span>
  );
}
