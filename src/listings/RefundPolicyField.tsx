import { useSharedT } from "../i18n";
import { getSharedT } from "../i18n/core";
import * as React from "react";
import { ModalShell } from "../ui/ModalShell";

/**
 * The seller's refund choice: what comes back, and who may ask for it.
 *
 * ── Why it lives here ───────────────────────────────────────────────────────
 *
 * It existed as TWO files, one in event-management-ui and one in
 * product-management-ui, each with a comment claiming to be "ONE shared
 * control" and each naming the other as its mirror. Diffed, the markup was
 * identical and only the prose differed -- so they had not drifted yet, but
 * nothing stopped them, and the same setting on an event and on a product is
 * the same setting. Every consumer now renders this file.
 *
 * It is used in both places the policy is set: inline in the create wizard's
 * "Policies & access" step, and inside the manage page's refund modal.
 *
 * ── Three choices ────────────────────────────────────────────────────────
 *
 *   - Standard refunds        -> the platform default window (policy = null)
 *   - A cancellation schedule -> percentages by how late the cancellation is
 *   - No self-service refunds -> buyers contact the seller (window 0)
 *
 * ── The schedule is a modal now, not an inline expansion (2026-11-03) ───────
 *
 * Clicking "Cancellation schedule" used to push the rest of the section
 * down the page -- every other control on the step shifted the moment you
 * picked it, and the table it revealed was the one piece of this form that
 * looked nothing like the tier editor a seller had just used two steps
 * earlier. It now opens in the same ModalShell the tier editor uses: a
 * draft the seller edits and explicitly Saves or Cancels, never writing
 * through `onChange` until they commit. Once a schedule exists, the row
 * itself states it in one line (same wording `describeRefundBand` gives the
 * read-only house-policy statement) so the choice is legible without
 * reopening the modal, with a chevron marking it as something you can still
 * click into.
 *
 * The schedule's `days` means something different either side of the anchor,
 * which is why `anchor` is a required prop rather than a guess: on an EVENT it
 * counts down to the event date, on a PRODUCT or COURSE it counts up from
 * purchase. Same field, mirrored meaning, matching the backend.
 */

export type RefundBand = { days: number; pct: number };

export type RefundPolicyValue = {
  mode?: string | null;
  customBuyerWindowDays?: number | null;
  bands?: RefundBand[] | null;
} | null;

/** Which way the schedule's `days` are counted. Decided by what is being sold. */
export type RefundAnchor = "EVENT_START" | "PURCHASE";

/** True when the policy disables buyer self-service refunds. */
export function refundsDisabled(v: RefundPolicyValue): boolean {
  return !!v && v.customBuyerWindowDays === 0;
}

/** True when the policy publishes a cancellation schedule. */
export function hasRefundSchedule(v: RefundPolicyValue): boolean {
  return !!v && Array.isArray(v.bands) && v.bands.length > 0;
}

export const REFUND_STANDARD: RefundPolicyValue = null;
export const REFUND_NONE: RefundPolicyValue = { mode: "default", customBuyerWindowDays: 0 };

/**
 * The schedule a seller gets when they first open the modal with nothing
 * stored yet.
 *
 * Seeded with TEJÁ's published policy rather than an empty table, because an
 * empty table asks the seller to invent a format and the backend rejects most
 * of what they would invent (duplicate days, rising percentages, fractions).
 * A worked example they can edit is faster and teaches the shape.
 */
export const REFUND_SCHEDULE_DEFAULT: RefundBand[] = [
  { days: 14, pct: 75 },
  { days: 7, pct: 50 },
  { days: 0, pct: 0 },
];

const MAX_BANDS = 10;

type Choice = "standard" | "schedule" | "none";

function choiceOf(v: RefundPolicyValue): Choice {
  if (refundsDisabled(v)) return "none";
  if (hasRefundSchedule(v)) return "schedule";
  return "standard";
}

