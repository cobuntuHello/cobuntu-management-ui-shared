import type { OverviewMoney, FeeRates, StripeDestination, OwnershipModel } from "./types";

/**
 * "Payouts & fees" — what the seller keeps, what came off the top, and where
 * and when the rest lands.
 *
 * REDESIGNED from a ledger table into a summary. The old card asked the seller
 * to read five labelled rows and do the arithmetic themselves to reach the one
 * figure they came for, then repeated the destination and the timing as two
 * filled panels underneath. It ran about a screen tall and read like a receipt.
 *
 * Three ideas replace it:
 *
 *   1. LEAD WITH THE ANSWER. "You keep" is the headline, at headline size, with
 *      the gross demoted to a caption beneath it. Everything else on the card
 *      exists to explain that number, so nothing else competes with it.
 *
 *   2. SHOW THE SPLIT, DON'T TABULATE IT. One stacked bar gives the shape of
 *      the deal at a glance -- how much of the bar is the seller's is the whole
 *      question -- and the legend beneath carries the exact amounts and rates,
 *      so nothing is lost to the picture. A percentage is easier to feel as a
 *      width than to read as a number.
 *
 *   3. SAY WHERE AND WHEN AS A SENTENCE. Two facts, one line each, on a soft
 *      footer rather than two bordered panels.
 *
 * Built from the OWNER's side, so a member seller sees Stripe as covered rather
 * than as a charge they never paid.
 *
 * Renders nothing on a backend that predates the fields (no `breakdown` or no
 * `ownership`) -- the tiles above still stand on their own.
 */

type T = (key: string, vars?: Record<string, string | number>) => string;

