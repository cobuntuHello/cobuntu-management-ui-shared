import * as React from "react";

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
 * ── What it offers, and what it used to hide ────────────────────────────────
 *
 * Three choices, where there were two:
 *   - Standard refunds        -> the platform default window (policy = null)
 *   - A cancellation schedule -> percentages by how late the cancellation is
 *   - No self-service refunds -> buyers contact the seller (window 0)
 *
 * Plus the host lever, which this control previously declined to offer at all.
 * The old comment read: "`mode: 'extended'` is a host-side payout power, not a
 * buyer-facing policy, so it is not offered here." That left the product
 * telling sellers to use a setting that did not exist: eligibility returns
 * "Enable extended host refunds in the event settings to refund this sale",
 * the attendees table computes a disabled-policy state only extended clears,
 * and the activity log can render "switched the refund policy to Extended" --
 * a sentence the UI could never produce. It is a checkbox now.
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

/** True when the seller may refund past the standard window. */
export function extendedRefundsEnabled(v: RefundPolicyValue): boolean {
  return !!v && v.mode === "extended";
}

export const REFUND_STANDARD: RefundPolicyValue = null;
export const REFUND_NONE: RefundPolicyValue = { mode: "default", customBuyerWindowDays: 0 };

/**
 * The schedule a seller gets when they first pick "cancellation schedule".
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

/**
 * The same rule the backend enforces, checked here so the seller is told at the
 * table rather than by a 400 after saving. Deliberately a MIRROR and not the
 * authority: validateRefundBands in @cobuntu/refund-math decides, and a
 * disagreement means this copy is stale.
 */
