import { useState } from "react";
import type { ItemLedger, LedgerMovement } from "./types";
import type { StripeDestination } from "../overview/types";
import { formatMoney } from "../overview/format";
import { EmptyState, LedgerIcon } from "../overview/EmptyState";

/**
 * Every money movement for one product or event.
 *
 * ── Why rows, not cards ─────────────────────────────────────────────────────
 *
 * A ledger is read by scanning a column, not by reading each entry. Cards put
 * every amount at a different x-position and make "when did that jump happen"
 * a search rather than a glance. So: a table, with the money right-aligned and
 * tabular figures, which is what the admin ledger does and why it works.
 *
 * ── The three columns ───────────────────────────────────────────────────────
 *
 * Gross, the community's cut, the seller's net. One sale is three numbers
 * depending on who is asking, and a page that shows only the viewer's cannot
 * settle a disagreement about the other two. `showCommunity` hides the middle
 * column where it is always zero (a seller with no broker), rather than
 * printing a column of dashes.
 *
 * ── A payout row does NOT show the payout ───────────────────────────────────
 *
 * It shows this item's part of it. A transfer covers many sales across many
 * items, so the full total belongs in the sub-line ("of €210.00 · 2 sales from
 * here") and never in the amount column, where it would read as this item's
 * earnings and be wrong by however much the rest of the payout was worth.
 *
 * ── A won dispute is not a loss ─────────────────────────────────────────────
 *
 * It is drawn in the neutral tone with no minus. The money stayed. Colouring it
 * red because the word "dispute" sounds bad tells the seller they lost
 * something they still have.
 */

/**
 * Statuses that HAVE a translation.
 *
 * `t` returns the key itself when it has none, and next-intl throws outright --
 * so building `ledgerStatus_${status}` from a database value and hoping is how
 * a page comes to print "ledgerStatus_PARTIALLY_REFUNDED" at a customer. The
 * payout and refund enums both grow, and this list will lag them; anything not
 * on it gets humanised rather than leaked raw.
 */
const TRANSLATED_STATUSES = new Set([
    "ESCROW", "ELIGIBLE", "PAID", "HOLD",
    "COMPLETED", "PENDING", "FAILED",
    "DISPUTE_WON", "DISPUTE_LOST",
]);

