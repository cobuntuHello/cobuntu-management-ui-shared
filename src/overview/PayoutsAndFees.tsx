import type { OverviewMoney, FeeRates, StripeDestination, OwnershipModel } from "./types";

/**
 * "Payouts & fees" — where the gross went, where the money lands, and when.
 *
 * The three questions a seller opens the manage page with that the tiles above
 * do not answer: how much am I paying and to whom, which account does what is
 * left go to, and when. Built from the OWNER's side, so a member seller sees
 * Stripe as absorbed rather than as a charge they never paid.
 *
 * Renders nothing on a backend that predates the fields (no `breakdown` or no
 * `ownership`) — the tiles still stand on their own.
 *
 * Deliberately COMPACT. This is a reference table, not the headline: the tiles
 * above already carry the numbers a seller opens the page for, and this card sat
 * under them at roughly the height of a full screen. Three things paid for that
 * height without earning it, and all three are gone:
 *   - a rule under every fee row, which drew a table grid around what is really
 *     a short list of deductions;
 *   - "paid to" and "next payout" as two stacked filled panels, when each is one
 *     short fact and they read fine side by side on one strip;
 *   - a footnote repeating "Stripe is paid from Cobuntu's fee" directly beneath
 *     the row already labelled "Absorbed by Cobuntu".
 * Every number still shown, same order, same arithmetic.
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

function FeeRow({
    label, pctLabel, sub, amount, tone = "out",
}: {
    label: string;
    pctLabel?: string | null;
    sub?: string | null;
    amount: string;
    tone?: "in" | "out" | "free";
}) {
    const amountClass = tone === "out"
        ? "text-red-700"
        : tone === "free"
            ? "text-zinc-400 font-medium"
            : "text-zinc-900";
    return (
        <div className="flex items-baseline justify-between gap-3 py-[3px]">
            <span className="text-[13px] text-zinc-600">
                {label}
                {/* The rate and the "absorbed" note ride on the label line now.
                    As a second line each row became two rows tall. */}
                {pctLabel ? <span className="ml-1.5 text-[12px] text-zinc-400">{pctLabel}</span> : null}
                {sub ? <span className="ml-1.5 text-[11.5px] text-zinc-400">({sub})</span> : null}
            </span>
            <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${amountClass}`}>{amount}</span>
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

    return (
        <div className="rounded-xl border border-zinc-200/70 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">{t("feesTitle")}</p>

            {/* The split, owner perspective. Reconciles to gross. */}
            <div className="mt-1.5">
                <FeeRow label={t("feesGrossRow")} amount={cash(money.gross)} tone="in" />

                {b.vat > 0 && <FeeRow label={t("feesVat")} amount={`−${cash(b.vat)}`} />}

                {isMember ? (
                    /* Cobuntu absorbs Stripe on member sales, so it costs the
                     * seller nothing — said plainly rather than shown as a €0. */
                    <FeeRow label={t("feesStripe")} sub={t("feesStripeAbsorbed")} amount={cash(0)} tone="free" />
                ) : (
                    <FeeRow label={t("feesStripe")} amount={`−${cash(b.stripe)}`} />
                )}

                <FeeRow
                    label={t("feesCobuntu")}
                    pctLabel={!isMember && rates?.cobuntuPct != null ? t("feesPct", { rate: pct(rates.cobuntuPct) }) : null}
                    sub={isMember ? t("feesCobuntuMemberSub") : null}
                    amount={`−${cash(b.cobuntu)}`}
                />

                {b.community > 0 && (
                    <FeeRow
                        label={t("feesCommunityCommission")}
                        pctLabel={rates?.communityPct != null ? t("feesPct", { rate: pct(rates.communityPct) }) : null}
                        amount={`−${cash(b.community)}`}
                    />
                )}

                {/* The one the seller came for, set apart. */}
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2">
                    <span className="text-[13.5px] font-bold text-zinc-900">
                        {t(isMember ? "feesYouKeep" : "feesCommunityNet")}
                    </span>
                    <span className="shrink-0 text-[16px] font-extrabold tabular-nums text-emerald-700">{cash(b.net)}</span>
                </div>
            </div>

            {/* Where and when, on one strip. Two short facts, each a label and a
                value, so they sit as columns rather than as stacked panels. They
                wrap to two lines on a narrow column. */}
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 border-t border-zinc-200/70 pt-2.5">
                <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">{t("feesPaidTo")}</p>
                    {destination && destination.connected ? (
                        <p className="text-[12.5px] font-semibold text-zinc-900">
                            {accountLine(destination, t)}
                            <span className={`ml-1.5 font-medium ${destination.payoutsEnabled ? "text-emerald-700" : "text-amber-700"}`}>
                                {destination.payoutsEnabled ? t("feesDestReady") : t("feesDestPayoutsOff")}
                            </span>
                        </p>
                    ) : (
                        <p className="text-[12.5px] font-medium text-amber-700">{t("feesDestNone")}</p>
                    )}
                </div>

                <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">{t("feesNextPayout")}</p>
                    {money.held > 0 && money.nextPayoutAt ? (
                        <p className="text-[12.5px] font-semibold text-zinc-900">
                            {cash(money.held)}
                            <span className="ml-1.5 font-normal text-zinc-500">
                                {day(money.nextPayoutAt)} ({t("feesNextPayoutHeld")})
                            </span>
                        </p>
                    ) : money.due > 0 ? (
                        <p className="text-[12.5px] font-semibold text-zinc-900">
                            {cash(money.due)}
                            <span className="ml-1.5 font-medium text-emerald-700">{t("feesAvailableNow")}</span>
                        </p>
                    ) : (
                        <p className="text-[12.5px] text-zinc-400">{t("feesNextPayoutNone")}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