export function refundScheduleProblem(bands: RefundBand[], anchor: RefundAnchor): string | null {
  if (bands.length === 0) return "Add at least one row, or choose standard refunds.";
  if (bands.length > MAX_BANDS) return `A schedule holds at most ${MAX_BANDS} rows.`;
  const seen = new Set<number>();
  for (const b of bands) {
    if (!Number.isInteger(b.days) || b.days < 0 || b.days > 365) {
      return "Each row needs a whole number of days, from 0 to 365.";
    }
    if (!Number.isInteger(b.pct) || b.pct < 0 || b.pct > 100) {
      return "Each row needs a whole percentage, from 0 to 100.";
    }
    if (seen.has(b.days)) return `Two rows both say ${b.days} days. Give each row its own cutoff.`;
    seen.add(b.days);
  }
  const sorted = anchor === "EVENT_START"
    ? [...bands].sort((a, b) => b.days - a.days)
    : [...bands].sort((a, b) => a.days - b.days);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].pct > sorted[i - 1].pct) {
      return anchor === "EVENT_START"
        ? "Cancelling later cannot return more. Check the order of your percentages."
        : "Refunding later cannot return more. Check the order of your percentages.";
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
  const choice = choiceOf(value);
  const bands = value?.bands && value.bands.length > 0 ? value.bands : REFUND_SCHEDULE_DEFAULT;
  const extended = extendedRefundsEnabled(value);

  /** Keeps the host lever when the buyer-facing choice changes, and vice versa. */
  const withMode = (next: RefundPolicyValue): RefundPolicyValue => {
    if (!extended) return next;
    return { ...(next ?? {}), mode: "extended" };
  };

  const setChoice = (c: Choice) => {
    if (c === "standard") onChange(withMode(REFUND_STANDARD));
    else if (c === "none") onChange(withMode(REFUND_NONE));
    else onChange(withMode({ mode: "default", bands }));
  };

  const setBands = (next: RefundBand[]) =>
    onChange(withMode({ ...(value ?? {}), mode: value?.mode ?? "default", bands: next }));

  const problem = choice === "schedule" ? refundScheduleProblem(bands, anchor) : null;

  return (
    <div className="flex flex-col gap-2">
      <RefundOption
        selected={choice === "standard"}
        onClick={() => setChoice("standard")}
        title="Standard refunds"
        /*
         * The CONSEQUENCE, in one line.
         *
         * This read "Buyers can self-refund within the usual window. You can
         * always refund a buyer directly." Two sentences, and the second is
         * true of BOTH options -- so half the text told you nothing about the
         * choice you were making. What differs between the two presets is
         * only whether the buyer can do it themselves.
         */
        subtitle="Buyers can refund themselves within the usual window, in full."
      />
      <RefundOption
        selected={choice === "schedule"}
        onClick={() => setChoice("schedule")}
        title="Cancellation schedule"
        subtitle={
          anchor === "EVENT_START"
            ? "Buyers get part of their money back, depending on how late they cancel."
            : "Buyers get part of their money back, depending on how long they have had it."
        }
      />
      {choice === "schedule" && (
        <ScheduleEditor bands={bands} anchor={anchor} onChange={setBands} problem={problem} />
      )}
      <RefundOption
        selected={choice === "none"}
        onClick={() => setChoice("none")}
        title="No self-service refunds"
        subtitle="Buyers ask you instead."
      />

      {/*
        The host lever, on its own axis.
        Separated by a rule rather than offered as a fourth option, because it
        answers a different question: the three above are what the BUYER can
        do, this is what the SELLER can still do afterwards.
      */}
      <label className="mt-1 flex cursor-pointer items-start gap-2.5 border-t border-zinc-100 pt-3">
        <input
          type="checkbox"
          id="refund-policy-extended"
          checked={extended}
          onChange={(e) => {
            const base = value ?? {};
            if (e.target.checked) onChange({ ...base, mode: "extended" });
            else if (choice === "standard") onChange(REFUND_STANDARD);
            else onChange({ ...base, mode: "default" });
          }}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-zinc-900"
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-zinc-900">
            Let me refund after the window closes
          </span>
          <span className="block text-[12px] text-zinc-500">
            You can still refund a sale once its usual window has passed, while the money is with
            Cobuntu. Once it has been paid out to you, refunds go through support.
          </span>
        </span>
      </label>
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
    <div className="ml-7 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <p className="text-[12px] text-zinc-500">
        {anchor === "EVENT_START"
          ? "Read each row as: cancel at least this many days before the event, get this much back."
          : "Read each row as: ask within this many days of buying, get this much back."}
      </p>
      <div className="flex flex-col gap-1.5">
        {bands.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={365}
              step={1}
              value={b.days}
              aria-label={anchor === "EVENT_START" ? "Days before the event" : "Days after buying"}
              onChange={(e) => update(i, { days: Math.trunc(Number(e.target.value)) })}
              className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[13px] tabular-nums text-zinc-900"
            />
            <span className="shrink-0 text-[12px] text-zinc-500">
              {anchor === "EVENT_START" ? "days before" : "days after"}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={b.pct}
              aria-label="Percent refunded"
              onChange={(e) => update(i, { pct: Math.trunc(Number(e.target.value)) })}
              className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[13px] tabular-nums text-zinc-900"
            />
            <span className="shrink-0 text-[12px] text-zinc-500">% back</span>
            {bands.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove the ${b.days}-day row`}
                className="ml-auto cursor-pointer rounded-md bg-zinc-100 px-2 py-1 text-[12px] text-zinc-600 transition-colors hover:bg-zinc-200"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {bands.length < MAX_BANDS && (
        <button
          type="button"
          onClick={add}
          className="self-start cursor-pointer rounded-md bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
        >
          Add a row
        </button>
      )}
      {problem && (
        <p role="alert" className="text-[12px] text-red-600">
          {problem}
        </p>
      )}
      <p className="text-[12px] text-zinc-500">
        {anchor === "EVENT_START"
          ? "Anyone cancelling later than your last row gets nothing back. If you cancel the event yourself, buyers are refunded in full."
          : "Anyone asking later than your last row gets nothing back. If you cancel the sale yourself, buyers are refunded in full."}
      </p>
    </div>
  );
}

function RefundOption({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
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
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-zinc-900">{title}</span>
        <span className="block text-[12px] text-zinc-500">{subtitle}</span>
      </span>
    </button>
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
  const amount = band.pct === 0 ? "nothing back" : `${band.pct}% back`;
  if (anchor === "EVENT_START") {
    return band.days === 0
      ? `Any time before it starts: ${amount}`
      : `${band.days} or more days before: ${amount}`;
  }
  return `Within ${band.days} day${band.days === 1 ? "" : "s"} of buying: ${amount}`;
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
  title = "Cancellation terms",
  note,
}: {
  bands: RefundBand[];
  anchor: RefundAnchor;
  /** Name the house if you have it, e.g. "TEJÁ's cancellation terms". */
  title?: string;
  /** Optional line underneath, for a "who to contact" or similar. */
  note?: string;
}) {
  const ordered = anchor === "EVENT_START"
    ? [...bands].sort((a, b) => b.days - a.days)
    : [...bands].sort((a, b) => a.days - b.days);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
      <p className="text-[13px] font-medium text-zinc-900">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {ordered.map((b, i) => (
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
          ? "If the event is cancelled by the venue, everyone is refunded in full."
          : "If the sale is cancelled by the seller, you are refunded in full."}
      </p>
      {note && <p className="mt-1 text-[12px] text-zinc-500">{note}</p>}
    </div>
  );
}
