import type { ReactNode } from "react";

/**
 * The one empty placeholder these pages use.
 *
 * ── Why a component and not another dashed box ──────────────────────────────
 *
 * Every tab had grown its own: a dashed border here, a centred paragraph
 * there, a bare "No hosts assigned" with nothing after it. They were written
 * one at a time and it showed -- moving between tabs, an empty page changed
 * shape, which reads as parts of the product built by different people rather
 * than as one page with nothing in it yet.
 *
 * ── What a good one says ────────────────────────────────────────────────────
 *
 * Three things, in this order:
 *
 *   1. WHAT IS EMPTY, as a fact and not an apology. "Nothing has sold yet",
 *      not "No data available".
 *   2. WHY IT MIGHT BE, or what will fill it. This is the line that stops an
 *      empty tab reading as a broken one -- "sales and refunds show up here"
 *      tells a seller the tab works and their item simply has no history.
 *   3. Optionally, THE ACTION that fills it. Only where the reader can
 *      actually do it: an empty ledger has no action, because you cannot make
 *      someone buy.
 *
 * The icon is a thin outline, drawn in the same weight as the ones already in
 * the activity and collaborator tabs, so this reads as those states unified
 * rather than as a fourth style.
 */
export function EmptyState({
    icon,
    title,
    body,
    action,
    bordered = true,
}: {
    /** A 24x24 outline glyph. Defaults to a neutral one. */
    icon?: ReactNode;
    title: string;
    /** What will fill it, or why it is empty. Keep to one sentence. */
    body?: string;
    /** Only where the reader can actually do something about it. */
    action?: ReactNode;
    /**
     * Some hosts already sit inside a bordered card. A second border around
     * this one draws a box in a box, so they turn it off.
     */
    bordered?: boolean;
}) {
    return (
        <div
            className={
                bordered
                    ? "rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center"
                    : "px-6 py-10 text-center"
            }
        >
            <span className="mx-auto mb-3 block w-fit text-zinc-300" aria-hidden="true">
                {icon ?? <DefaultIcon />}
            </span>
            <p className="text-[14px] font-semibold text-zinc-900">{title}</p>
            {body && (
                <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-zinc-500">
                    {body}
                </p>
            )}
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
    );
}

function DefaultIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
        </svg>
    );
}

/** A ledger with nothing in it: rows on a page, none filled. */
export function LedgerIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M8 8h8M8 12h8M8 16h4" />
        </svg>
    );
}

/** Nowhere selling it: a shopfront. */
export function ShelfIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 9h18l-1.5-4.5A1 1 0 0 0 18.55 4H5.45a1 1 0 0 0-.95.5L3 9Z" />
            <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
            <path d="M9 20v-6h6v6" />
        </svg>
    );
}
