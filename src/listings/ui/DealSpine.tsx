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
 * ── The bar shows a whole sale, and that is the second attempt ──────────────
 *
 * The first drew the split OF THE COMMISSION -- Cobuntu's cut is a slice of the
 * commission, not of the sale -- which was accurate and useless at the most
 * common rate there is. At 0% it drew a confident two-colour chart dividing
 * zero euros between two parties. Removing it there left an empty card with a
 * number floating in it, which was worse: the page lost the one graphic that
 * made the rate feel like a share of something.
 *
 * So the bar now divides ONE SALE: what the seller keeps, what the community
 * takes, and Cobuntu's slice of that. Every rate has an honest picture,
 * including zero -- where it is one full band and reads "the seller keeps all
 * of it", which is exactly what 0% means and what the empty card failed to say.
 */
export function DealSpine({
    rate,
    communityName,
    platformShare = 10,
    sellerFee = null,
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
    /**
     * The OTHER deductions, from GET /api/config/fees.
     *
     * Rates only, and from the endpoint that publishes them rather than from a
     * copy kept here: the fee file is the single definition and this page must
     * not become a second one. Absent means the caller could not read them, and
     * the bar then shows only what was agreed rather than inventing the rest.
     */
    sellerFee?: {
        /** Cobuntu's fee on the seller's own share, as a fraction (0.04). */
        rate: number;
        /** The fixed part, in the smallest unit (30 = EUR 0.30). */
        fixed: number;
        currency?: string;
    } | null;
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

    /*
     * One sale, divided. `rate` is the community's cut of the sale; Cobuntu
     * takes `platformShare` percent OF that cut, so its slice is a fraction of
     * a fraction and stays small on purpose -- drawing it against the sale is
     * the only way that stays true as the rate moves.
     */
    const cobuntuOfCommission = (shown * platformShare) / 100;
    const communityOfSale = shown - cobuntuOfCommission;
    /*
     * WHAT THE SELLER ACTUALLY KEEPS, which is not "everything the community
     * did not take".
     *
     * Cobuntu charges the seller a fee on their OWN share on top of its slice
     * of the commission, so a 0% listing was drawing "Seller 100%" -- a
     * confident, wrong number on the most common listing there is. That fee is
     * all-in: Stripe's processing comes out of it, which is why Stripe is named
     * below rather than drawn as a fourth band that would double-count.
     */
    const sellerShare = 100 - shown;
    const cobuntuOfSeller = sellerFee ? sellerShare * sellerFee.rate : 0;
    const platformOfSale = cobuntuOfCommission + cobuntuOfSeller;
    const sellerOfSale = sellerShare - cobuntuOfSeller;

    return (
        <Card className="overflow-hidden text-[var(--ink)]">
            <div className="flex flex-col">
                <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                            {label("spineHeading", `${communityName}'s cut`)}
                        </p>
                        <p className="tabular mt-1 text-[32px] font-bold leading-none tracking-tighter sm:text-[40px]" style={{ fontVariantNumeric: "tabular-nums" }}>
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

                    {/*
                      * ONE SALE, DIVIDED -- drawn for every rate including zero,
                      * where it is a single full band saying the seller keeps
                      * all of it. That is what 0% means, and it is what the
                      * empty card this replaced failed to say.
                      */}
                    {rate !== null && (
                        <div>
                            <div
                                className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--sunk)]"
                                role="img"
                                aria-label={label("spineBarAria", `Seller keeps ${sellerOfSale}% of each sale`)}
                            >
                                <span
                                    className="h-full bg-[var(--b-cob)] transition-[width] duration-500"
                                    style={{ width: `${sellerOfSale}%` }}
                                />
                                {communityOfSale > 0 && (
                                    <span
                                        className="h-full bg-[var(--b-comm)] transition-[width] duration-500"
                                        style={{ width: `${communityOfSale}%` }}
                                    />
                                )}
                                {platformOfSale > 0 && (
                                    <span
                                        className="h-full bg-[var(--ink-3)] transition-[width] duration-500"
                                        style={{ width: `${platformOfSale}%` }}
                                    />
                                )}
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--ink-3)]">
                                <Key className="bg-[var(--b-cob)]"
                                     text={`${label("spineKeySeller", "Seller")} ${round(sellerOfSale)}%`} />
                                {communityOfSale > 0 && (
                                    <Key className="bg-[var(--b-comm)]" text={`${communityName} ${round(communityOfSale)}%`} />
                                )}
                                {platformOfSale > 0 && (
                                    /*
                                      * "Platform" when the community is itself
                                      * called Cobuntu: two keys reading COBUNTU
                                      * say nothing about who gets what, and this
                                      * is the one card where that is the point.
                                      */
                                    <Key
                                        className="bg-[var(--ink-3)]"
                                        text={`${communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu"} ${round(platformOfSale)}%`}
                                    />
                                )}
                            </div>

                            {sellerFee && (
                                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                    {label("spineFixedFee", `Plus ${money(sellerFee.fixed, sellerFee.currency)} per sale to Cobuntu. Stripe's processing comes out of Cobuntu's fee, so it is not a separate deduction.`)}
                                </p>
                            )}
                        </div>
                    )}

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

/** The smallest unit, as money. Amounts here are cents, as everywhere. */
function money(amount: number, currency = "EUR"): string {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100);
}

/** One percent, rounded for display without pretending to precision it lacks. */
function round(n: number): number {
    return Math.round(n * 10) / 10;
}

function Key({ className, text }: { className: string; text: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
            {text}
        </span>
    );
}