/** SCREAMING_SNAKE to "Screaming snake". */
function humanise(status: string): string {
    const words = status.replace(/_/g, " ").toLowerCase().trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A short account label for a payout sub-line: "Millennium ••4242". */
function destLabel(d: StripeDestination): string {
    const parts = [d.bankBrand, d.last4 ? `••${d.last4}` : null].filter(Boolean);
    return parts.length ? parts.join(" ") : (d.scope === "community" ? "community account" : "your account");
}

/** True when a sale/refund row carries fee lines worth expanding. */
function hasBreakdown(m: LedgerMovement): boolean {
    return (m.kind === "sale" || m.kind === "refund")
        && [m.vat, m.stripeFee, m.cobuntuFee, m.communityFee].some((v) => v !== undefined);
}

function statusLabel(status: string, t: (key: string) => string): string {
    return TRANSLATED_STATUSES.has(status) ? t(`ledgerStatus_${status}`) : humanise(status);
}

const TONE: Record<string, string> = {
    sale: "bg-emerald-50 text-emerald-700",
    refund: "bg-red-50 text-red-700",
    payout: "bg-sky-50 text-sky-700",
    dispute: "bg-amber-50 text-amber-700",
};

export function ManageLedger({
    ledger,
    showCommunity = true,
    locale = "en-GB",
    t,
}: {
    ledger: ItemLedger;
    /** Show the community's cut as its own column. */
    showCommunity?: boolean;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const { movements, currency } = ledger;
    const isMember = ledger.ownership === "member";
    const cash = (n: number) => formatMoney(n, currency, locale);
    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    const dayTime = (iso: string) =>
        new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

    /*
     * The fee breakdown used to expand INLINE, a second <tr> under the sale
     * row. That is a different UI language from every other money detail in
     * this app -- the community's own Ledger (app/[communityTag]/ledger)
     * opens a slide-in side panel for the same kind of detail, and this is
     * the one ledger view that didn't match it. `selectedMovement` +
     * `panelVisible` is that page's exact state shape (see openPanel/
     * closePanel there): two pieces of state, not one, so the panel can
     * slide OUT before the data backing it disappears.
     */
    const [selectedMovement, setSelectedMovement] = useState<LedgerMovement | null>(null);
    const [panelVisible, setPanelVisible] = useState(false);
    const openPanel = (m: LedgerMovement) => {
        setSelectedMovement(m);
        requestAnimationFrame(() => setPanelVisible(true));
    };
    const closePanel = () => {
        setPanelVisible(false);
        setTimeout(() => setSelectedMovement(null), 250);
    };
    const columns = 3 + (showCommunity ? 1 : 0); // movement + gross + [community] + seller

    if (movements.length === 0) {
        /*
         * No ACTION here, deliberately. An empty ledger is not something the
         * reader can fix -- you cannot make someone buy -- so a button would
         * only offer a way out of a state that is simply early.
         */
        return (
            <EmptyState
                icon={<LedgerIcon />}
                title={t("ledgerEmptyTitle")}
                body={t("ledgerEmptyBody")}
            />
        );
    }

    /*
     * Totals from the SALE rows only.
     *
     * Adding payouts in would double-count: a payout is money already counted
     * when its sale was recorded, moving to a different place. Summing every
     * signed row would make a fully paid-out product look like it earned
     * nothing.
     */
    const sales = movements.filter((m) => m.kind === "sale");
    const refunded = movements.filter((m) => m.kind === "refund");
    const earned = sales.reduce((n, m) => n + m.sellerNet, 0)
        - refunded.reduce((n, m) => n + m.sellerNet, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-[16px] font-semibold text-zinc-900">{t("ledgerTitle")}</h2>
                <p className="text-[13px] text-zinc-500">
                    {t("ledgerSummary", {
                        sales: sales.length,
                        net: cash(earned),
                    })}
                </p>
            </div>

            {/* Wide content scrolls in its own box; the page never does. */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200/70 bg-white">
                <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-zinc-200/70 text-[10.5px] uppercase tracking-[.08em] text-zinc-400">
                            <th className="px-4 py-2.5 font-bold">{t("ledgerColMovement")}</th>
                            <th className="px-4 py-2.5 text-right font-bold">{t("ledgerColGross")}</th>
                            {showCommunity && (
                                <th className="px-4 py-2.5 text-right font-bold">{t("ledgerColCommunity")}</th>
                            )}
                            <th className="px-4 py-2.5 text-right font-bold">{t("ledgerColSeller")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movements.map((m) => (
                            <Row
                                key={m.key}
                                m={m}
                                showCommunity={showCommunity}
                                cash={cash}
                                day={day}
                                t={t}
                                onOpen={openPanel}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedMovement && (
                <BreakdownPanel
                    m={selectedMovement}
                    visible={panelVisible}
                    isMember={isMember}
                    cash={cash}
                    day={day}
                    dayTime={dayTime}
                    t={t}
                    onClose={closePanel}
                />
            )}
        </div>
    );
}

function Row({
    m, showCommunity, cash, day, t, onOpen,
}: {
    m: LedgerMovement;
    showCommunity: boolean;
    cash: (n: number) => string;
    day: (iso: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onOpen: (m: LedgerMovement) => void;
}) {
    /*
     * A won dispute took nothing, so it gets neither the minus nor the red.
     * Everything else follows its sign.
     */
    const won = m.kind === "dispute" && m.status === "DISPUTE_WON";
    const negative = m.sign === -1 && !won;
    const amount = (n: number) => (n === 0 ? "—" : `${negative ? "−" : ""}${cash(n)}`);
    const tone = negative ? "text-red-700" : "text-zinc-900";
    const expandable = hasBreakdown(m);

    const subline = [
        day(m.at),
        statusLabel(m.status, t),
        /*
         * The whole transfer, in the SUB-LINE. It must never reach the amount
         * column, where it would read as this item's earnings.
         */
        m.kind === "payout" && m.payoutTotal !== undefined
            ? t("ledgerOfPayout", { total: cash(m.payoutTotal), count: m.salesFromThisItem ?? 0 })
            : null,
        /* The "when" and "where" a payout is the reason to open this page. */
        m.kind === "payout" && m.scheduledFor
            ? t("ledgerScheduledFor", { date: day(m.scheduledFor) })
            : null,
        m.kind === "payout" && m.destination
            ? t("ledgerPaidTo", { account: destLabel(m.destination) })
            : null,
        m.reason,
    ].filter(Boolean).join(" · ");

    return (
        <tr className="border-b border-zinc-200/70 last:border-b-0 align-top">
            <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[m.kind] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {t(`ledgerKind_${m.kind}`)}
                    </span>
                    {/*
                      * "Guest" rather than nothing. A guest checkout has no
                      * account; the server falls back to the email, and null
                      * means not even that. An empty cell reads as a missing
                      * record. Sales only -- a payout has no buyer.
                      */}
                    {m.kind === "sale" && (
                        <span className={`text-[13.5px] ${m.buyerName ? "font-medium text-zinc-900" : "text-zinc-500"}`}>
                            {m.buyerName || t("ledgerGuestBuyer")}
                        </span>
                    )}
                    {m.kind !== "sale" && m.buyerName && (
                        <span className="text-[13.5px] font-medium text-zinc-900">{m.buyerName}</span>
                    )}
                    {m.payoutLeg && (
                        <span className="text-[13.5px] font-medium text-zinc-900">
                            {t(`ledgerLeg_${m.payoutLeg}`)}
                        </span>
                    )}
                    {/*
                      * Fee breakdown opens the same side drawer the
                      * community's own Ledger page uses for a sale's detail
                      * -- not an inline toggle. A real button (not a row-wide
                      * click target) so the amounts stay selectable text.
                      */}
                    {expandable && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpen(m); }}
                            className="cursor-pointer text-[11.5px] font-semibold text-zinc-400 hover:text-zinc-700"
                        >
                            {t("ledgerShowBreakdown")} ›
                        </button>
                    )}
                </div>
                <p className="mt-0.5 text-[12px] text-zinc-500">{subline}</p>
            </td>
            <td className={`px-4 py-3 text-right text-[13.5px] tabular-nums ${tone}`}>
                {amount(m.gross)}
            </td>
            {showCommunity && (
                <td className={`px-4 py-3 text-right text-[13.5px] tabular-nums ${tone}`}>
                    {amount(m.communityCut)}
                </td>
            )}
            <td className={`px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums ${tone}`}>
                {amount(m.sellerNet)}
            </td>
        </tr>
    );
}

/**
 * A single money movement's detail, in a side drawer.
 *
 * Mirrors app/[communityTag]/ledger/page.tsx's sale panel exactly: same
 * `fixed inset-0 … flex justify-end` wrapper, same backdrop-opacity +
 * translate-x transition pair driven by a `visible` flag, same
 * rounded-l-2xl panel with a sticky header and a chevron close button. That
 * page is where every other money detail in the admin app already opens a
 * drawer; this view is the one that used to do something else, not the
 * other way round.
 */
function BreakdownPanel({
    m, visible, isMember, cash, day, dayTime, t, onClose,
}: {
    m: LedgerMovement;
    visible: boolean;
    isMember: boolean;
    cash: (n: number) => string;
    day: (iso: string) => string;
    dayTime: (iso: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onClose: () => void;
}) {
    const won = m.kind === "dispute" && m.status === "DISPUTE_WON";
    const negative = m.sign === -1 && !won;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-250 ${visible ? "opacity-20" : "opacity-0"}`}
                onClick={onClose}
            />
            <div
                className={`relative w-full max-w-[440px] bg-white h-full overflow-y-auto shadow-2xl rounded-l-2xl transition-transform duration-250 ease-out ${
                    visible ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="sticky top-0 bg-white z-10 border-b border-zinc-100">
                    <div className="px-6 pt-5 pb-4">
                        <div className="flex items-center justify-between mb-5">
                            <button
                                onClick={onClose}
                                aria-label={t("ledgerClose")}
                                className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                    <polyline points="13 17 18 12 13 7" />
                                    <polyline points="6 17 11 12 6 7" />
                                </svg>
                            </button>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${TONE[m.kind] ?? "bg-zinc-100 text-zinc-600"}`}>
                                {t(`ledgerKind_${m.kind}`)}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0 text-sm font-semibold">
                                {(m.buyerName || t("ledgerGuestBuyer")).trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[15px] font-semibold text-zinc-900 truncate">
                                    {m.buyerName || t("ledgerGuestBuyer")}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-semibold tabular-nums ${negative ? "text-red-700" : "text-zinc-900"}`}>
                                {negative ? "−" : ""}{cash(m.gross)}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">{t("ledgerAt", { date: day(m.at), time: dayTime(m.at) })}</p>
                    </div>
                </div>

                <div className="px-6 pb-8">
                    <div className="mt-6">
                        <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-3">{t("ledgerBreakdownTitle")}</h4>
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 overflow-hidden">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-zinc-100">
                                        <td className="px-4 py-2.5 text-zinc-500">{t("ledgerColGross")}</td>
                                        <td className="px-4 py-2.5 text-zinc-900 text-right tabular-nums">{cash(m.gross)}</td>
                                    </tr>
                                    {(m.vat ?? 0) > 0 && (
                                        <tr className="border-b border-zinc-100">
                                            <td className="px-4 py-2.5 text-zinc-500">{t("ledgerFeeVat")}</td>
                                            <td className="px-4 py-2.5 text-red-500 text-right tabular-nums">{`-${cash(m.vat ?? 0)}`}</td>
                                        </tr>
                                    )}
                                    <tr className="border-b border-zinc-100">
                                        <td className="px-4 py-2.5 text-zinc-500">{t("ledgerFeeStripe")}</td>
                                        <td className={`px-4 py-2.5 text-right tabular-nums ${isMember ? "text-zinc-400" : "text-orange-500"}`}>
                                            {isMember ? t("ledgerFeeStripeAbsorbed") : `-${cash(m.stripeFee ?? 0)}`}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-zinc-100">
                                        <td className="px-4 py-2.5 text-zinc-500">{t("ledgerFeeCobuntu")}</td>
                                        <td className="px-4 py-2.5 text-red-500 text-right tabular-nums">{`-${cash(m.cobuntuFee ?? 0)}`}</td>
                                    </tr>
                                    {(m.communityFee ?? 0) > 0 && (
                                        <tr className="border-b border-zinc-100">
                                            <td className="px-4 py-2.5 text-zinc-500">{t("ledgerFeeCommunity")}</td>
                                            <td className="px-4 py-2.5 text-blue-500 text-right tabular-nums">{`-${cash(m.communityFee ?? 0)}`}</td>
                                        </tr>
                                    )}
                                    <tr className="border-t-2 border-zinc-200 bg-emerald-50/60">
                                        <td className="px-4 py-3.5 font-semibold text-zinc-900">{t("ledgerColSeller")}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`text-xl font-bold tabular-nums ${negative ? "text-red-600" : "text-emerald-600"}`}>
                                                {negative ? "−" : ""}{cash(m.sellerNet)}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
