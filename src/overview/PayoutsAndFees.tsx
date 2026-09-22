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
        <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200/70 py-2.5 last:border-b-0">
            <span className="text-[13.5px] text-zinc-700">
                {label}
                {pctLabel ? <span className="ml-1.5 text-[12px] text-zinc-400">{pctLabel}</span> : null}
                {sub ? <span className="mt-0.5 block text-[11.5px] text-zinc-400">{sub}</span> : null}
            </span>
            <span className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${amountClass}`}>{amount}</span>
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
        <div className="rounded-xl border border-zinc-200/70 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">{t("feesTitle")}</p>

            {/* The split, owner perspective. Reconciles to gross. */}
            <div className="mt-2">
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
                <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-zinc-200 pt-3">
                    <span className="text-[14px] font-bold text-zinc-900">
                        {t(isMember ? "feesYouKeep" : "feesCommunityNet")}
                    </span>
                    <span className="shrink-0 text-[17px] font-extrabold tabular-nums text-emerald-700">{cash(b.net)}</span>
                </div>
            </div>

            {isMember && (
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-400">{t("feesMemberStripeNote")}</p>
            )}

            {/* Where and when. */}
            <div className="mt-4 space-y-2">
                <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">{t("feesPaidTo")}</p>
                    {destination && destination.connected ? (
                        <p className="mt-0.5 text-[13px] font-semibold text-zinc-900">
                            {accountLine(destination, t)}
                            <span className={`ml-2 text-[11.5px] font-medium ${destination.payoutsEnabled ? "text-emerald-700" : "text-amber-700"}`}>
                                {destination.payoutsEnabled ? t("feesDestReady") : t("feesDestPayoutsOff")}
                            </span>
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[13px] font-medium text-amber-700">{t("feesDestNone")}</p>
                    )}
                </div>

                <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">{t("feesNextPayout")}</p>
                    {money.held > 0 && money.nextPayoutAt ? (
                        <p className="mt-0.5 flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-semibold text-zinc-900">
                                {day(money.nextPayoutAt)}
                                <span className="ml-2 text-[11.5px] font-normal text-zinc-400">{t("feesNextPayoutHeld")}</span>
                            </span>
                            <span className="shrink-0 text-[14px] font-bold tabular-nums text-zinc-900">{cash(money.held)}</span>
                        </p>
                    ) : money.due > 0 ? (
                        <p className="mt-0.5 flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-semibold text-emerald-700">{t("feesAvailableNow")}</span>
                            <span className="shrink-0 text-[14px] font-bold tabular-nums text-zinc-900">{cash(money.due)}</span>
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[13px] text-zinc-400">{t("feesNextPayoutNone")}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
