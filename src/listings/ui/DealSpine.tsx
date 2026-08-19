import { useState } from "react";
import { Card } from "./primitives";

/**
 * The commission, drawn as the thing it is: a cut of every sale, split.
 *
 * ── Why the bar is the card's edge ──────────────────────────────────────────
 *
 * From the MVP, whose note is worth keeping because it records two rejected
 * attempts: every earlier version had the split floating in the middle of an
 * otherwise empty card — a lonely sliver with acres of white around it, which
 * read as a widget someone forgot to finish. Centring it made that worse,
 * because then it had margins on both sides and belonged to nothing.
 *
 * It is the card's spine — flush left, full height, no padding between it and
 * the border. The proportion is legible because the bar is tall and narrow,
 * and it stops being a floating object because it IS the edge of the thing it
 * describes. Labels live inside the bands; nothing sits beside it explaining
 * it.
 *
 * ── What the bands actually show ────────────────────────────────────────────
 *
 * Cobuntu's share is a slice OF the commission, not of the sale. So the bar
 * always totals the commission whatever the rate is: the height stays put
 * while the rate moves, and only the ratio inside it changes. Showing it
 * against the sale instead would make the community's band shrink every time
 * they lowered their own rate, which is the opposite of what happened.
 */
export function DealSpine({
    rate,
    communityName,
    platformShare = 10,
    locked = false,
    onCounter,
    counterLabel = "Suggest a different cut",
    t,
}: {
    /** The agreed or proposed rate, as a percent of the sale. */
    rate: number | null;
    communityName: string;
    /** Cobuntu's cut OF the commission, as a percent. */
    platformShare?: number;
    /** Agreed and live: there is nothing left to move. */
    locked?: boolean;
    onCounter?: (rate: number) => void;
    counterLabel?: string;
    t?: (key: string, vars?: Record<string, unknown>) => string;
}) {
    const [countering, setCountering] = useState(false);
    const [draft, setDraft] = useState(rate ?? 0);

    const shown = rate ?? 0;
    const community = 100 - platformShare;
    const label = (k: string, fallback: string) => (t ? t(k) : fallback);

    return (
        <Card className="overflow-hidden text-[var(--ink)]">
            <div className="flex min-h-[188px]">
                {/*
                  * NO BANDS WHEN THERE IS NOTHING TO SPLIT.
                  *
                  * The bands total the COMMISSION, so at 0% they drew a
                  * confident two-colour chart dividing zero euros between two
                  * parties -- a large graphic of no money at all. Self-listing
                  * is the common zero (a community carrying its own product
                  * takes no cut), so this was not an edge case: every one of
                  * those pages showed it.
                  *
                  * A split only exists when there is something to split.
                  */}
                {rate !== null && rate > 0 && (
                <div className="flex w-[72px] shrink-0 flex-col">
                    <Band pct={community} value={`${community}%`} label={communityName} className="bg-[var(--b-comm)] text-white" />
                    {/*
                      * "Platform", not "Cobuntu", when the community is also
                      * called Cobuntu: two bands reading COBUNTU says nothing
                      * about who gets what. Everywhere else the platform's own
                      * name is the clearer label.
                      */}
                    <Band
                        pct={platformShare}
                        value={`${platformShare}%`}
                        label={communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu"}
                        className="bg-[var(--b-cob)] text-white"
                    />
                </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                            {label("spineHeading", `${communityName}'s cut`)}
                        </p>
                        <p className="tabular mt-1 text-[40px] font-bold leading-none tracking-tighter" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {rate == null ? "—" : `${shown}%`}
                        </p>
                        <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">
                            {rate == null
                                ? label("spineNotAgreed", "Nothing agreed yet")
                                : rate === 0
                                    ? label("spineZero", "No commission on this listing. Nothing to split.")
                                    : label("spineSub", "of every sale, split as shown")}
                        </p>
                    </div>

                    {!locked && onCounter && (
                        countering ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    autoFocus
                                    type="number"
                                    min={0}
                                    max={40}
                                    value={draft}
                                    onChange={(e) => setDraft(Number(e.target.value))}
                                    className="tabular w-[72px] rounded-lg border border-zinc-200 px-2.5 py-2 text-[16px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                />
                                <button
                                    type="button"
                                    onClick={() => { onCounter(draft); setCountering(false); }}
                                    className="rounded-lg bg-[var(--commit)] px-4 py-2 text-[13px] font-semibold text-white cursor-pointer hover:opacity-90"
                                >
                                    {label("spineOffer", "Offer")} {draft}%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCountering(false)}
                                    className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ink-2)] cursor-pointer hover:bg-[var(--sunk)]"
                                >
                                    {label("counterCancel", "Cancel")}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => { setDraft(shown); setCountering(true); }}
                                className="w-full rounded-lg border border-[var(--line)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-2)] cursor-pointer transition-colors hover:bg-[var(--sunk)]"
                            >
                                {counterLabel}
                            </button>
                        )
                    )}
                </div>
            </div>
        </Card>
    );
}

function Band({ pct, value, label, className }: { pct: number; value: string; label: string; className: string }) {
    return (
        <div
            /* A floor, so the smaller share never becomes an unlabelable sliver. */
            style={{ flexGrow: Math.max(pct, 26), flexBasis: 0 }}
            className={`flex flex-col items-center justify-center gap-0.5 transition-[flex-grow] duration-500 ease-[var(--ease)] ${className}`}
        >
            <span className="text-[15px] font-bold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-85 px-1 text-center leading-tight">{label}</span>
        </div>
    );
}
