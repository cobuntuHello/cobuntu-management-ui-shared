import type { ReactNode } from "react";

/**
 * One strip of figures instead of a grid of boxes.
 *
 * Four bordered boxes read as a table of cells; one hairline-divided strip reads
 * as figures. Cells wrap to two across on a phone.
 */
export function StatsStrip({ cells }: { cells: Array<{ label: string; value: string; sub?: ReactNode }> }) {
    return (
        <dl className={`grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white ${cells.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
            {cells.map((c, i) => (
                <div
                    key={c.label}
                    className={`flex flex-col gap-1.5 p-4 sm:p-5 ${i % 2 === 1 ? "border-l border-zinc-200/70" : ""} ${i >= 2 ? "border-t border-zinc-200/70 sm:border-t-0" : ""} ${i > 0 ? "sm:border-l sm:border-zinc-200/70" : ""}`}
                >
                    <dt className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">{c.label}</dt>
                    <dd className="m-0 text-[26px] font-bold leading-none tracking-tight tabular-nums text-zinc-900">{c.value}</dd>
                    {c.sub ? <div className="text-[12.5px] leading-snug text-zinc-500">{c.sub}</div> : null}
                </div>
            ))}
        </dl>
    );
}
