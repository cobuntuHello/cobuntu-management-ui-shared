"use client";

/**
 * Edit an item's value lines: what the buyer gets, each line with a value
 * (PBN feedback L2; backend docs/features/value-lines.md).
 *
 * Shared by the product/course package and the event package, like
 * RefundPolicyField, so products, courses and events edit them the same way.
 *
 * The item page shows them as a value stack: the lines, "Total value" (their
 * sum), then the member discount computed from the item's REAL member pricing.
 * So the seller only types lines; nothing here sets a discount.
 *
 * A row with a label and no amount (or the reverse) blocks Save with a note
 * instead of being dropped silently. Fully empty rows are ignored.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ModalShell } from "../ui/ModalShell";
import {
    type ValueLine, MAX_VALUE_LINES, MAX_VALUE_LINE_LABEL,
    amountToCents, centsToAmount, sumValueLines,
} from "../lib/valueLines";
import { formatMoney } from "../overview/format";

type Row = { label: string; amount: string };

export interface ValueLinesModalProps {
    initial: ValueLine[] | null | undefined;
    /** The item's currency; amounts are typed in its whole units. */
    currency: string;
    /** Resolve to close. Throw to keep the modal open (the caller shows the error). */
    onSave: (lines: ValueLine[]) => void | Promise<void>;
    onClose: () => void;
}

export function ValueLinesModal({ initial, currency, onSave, onClose }: ValueLinesModalProps) {
    const [rows, setRows] = useState<Row[]>(() => {
        const seeded = (initial ?? []).map(l => ({ label: l.label, amount: centsToAmount(l.value) }));
        return seeded.length > 0 ? seeded : [{ label: "", amount: "" }];
    });
    const [saving, setSaving] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    const filled = rows.filter(r => r.label.trim() || r.amount.trim());
    const parsed = filled.map(r => ({ label: r.label.trim(), value: amountToCents(r.amount) }));
    const complete = parsed.filter((l): l is ValueLine => !!l.label && l.value !== null);
    const total = sumValueLines(complete);
    const code = (currency || "EUR").toUpperCase();

    function update(i: number, patch: Partial<Row>) {
        setProblem(null);
        setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    }

    async function save() {
        const bad = parsed.findIndex(l => !l.label || l.value === null);
        if (bad >= 0) {
            setProblem(`Line ${bad + 1} needs both a description and an amount.`);
            return;
        }
        setSaving(true);
        try {
            await onSave(complete);
        } catch {
            setSaving(false);
        }
    }

    return (
        <ModalShell
            onClose={onClose}
            width="md"
            title="What buyers get"
            subtitle="List what's included and what each part is worth. Buyers see the total value, then the member discount if your listing has a member price."
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-zinc-500 rounded-lg hover:bg-zinc-100 cursor-pointer">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => { void save(); }}
                        disabled={saving}
                        className="px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 cursor-pointer"
                        style={{ background: "var(--brand-color, #18181b)" }}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            }
        >
            <div className="space-y-2" data-testid="value-lines-rows">
                {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <input
                            value={row.label}
                            onChange={e => update(i, { label: e.target.value.slice(0, MAX_VALUE_LINE_LABEL) })}
                            placeholder="e.g. Networking brunch"
                            aria-label={`Line ${i + 1} description`}
                            className="flex-1 min-w-0 h-10 rounded-lg border border-zinc-200 px-3 text-[14px] outline-none focus:border-zinc-400"
                        />
                        <div className="relative w-[120px] shrink-0">
                            <input
                                value={row.amount}
                                onChange={e => update(i, { amount: e.target.value })}
                                inputMode="decimal"
                                placeholder="0"
                                aria-label={`Line ${i + 1} value`}
                                className="w-full h-10 rounded-lg border border-zinc-200 pl-3 pr-12 text-[14px] text-right tabular-nums outline-none focus:border-zinc-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-400">{code}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setProblem(null); setRows(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ label: "", amount: "" }])); }}
                            aria-label={`Remove line ${i + 1}`}
                            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => setRows(prev => [...prev, { label: "", amount: "" }])}
                disabled={rows.length >= MAX_VALUE_LINES}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 cursor-pointer"
            >
                <Plus className="h-3.5 w-3.5" /> Add line
            </button>

            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[14px]">
                <span className="text-zinc-500">Total value</span>
                <span className="font-semibold text-zinc-900 tabular-nums" data-testid="value-lines-total">{formatMoney(total, code)}</span>
            </div>

            {problem && <p className="mt-3 text-[12.5px] text-red-600" role="alert">{problem}</p>}
        </ModalShell>
    );
}
