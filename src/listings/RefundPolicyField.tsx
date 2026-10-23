import * as React from "react";

/**
 * The seller's refund choice: two presets, one control.
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
 * Two presets, not the full mode/window matrix the backend supports:
 *   - Standard refunds        → the platform default window (policy = null)
 *   - No self-service refunds  → buyers contact the host (customBuyerWindowDays: 0)
 *
 * `mode: 'extended'` is a host-side payout power, not a buyer-facing policy, so it
 * is not offered here; a preset writes mode 'default'.
 */
export type RefundPolicyValue = { mode?: string | null; customBuyerWindowDays?: number | null } | null;

/** True when the policy disables buyer self-service refunds. */
export function refundsDisabled(v: RefundPolicyValue): boolean {
  return !!v && v.customBuyerWindowDays === 0;
}

export const REFUND_STANDARD: RefundPolicyValue = null;
export const REFUND_NONE: RefundPolicyValue = { mode: "default", customBuyerWindowDays: 0 };

export function RefundPolicyField({
  value,
  onChange,
}: {
  value: RefundPolicyValue;
  onChange: (next: RefundPolicyValue) => void;
}) {
  const off = refundsDisabled(value);
  return (
    <div className="flex flex-col gap-2">
      <RefundOption
        selected={!off}
        onClick={() => onChange(REFUND_STANDARD)}
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
        subtitle="Buyers can refund themselves within the usual window."
      />
      <RefundOption
        selected={off}
        onClick={() => onChange(REFUND_NONE)}
        title="No self-service refunds"
        subtitle="Buyers ask you instead."
      />
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
