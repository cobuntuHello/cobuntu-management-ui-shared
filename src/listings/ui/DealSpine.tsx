import { useState } from "react";
import { Card } from "./primitives";

/**
 * One sale, divided into the three shares that leave it.
 *
 * `rate` is the community's cut of the sale; Cobuntu takes `platformShare`
 * percent OF that cut (a fraction of a fraction, so it stays small as the rate
 * moves). On top of that Cobuntu charges the seller a fee on their OWN share,
 * which is why the seller does not simply keep "everything the community did
 * not take" -- a 0% listing is not "seller 100%". Stripe's processing comes out
 * of Cobuntu's fee, so it is named, not drawn as a fourth share that would
 * double-count.
 *
 * Shared so the spine and the leader's package options split a sale the exact
 * same way; one of them doing it differently is a number that lies.
 */
export function saleSplit(
    rate: number,
    platformShare: number,
    sellerFee: { rate: number; fixed: number; currency?: string } | null,
): { sellerOfSale: number; communityOfSale: number; platformOfSale: number } {
    const cobuntuOfCommission = (rate * platformShare) / 100;
    const communityOfSale = rate - cobuntuOfCommission;
    const sellerShare = 100 - rate;
    const cobuntuOfSeller = sellerFee ? sellerShare * sellerFee.rate : 0;
    return {
        sellerOfSale: sellerShare - cobuntuOfSeller,
        communityOfSale,
        platformOfSale: cobuntuOfCommission + cobuntuOfSeller,
    };
}

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
    stripeRate,
    stripeFixed,
    samplePrice,
    sampleCurrency,
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
    /**
     * Stripe's card-processing estimate, from the same /api/config/fees. Given,
     * the euro breakdown pulls Stripe out as its OWN line instead of leaving it
     * folded inside Cobuntu's fee -- the transparency the member asked for. Rate
     * is a fraction (0.015); fixed is the smallest unit (25 = EUR 0.25).
     */
    stripeRate?: number;
    stripeFixed?: number;
    /**
     * A concrete ticket price (MAJOR units) to work a real example against.
     * Percentages cannot add up once Stripe and the seller fee both carry a flat
     * per-sale charge, so the full four-way split (host / community / Cobuntu /
     * Stripe) is shown in euros on this price, where every cent sums exactly.
     * Absent, the card falls back to the old percentage-only split.
     */
    samplePrice?: number;
    sampleCurrency?: string;
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
     * `label` passes NO variables, which is fine for the static strings and was
     * silently wrong for this one: the fixed-fee line shipped reading "Plus
     * {amount} per sale" on a live page. A template needs its vars, so it gets
     * its own helper rather than sharing one that cannot carry them.
     */
    const say = (k: string, vars: Record<string, unknown>, fallback: string) =>
        (t ? t(k, vars) : fallback);

    const { sellerOfSale, communityOfSale, platformOfSale } = saleSplit(shown, platformShare, sellerFee);

    /*
     * The commission, split into what the community KEEPS and Cobuntu's share
     * OF it. This is the "8% vs 7.6%" the member flagged: the headline is the
     * rate charged (8%), the community nets that minus Cobuntu's platformShare%
     * OF the commission (5% of it = 0.4 points, NOT 5 points — which would be
     * the 3% nobody actually pays).
     */
    const cobuntuOfCommission = (shown * platformShare) / 100;
    const communityNetCommission = shown - cobuntuOfCommission;
    const naiveWrong = Math.max(0, round(shown - platformShare));
    const platformLabel = communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu";
    /* The real euros, four ways, Stripe its own line — only with a price to work. */
    const euro = (rate !== null && rate > 0 && samplePrice && samplePrice > 0)
        ? euroSplit(
              samplePrice, shown, platformShare, sellerFee,
              stripeRate != null ? { rate: stripeRate, fixed: stripeFixed ?? 0 } : null,
          )
        : null;
    const cur = sampleCurrency || sellerFee?.currency || "EUR";
    const eur = (major: number) => money(Math.round(major * 100), cur);
    const euroRows = euro
        ? [
              { key: "host", amt: euro.hostKeeps, color: "var(--b-keep)", name: label("spineHostKeeps", "Host keeps") },
              { key: "comm", amt: euro.communityNet, color: "var(--b-comm)", name: say("spineNetCommission", { community: communityName }, `${communityName} (net commission)`) },
              { key: "cob", amt: euro.cobuntuNet, color: "var(--b-cob)", name: say("spineCobuntuShare", { platform: platformLabel }, `${platformLabel} (platform fee)`) },
              { key: "stripe", amt: euro.stripeAmt, color: "var(--b-stripe)", name: label("spineStripeRow", "Stripe (card processing)") },
          ].filter((r) => r.amt > 0.0001)
        : [];

    /*
     * The rows, in the order the money leaves the sale. Zero shares are dropped
     * rather than printed: "Community 0%" is a party named for taking nothing,
     * which is the chart-of-nothing problem in list form.
     */
    const rows = [
        { key: "keep", pct: sellerOfSale, color: "var(--b-keep)", name: label("spineKeySeller", "You keep") },
        { key: "comm", pct: communityOfSale, color: "var(--b-comm)", name: communityName },
        {
            key: "cob",
            pct: platformOfSale,
            color: "var(--b-cob)",
            /*
             * "Platform" when the community is itself called Cobuntu: two rows
             * reading COBUNTU say nothing about who gets what, and this is the
             * one card where that is the entire point.
             */
            name: communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu",
        },
    ].filter((r) => r.pct > 0);

    return (
        /*
         * TWO HALVES, because they answer different questions.
         *
         * The top is the TERM -- the rate the two sides agreed, which is the
         * thing under negotiation and the number people quote at each other.
         * The bottom is its CONSEQUENCE: what that rate does to one actual
         * sale, including the deductions nobody negotiated. Run together they
         * read as one contradictory block, which is how a card headed "0%"
         * came to sit above a bar showing a 4% slice with no explanation of
         * where it came from.
         *
         * The lower half sits on the sunk ground so the split reads as derived
         * from the term above rather than as a second, competing headline.
         */
        <Card className="overflow-hidden text-[var(--ink)]">
            <div className="p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                    {label("spineHeading", `${communityName}'s cut`)}
                </p>
                {/*
                  * No rate yet is a PROMPT, not a number. The old render put a
                  * 42px em dash where the percentage goes, which read as a
                  * broken value rather than an unmade decision -- so the null
                  * case drops to a muted sentence at body weight and the big
                  * numeral is reserved for a rate that actually exists.
                  */}
                {rate == null ? (
                    <p className="mt-2 text-[16px] font-semibold leading-snug text-[var(--ink-2)]">
                        {label("spineNotAgreed", "No cut agreed yet")}
                    </p>
                ) : (
                    <>
                        <p
                            className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.02em] sm:text-[44px]"
                            style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--display)" }}
                        >
                            {`${shown}%`}
                        </p>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                            {rate === 0
                                ? label("spineZero", "No commission on this listing. Nothing to split.")
                                : label("spineSub", "of every sale, split as shown")}
                        </p>
                    </>
                )}
            </div>

            {rate !== null && rate > 0 && (
                <div className="border-t border-[var(--line-soft)] bg-[var(--sunk)] p-4 sm:p-5">
                    {/*
                      * ── PART A: where the COMMISSION goes (percent) ──────────
                      *
                      * The member's "8% but it says 7.6%" lands here. The 8% is
                      * the rate CHARGED; the community nets that minus Cobuntu's
                      * share OF the commission (platformShare% of it). No flat
                      * fee lives in the commission, so percentages add up and
                      * this stays in %.
                      */}
                    <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                        {say("spineCommissionSplit", { rate: shown }, `Where the ${shown}% commission goes`)}
                    </p>
                    <dl className="mt-3 space-y-2" data-testid="spine-commission-split">
                        <div className="flex items-baseline gap-2.5">
                            <span aria-hidden="true" className="mt-[1px] h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: "var(--b-comm)" }} />
                            <dt className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-2)]">{say("spineCommunityKeeps", { community: communityName }, `${communityName} keeps`)}</dt>
                            <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{round(communityNetCommission)}%</dd>
                        </div>
                        <div className="flex items-baseline gap-2.5">
                            <span aria-hidden="true" className="mt-[2px] h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: "var(--b-cob)" }} />
                            <dt className="min-w-0 flex-1 text-[13px] text-[var(--ink-2)]">
                                {say("spinePlatformFee", { platform: platformLabel }, `${platformLabel}'s platform fee`)}
                                <span className="block text-[11.5px] text-[var(--ink-3)]">{say("spinePlatformFeeSub", { p: round(platformShare) }, `${round(platformShare)}% of the commission`)}</span>
                            </dt>
                            <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{round(cobuntuOfCommission)}%</dd>
                        </div>
                        <div className="flex items-baseline gap-2.5 border-t border-[var(--line-soft)] pt-2">
                            <span aria-hidden="true" className="mt-[1px] h-2.5 w-2.5 flex-none" />
                            <dt className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--ink)]">{label("spineCommissionCharged", "Commission charged")}</dt>
                            <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{round(shown)}%</dd>
                        </div>
                    </dl>
                    <p className="mt-3 rounded-lg bg-[var(--warn-w)] px-3 py-2 text-[12px] leading-relaxed text-[var(--ink)]">
                        {say(
                            "spineCommissionClarify",
                            { p: round(platformShare), rate: shown, community: communityName, net: round(communityNetCommission), naive: naiveWrong },
                            `${platformLabel} takes ${round(platformShare)}% of the commission, not ${round(platformShare)} points off it. A ${shown}% commission leaves ${communityName} ${round(communityNetCommission)}% of the sale, not ${naiveWrong}%.`,
                        )}
                    </p>

                    {/*
                      * ── PART B: every euro on a real ticket, Stripe its OWN ──
                      * line, not folded into Cobuntu's fee. Shown in euros so the
                      * flat per-sale charges (Cobuntu's and Stripe's) sum exactly;
                      * falls back to the percent split when no price is given.
                      */}
                    {euro ? (
                        <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                                {say("spineEuroHeading", { price: eur(samplePrice as number) }, `On a ${eur(samplePrice as number)} ticket, where every euro goes`)}
                            </p>
                            <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
                                {euroRows.map((r) => (
                                    <span key={r.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(r.amt / (samplePrice as number)) * 100}%`, background: r.color, minWidth: "6px" }} />
                                ))}
                            </div>
                            <dl className="mt-3.5 space-y-1.5" data-testid="spine-euro-split">
                                {euroRows.map((r) => (
                                    <div key={r.key} className="flex items-baseline gap-2.5">
                                        <span aria-hidden="true" className="mt-[1px] h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: r.color }} />
                                        <dt className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-2)]">{r.name}</dt>
                                        <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{eur(r.amt)}</dd>
                                    </div>
                                ))}
                                <div className="flex items-baseline gap-2.5 border-t border-[var(--line-soft)] pt-2">
                                    <span aria-hidden="true" className="mt-[1px] h-2.5 w-2.5 flex-none" />
                                    <dt className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--ink)]">{label("spineTicket", "Ticket")}</dt>
                                    <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{eur(samplePrice as number)}</dd>
                                </div>
                            </dl>
                            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                {label("spineStripeFootnote", "Stripe is an estimate for European cards; a non-EU card costs a little more and settlement corrects it.")}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                                {label("spineSplitHeading", "Every sale, split")}
                            </p>
                            <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
                                aria-label={say("spineBarAria", { pct: round(sellerOfSale) }, `You keep ${round(sellerOfSale)}% of each sale`)}>
                                {rows.map((r) => (
                                    <span key={r.key} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-500" style={{ width: `${r.pct}%`, background: r.color, minWidth: "6px" }} />
                                ))}
                            </div>
                            <dl className="mt-3.5 space-y-1.5" data-testid="spine-party-split">
                                {rows.map((r) => (
                                    <div key={r.key} className="flex items-baseline gap-2.5">
                                        <span aria-hidden="true" className="mt-[1px] h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: r.color }} />
                                        <dt className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-2)]">{r.name}</dt>
                                        <dd className="text-[13px] font-semibold text-[var(--ink)]" style={{ fontVariantNumeric: "tabular-nums" }}>{round(r.pct)}%</dd>
                                    </div>
                                ))}
                            </dl>
                            {sellerFee && (
                                <p className="mt-3 border-t border-[var(--line-soft)] pt-3 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                    {say("spineFixedFee", { amount: money(sellerFee.fixed, sellerFee.currency) },
                                        `Plus ${money(sellerFee.fixed, sellerFee.currency)} per sale to Cobuntu. Stripe's processing comes out of Cobuntu's fee, so it is not charged separately.`)}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
            {!locked && onCounter && (
                <div className="border-t border-[var(--line-soft)] p-4 sm:p-5">
                    {countering ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                autoFocus
                                type="number"
                                min={0}
                                max={40}
                                value={draft}
                                onChange={(e) => setDraft(Number(e.target.value))}
                                className="w-[72px] rounded-lg border border-zinc-200 px-2.5 py-2 text-[16px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            />
                            <button
                                type="button"
                                onClick={() => { onCounter(draft); setCountering(false); }}
                                className="cursor-pointer rounded-lg bg-[var(--commit)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
                            >
                                {label("spineOffer", "Offer")} {draft}%
                            </button>
                            <button
                                type="button"
                                onClick={() => setCountering(false)}
                                className="cursor-pointer rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ink-2)] hover:bg-[var(--sunk)]"
                            >
                                {label("counterCancel", "Cancel")}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setDraft(shown); setCountering(true); }}
                            className="w-full cursor-pointer rounded-lg border border-[var(--line)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--sunk)]"
                        >
                            {counterLabel}
                        </button>
                    )}
                </div>
            )}
        </Card>
    );
}

/** The smallest unit, as money. Amounts here are cents, as everywhere. */
export function money(amount: number, currency = "EUR"): string {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100);
}

/**
 * Round a set of MAJOR-unit amounts to whole cents that still sum to the total.
 *
 * Rounding each row on its own does not add up, and on this card that is not a
 * cosmetic problem: the whole reason the split is shown in money is that every
 * cent sums to the ticket. On a EUR 25 sale at 8%, Cobuntu's 0.695 and Stripe's
 * 0.625 both round UP, the four rows total 25.01, and the line underneath them
 * says 25.00 -- a receipt that visibly disagrees with itself, which is worse
 * than the percentages it replaced.
 *
 * Largest-remainder: floor everything, then hand the leftover cents out to the
 * rows with the biggest discarded fraction, which keeps each row within a cent
 * of its true value and the sum exact.
 */
export function allocateCents(totalMajor: number, partsMajor: number[]): number[] {
    const total = Math.round(totalMajor * 100);
    const exact = partsMajor.map((p) => p * 100);
    const floors = exact.map((c) => Math.floor(c));
    let left = total - floors.reduce((a, b) => a + b, 0);
    const order = exact
        .map((c, i) => ({ i, frac: c - Math.floor(c) }))
        .sort((a, b) => b.frac - a.frac);
    const out = [...floors];
    /* Guard the pathological case (left can exceed the row count only if the
       parts do not actually sum to the total, which would be a math bug). */
    for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k].i] += 1;
    return out;
}

/** One percent, rounded for display without pretending to precision it lacks. */
function round(n: number): number {
    return Math.round(n * 10) / 10;
}

/**
 * One real sale, split four ways in MAJOR units — and Stripe pulled out of
 * Cobuntu's fee into its own line.
 *
 * Why euros, not percent: both Cobuntu's seller fee and Stripe carry a flat
 * per-sale charge, and flat charges do not add up as percentages across sale
 * sizes. On a concrete price every cent sums to the ticket.
 *
 *   commission        = price × rate
 *   community keeps    = commission − Cobuntu's platformShare OF it
 *   host's share       = price − commission
 *   Cobuntu's all-in seller fee comes off the host's share; STRIPE comes out of
 *   that fee, so Cobuntu's own line is its take on both sides MINUS what Stripe
 *   actually costs. Clamped at zero: a tiny sale where Stripe exceeds the fee is
 *   a real loss to Cobuntu, not a negative row.
 */
export function euroSplit(
    price: number,
    rate: number,
    platformShare: number,
    sellerFee: { rate: number; fixed: number; currency?: string } | null,
    stripe: { rate: number; fixed: number } | null,
): { hostKeeps: number; communityNet: number; cobuntuNet: number; stripeAmt: number } {
    const commission = price * (rate / 100);
    const cobuntuOfCommission = commission * (platformShare / 100);
    const communityNet = commission - cobuntuOfCommission;
    const hostShare = price - commission;
    const sellerFeeAmt = sellerFee ? hostShare * sellerFee.rate + sellerFee.fixed / 100 : 0;
    const hostKeeps = hostShare - sellerFeeAmt;
    const stripeAmt = stripe ? price * stripe.rate + stripe.fixed / 100 : 0;
    const cobuntuNet = Math.max(0, cobuntuOfCommission + sellerFeeAmt - stripeAmt);
    return { hostKeeps, communityNet, cobuntuNet, stripeAmt };
}

function Key({ className, text }: { className: string; text: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
            {text}
        </span>
    );
}