/** A percent that shows decimals only when it has them: 8, not 8.00. */
function pct(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** The bank label from what Stripe gave us, as much of it as exists. */
function accountLine(d: StripeDestination, t: T): string {
    const who = t(d.scope === "community" ? "feesDestCommunity" : "feesDestUser");
    const bank = [d.bankBrand, d.last4 ? `••${d.last4}` : null].filter(Boolean).join(" ");
    const tail = [bank || null, d.country].filter(Boolean).join(" · ");
    return tail ? `${who} · ${tail}` : who;
}

/**
 * One slice of the split.
 *
 * `swatch` is a Tailwind bg-* class rather than a raw colour so the palette
 * stays in one place, and `hollow` marks the covered-Stripe case: a ring rather
 * than a fill, because it is a line in the story with no width in the bar.
 */
type Slice = {
    key: string;
    label: string;
    note?: string | null;
    amount: number;
    /** What the legend prints. Usually the money; "covered" for absorbed Stripe. */
    display: string;
    swatch: string;
    hollow?: boolean;
};

/**
 * The bar. Widths are shares of gross, and a non-zero slice is floored at a
 * visible sliver -- a 40-cent fee on a 400-euro sale is a real deduction and
 * should not vanish into a hairline. The floor makes the row slightly wider
 * than its track, which the clip absorbs; the legend carries the exact figures
 * either way, so the bar never has to be measured.
 *
 * The 2px gap between slices is a right border in the surface colour, not a
 * margin: it keeps the segments mathematically adjacent, and `last:` drops it
 * so the bar ends flush inside its rounded track.
 */
function SplitBar({ slices, gross, label }: { slices: Slice[]; gross: number; label: string }) {
    const drawn = slices.filter((s) => s.amount > 0 && !s.hollow);

    // Nothing sold yet: a quiet empty track, so the card keeps its shape and
    // the seller can still read the structure of the deal off the legend.
    if (gross <= 0 || drawn.length === 0) {
        return <div className="mt-3 h-2.5 rounded-full bg-zinc-100" aria-hidden="true" />;
    }

    return (
        <div
            role="img"
            aria-label={label}
            className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-100"
        >
            {drawn.map((s) => (
                <span
                    key={s.key}
                    className={`${s.swatch} h-full border-r-2 border-white last:border-r-0`}
                    style={{ width: `${Math.max((s.amount / gross) * 100, 1.5)}%` }}
                />
            ))}
        </div>
    );
}

/** A legend entry: swatch, what it is, and what it cost. */
function LegendItem({ slice }: { slice: Slice }) {
    return (
        <div className="flex items-baseline gap-2">
            <span
                className={`mt-[1px] h-2 w-2 shrink-0 self-center rounded-full ${
                    slice.hollow ? "bg-transparent ring-1 ring-zinc-300" : slice.swatch
                }`}
            />
            {/* Wraps rather than truncates: a clipped "Community commissi..."
                hides which line the amount beside it belongs to. */}
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-zinc-600">
                {slice.label}
                {slice.note ? <span className="ml-1 text-zinc-400">{slice.note}</span> : null}
            </span>
            <span
                className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${
                    slice.hollow ? "text-zinc-400" : "text-zinc-800"
                }`}
            >
                {slice.display}
            </span>
        </div>
    );
}

export function PayoutsAndFees({
    money, ownership, rates, destination, t, cash, locale = "en-GB",
}: {
    money: OverviewMoney;
    ownership?: OwnershipModel;
    rates?: FeeRates;
    destination?: StripeDestination | null;
    t: T;
    cash: (n: number) => string;
    locale?: string;
}) {
    const b = money.breakdown;
    // Pre-feature backend: the tiles above already stand on their own.
    if (!b || !ownership) return null;

    const isMember = ownership === "member";
    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

    /*
     * The seller's own share leads the bar and the legend. Reading left to
     * right then answers "how much of this is mine" before it answers "who
     * took what", which is the order the question actually arrives in.
     */
    const slices: Slice[] = [
        {
            key: "net",
            label: t(isMember ? "feesYouKeep" : "feesCommunityNet"),
            amount: b.net,
            display: cash(b.net),
            swatch: "bg-emerald-600",
        },
        ...(b.community > 0 || rates?.communityPct != null
            ? [{
                key: "community",
                label: t("feesCommunityCommission"),
                note: rates?.communityPct != null ? t("feesPct", { rate: pct(rates.communityPct) }) : null,
                amount: b.community,
                display: cash(b.community),
                swatch: "bg-amber-500",
            }]
            : []),
        {
            key: "cobuntu",
            label: t("feesCobuntu"),
            note: !isMember && rates?.cobuntuPct != null ? t("feesPct", { rate: pct(rates.cobuntuPct) }) : null,
            amount: b.cobuntu,
            display: cash(b.cobuntu),
            swatch: "bg-zinc-400",
        },
        ...(b.vat > 0
            ? [{ key: "vat", label: t("feesVat"), amount: b.vat, display: cash(b.vat), swatch: "bg-zinc-300" }]
            : []),
        /*
         * Cobuntu covers Stripe on member sales. Said in words, with a hollow
         * swatch and no width in the bar, rather than shown as a 0.00 row that
         * looks like a fee that happened to round to nothing.
         */
        isMember
            ? {
                key: "stripe",
                label: t("feesStripe"),
                amount: 0,
                display: t("feesStripeCovered"),
                swatch: "bg-transparent",
                hollow: true,
            }
            : { key: "stripe", label: t("feesStripe"), amount: b.stripe, display: cash(b.stripe), swatch: "bg-sky-600" },
    ];

    const barLabel = slices
        .filter((s) => s.amount > 0)
        .map((s) => `${s.label} ${s.display}`)
        .join(", ");

    return (
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-5">
            {/* The answer, at the size of an answer. */}
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">
                {t(isMember ? "feesYouKeep" : "feesCommunityNet")}
            </p>
            <p className="mt-1.5 text-[30px] font-bold leading-none tracking-tight tabular-nums text-emerald-700">
                {cash(b.net)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-zinc-500">
                {money.gross > 0 ? t("feesFromGross", { amount: cash(money.gross) }) : t("feesNothingTakenYet")}
            </p>

            <SplitBar slices={slices} gross={money.gross} label={barLabel} />

            {/* Exact figures, so nothing is lost to the picture. */}
            <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {slices.map((s) => <LegendItem key={s.key} slice={s} />)}
            </div>

            {/* Where, and when. */}
            <div className="mt-4 space-y-1 rounded-xl bg-zinc-50 px-3.5 py-3">
                <p className="text-[12.5px] text-zinc-600">
                    {destination && destination.connected ? (
                        <>
                            {t("feesLandsIn", { account: accountLine(destination, t) })}
                            <span className={`ml-1.5 font-medium ${destination.payoutsEnabled ? "text-emerald-700" : "text-amber-700"}`}>
                                {destination.payoutsEnabled ? t("feesDestReady") : t("feesDestPayoutsOff")}
                            </span>
                        </>
                    ) : (
                        <span className="font-medium text-amber-700">{t("feesDestNone")}</span>
                    )}
                </p>
                <p className="text-[12.5px] text-zinc-500">
                    {money.held > 0 && money.nextPayoutAt
                        ? t("feesHeldUntil", { amount: cash(money.held), date: day(money.nextPayoutAt) })
                        : money.due > 0
                            ? t("feesReadyToPayOut", { amount: cash(money.due) })
                            : t("feesNextPayoutNone")}
                </p>
            </div>
        </div>
    );
}
