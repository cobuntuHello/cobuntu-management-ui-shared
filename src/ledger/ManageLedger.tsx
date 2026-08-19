import type { ItemLedger, LedgerMovement } from "./types";
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
    const cash = (n: number) => formatMoney(n, currency, locale);
    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

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
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Row({
    m, showCommunity, cash, day, t,
}: {
    m: LedgerMovement;
    showCommunity: boolean;
    cash: (n: number) => string;
    day: (iso: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    /*
     * A won dispute took nothing, so it gets neither the minus nor the red.
     * Everything else follows its sign.
     */
    const won = m.kind === "dispute" && m.status === "DISPUTE_WON";
    const negative = m.sign === -1 && !won;
    const amount = (n: number) => (n === 0 ? "—" : `${negative ? "−" : ""}${cash(n)}`);
    const tone = negative ? "text-red-700" : "text-zinc-900";

    return (
        <tr className="border-b border-zinc-200/70 last:border-b-0 align-top">
            <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[m.kind] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {t(`ledgerKind_${m.kind}`)}
                    </span>
                    {m.buyerName && (
                        <span className="text-[13.5px] font-medium text-zinc-900">{m.buyerName}</span>
                    )}
                    {m.payoutLeg && (
                        <span className="text-[13.5px] font-medium text-zinc-900">
                            {t(`ledgerLeg_${m.payoutLeg}`)}
                        </span>
                    )}
                </div>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                    {[
                        day(m.at),
                        statusLabel(m.status, t),
                        /*
                         * The whole transfer, in the SUB-LINE. It must never
                         * reach the amount column, where it would read as this
                         * item's earnings.
                         */
                        m.kind === "payout" && m.payoutTotal !== undefined
                            ? t("ledgerOfPayout", {
                                  total: cash(m.payoutTotal),
                                  count: m.salesFromThisItem ?? 0,
                              })
                            : null,
                        m.reason,
                    ].filter(Boolean).join(" · ")}
                </p>
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