/** Bands in the order they actually apply, for a stable read. */
function ordered(bands: RefundBand[], anchor: RefundAnchor): RefundBand[] {
  return anchor === "EVENT_START"
    ? [...bands].sort((a, b) => b.days - a.days)
    : [...bands].sort((a, b) => a.days - b.days);
}

/**
 * The same rule the backend enforces, checked here so the seller is told at the
 * table rather than by a 400 after saving. Deliberately a MIRROR and not the
 * authority: validateRefundBands in @cobuntu/refund-math decides, and a
 * disagreement means this copy is stale.
 */
export function refundScheduleProblem(bands: RefundBand[], anchor: RefundAnchor): string | null {
  const tr = getSharedT("shared.managementUi.refundPolicyField");
  if (bands.length === 0) return tr("problemNoRows");
  if (bands.length > MAX_BANDS) return tr("problemTooMany", { max: MAX_BANDS });
  const seen = new Set<number>();
  for (const b of bands) {
    if (!Number.isInteger(b.days) || b.days < 0 || b.days > 365) {
      return tr("problemDays");
    }
    if (!Number.isInteger(b.pct) || b.pct < 0 || b.pct > 100) {
      return tr("problemPct");
    }
    if (seen.has(b.days)) return tr("problemDuplicate", { days: b.days });
    seen.add(b.days);
  }
  const sorted = ordered(bands, anchor);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].pct > sorted[i - 1].pct) {
      return anchor === "EVENT_START"
        ? tr("problemOrderEvent")
        : tr("problemOrderPurchase");
    }
  }
  return null;
}

export function RefundPolicyField({
  value,
  onChange,
  anchor,
}: {
  value: RefundPolicyValue;
  onChange: (next: RefundPolicyValue) => void;
  /** EVENT_START counts down to the event; PURCHASE counts up from the sale. */
  anchor: RefundAnchor;
}) {
  const tr = useSharedT("shared.managementUi.refundPolicyField");
  const choice = choiceOf(value);
  const bands = value?.bands && value.bands.length > 0 ? value.bands : REFUND_SCHEDULE_DEFAULT;

  const [modalOpen, setModalOpen] = React.useState(false);
  const [draftBands, setDraftBands] = React.useState<RefundBand[]>(bands);

  const openScheduleModal = () => {
    // Re-seed from whatever is live every time the modal opens, not whatever
    // was left in the draft from a previous open-then-cancel.
    setDraftBands(choice === "schedule" ? bands : REFUND_SCHEDULE_DEFAULT);
    setModalOpen(true);
  };

  const problem = refundScheduleProblem(draftBands, anchor);

  const saveSchedule = () => {
    if (problem) return;
    // A 0 window is "No self-service refunds", which choiceOf ranks above a
    // schedule: carried over from that choice, the seller's switch to a
    // schedule saved as None and the picker stayed on None.
    const { customBuyerWindowDays, ...rest }: NonNullable<RefundPolicyValue> = value ?? {};
    onChange({
      ...rest,
      ...(customBuyerWindowDays ? { customBuyerWindowDays } : {}),
      mode: value?.mode ?? "default",
      bands: draftBands,
    });
    setModalOpen(false);
  };

  const setChoice = (c: "standard" | "none") => {
    onChange(c === "standard" ? REFUND_STANDARD : REFUND_NONE);
  };

  const scheduleSummary = choice === "schedule"
    ? ordered(bands, anchor).map((b) => describeRefundBand(b, anchor)).join(" · ")
    : anchor === "EVENT_START"
      ? tr("scheduleSubtitleEvent")
      : tr("scheduleSubtitlePurchase");

  return (
    <div className="flex flex-col gap-2">
      <RefundOption
        selected={choice === "standard"}
        onClick={() => setChoice("standard")}
        title={tr("standardTitle")}
        /*
         * The CONSEQUENCE, in one line.
         *
         * This read "Buyers can self-refund within the usual window. You can
         * always refund a buyer directly." Two sentences, and the second is
         * true of BOTH options -- so half the text told you nothing about the
         * choice you were making. What differs between the two presets is
         * only whether the buyer can do it themselves.
         */
        subtitle={tr("standardSubtitle")}
      />
      <RefundOption
        selected={choice === "schedule"}
        onClick={openScheduleModal}
        title={tr("scheduleTitle")}
        subtitle={scheduleSummary}
        /* A clickable row, same as the tier list -- the chevron is the only
           hint this opens something rather than just selecting a radio. */
        trailing={<ChevronRightIcon />}
      />
      <RefundOption
        selected={choice === "none"}
        onClick={() => setChoice("none")}
        title={tr("noneTitle")}
        subtitle={tr("noneSubtitle")}
      />

      {modalOpen && (
        <ModalShell
          title={tr("scheduleTitle")}
          subtitle={anchor === "EVENT_START" ? tr("readRowsEvent") : tr("readRowsPurchase")}
          onClose={() => setModalOpen(false)}
          width="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100"
              >
                {tr("cancel")}
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                disabled={!!problem}
                className="cursor-pointer rounded-lg bg-zinc-900 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tr("save")}
              </button>
            </div>
          }
        >
          <ScheduleEditor bands={draftBands} anchor={anchor} onChange={setDraftBands} problem={problem} />
        </ModalShell>
      )}
    </div>
  );
}

function ScheduleEditor({
  bands,
  anchor,
  onChange,
  problem,
}: {
  bands: RefundBand[];
  anchor: RefundAnchor;
  onChange: (next: RefundBand[]) => void;
  problem: string | null;
}) {
  const tr = useSharedT("shared.managementUi.refundPolicyField");
  const update = (i: number, patch: Partial<RefundBand>) =>
    onChange(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const remove = (i: number) => onChange(bands.filter((_, j) => j !== i));

  const add = () => {
    // A new row starts BELOW the last one on both axes, so the schedule it
    // produces is valid the moment it appears rather than failing the
    // "later cannot return more" rule until the seller fixes it.
    const last = bands[bands.length - 1];
    const days = anchor === "EVENT_START"
      ? Math.max(0, (last?.days ?? 7) - 7)
      : (last?.days ?? 7) + 7;
    const pct = Math.max(0, (last?.pct ?? 50) - 25);
    onChange([...bands, { days, pct }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
        A bounded table, not a stack of bordered inputs: one outer frame, a
        header row naming what each column means (every row used to repeat
        "days before"/"% back" as loose inline text instead), and a divider
        between rows rather than a border around each one. The delete
        control is now an icon-only button so a row reads as data with an
        action attached, not a form field with a text button bolted on.
      */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          <span className="w-16">
            {anchor === "EVENT_START" ? tr("colDaysEvent") : tr("colDaysPurchase")}
          </span>
          <span className="w-16">{tr("colPct")}</span>
          <span className="flex-1" />
        </div>
        <div className="divide-y divide-zinc-100">
          {bands.map((b, i) => (
            <div key={i} className="group flex items-center gap-2 px-3 py-1.5">
              <div className="flex w-16 items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={b.days}
                  aria-label={anchor === "EVENT_START" ? tr("daysBeforeEventAria") : tr("daysAfterBuyingAria")}
                  onChange={(e) => update(i, { days: Math.trunc(Number(e.target.value)) })}
                  className="w-10 rounded-md border-0 bg-transparent px-1 py-1 text-[13px] tabular-nums text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <span className="text-[12px] text-zinc-400">{tr("colDaysUnit")}</span>
              </div>
              <div className="flex w-16 items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={b.pct}
                  aria-label={tr("percentAria")}
                  onChange={(e) => update(i, { pct: Math.trunc(Number(e.target.value)) })}
                  className="w-10 rounded-md border-0 bg-transparent px-1 py-1 text-[13px] tabular-nums text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <span className="text-[12px] text-zinc-400">{tr("colPctUnit")}</span>
              </div>
              <span className="flex-1" />
              {bands.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={tr("removeRowAria", { days: b.days })}
                  className="shrink-0 cursor-pointer rounded-md p-1 text-zinc-300 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
        </div>
        {bands.length < MAX_BANDS && (
          <button
            type="button"
            onClick={add}
            className="flex w-full cursor-pointer items-center gap-1.5 border-t border-zinc-100 px-3 py-1.5 text-left text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            <PlusIcon />
            {tr("addRow")}
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-[12px] text-red-600">
          {problem}
        </p>
      )}
      <p className="text-[12px] text-zinc-500">
        {anchor === "EVENT_START"
          ? tr("tailEvent")
          : tr("tailPurchase")}
      </p>
    </div>
  );
}

function RefundOption({
  selected,
  onClick,
  title,
  subtitle,
  trailing,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
        selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white hover:bg-zinc-50/50"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-zinc-900" : "border-zinc-300"
        }`}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-zinc-900">{title}</span>
        <span className="block text-[12px] text-zinc-500">{subtitle}</span>
      </span>
      {trailing && <span className="mt-0.5 shrink-0 text-zinc-300">{trailing}</span>}
    </button>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * One row of a schedule, as a sentence.
 *
 * Shared by the editor's helper text and the read-only statement so the two
 * cannot describe the same rows differently. The wording is the whole reason
 * this is a function rather than inline JSX: "cancel at least 14 days before"
 * and "ask within 7 days of buying" are opposite readings of the same number,
 * and getting that backwards tells a seller their policy does the reverse of
 * what it does.
 */
export function describeRefundBand(band: RefundBand, anchor: RefundAnchor): string {
  const tr = getSharedT("shared.managementUi.refundPolicyField");
  const amount = band.pct === 0 ? tr("bandNothingBack") : tr("bandPctBack", { pct: band.pct });
  if (anchor === "EVENT_START") {
    return band.days === 0
      ? tr("bandAnyTimeBefore", { amount })
      : tr("bandDaysBefore", { days: band.days, amount });
  }
  return tr("bandWithinDays", { days: band.days, amount });
}

/**
 * The house policy, stated rather than offered.
 *
 * Used where the seller does NOT get to choose: a venue publishes one set of
 * cancellation terms and every event booked there inherits them. Asking a host
 * hiring a room to pick their own refund rules is the wrong question, so the
 * wizard shows this instead of {@link RefundPolicyField}.
 *
 * Deliberately has no controls at all, not even disabled ones. A greyed-out
 * picker invites someone to hunt for the permission that would re-enable it;
 * a statement reads as settled, which it is.
 */
export function RefundScheduleStatement({
  bands,
  anchor,
  title: titleProp,
  note,
}: {
  bands: RefundBand[];
  anchor: RefundAnchor;
  /** Name the house if you have it, e.g. "TEJÁ's cancellation terms". */
  title?: string;
  /** Optional line underneath, for a "who to contact" or similar. */
  note?: string;
}) {
  const tr = useSharedT("shared.managementUi.refundPolicyField");
  const title = titleProp ?? tr("statementTitle");
  const rows = ordered(bands, anchor);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
      <p className="text-[13px] font-medium text-zinc-900">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((b, i) => (
          <li key={i} className="flex items-baseline gap-2 text-[12px] text-zinc-600">
            <span className="tabular-nums">{describeRefundBand(b, anchor)}</span>
          </li>
        ))}
      </ul>
      {/*
        The one thing a schedule does NOT cover, said plainly. A host reading
        "nothing back" on the last row will reasonably wonder what happens when
        the venue is the one that cancels, and the answer is the opposite.
      */}
      <p className="mt-2 text-[12px] text-zinc-500">
        {anchor === "EVENT_START"
          ? tr("venueCancelEvent")
          : tr("venueCancelPurchase")}
      </p>
      {note && <p className="mt-1 text-[12px] text-zinc-500">{note}</p>}
    </div>
  );
}
