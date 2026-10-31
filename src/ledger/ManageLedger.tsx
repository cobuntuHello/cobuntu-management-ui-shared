import { Fragment, useState } from "react";
import type { ItemLedger, LedgerMovement } from "./types";
import type { StripeDestination } from "../overview/types";
import { formatMoney } from "../overview/format";
import { EmptyState, LedgerIcon } from "../overview/EmptyState";
import { LAYERS } from "../ui/layers";

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

/** Two-letter initials for the row's avatar chip, same logic as the drawer's. */
function initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
}

/**
 * A row to render, paired with whether it's a refund nested under its sale.
 *
 * ── Why pairing happens here, not in the backend ────────────────────────────
 *
 * The admin community ledger pairs a refund directly under its sale rather
 * than listing it as a separate top-level movement, "same sort date, so they
 * never drift apart". This view's own backend comment explains the server
 * deliberately does NOT assemble movements beyond the flat list — "both
 * endpoints return sales, payouts and a summary, and each frontend page
 * builds the movement list itself" — so pairing is this page's job, same as
 * the admin's.
 */
interface DisplayRow {
    m: LedgerMovement;
    paired: boolean;
}

function buildDisplayRows(movements: LedgerMovement[]): DisplayRow[] {
    const saleKeys = new Set(movements.filter((m) => m.kind === "sale").map((m) => m.key));
    const refundsBySale = new Map<string, LedgerMovement[]>();
    for (const m of movements) {
        if (m.kind === "refund" && m.saleKey && saleKeys.has(m.saleKey)) {
            const arr = refundsBySale.get(m.saleKey) ?? [];
            arr.push(m);
            refundsBySale.set(m.saleKey, arr);
        }
    }
    const pairedKeys = new Set(Array.from(refundsBySale.values()).flat().map((r) => r.key));

    const rows: DisplayRow[] = [];
    for (const m of movements) {
        if (pairedKeys.has(m.key)) continue; // placed right after its sale below instead
        rows.push({ m, paired: false });
        const refunds = m.kind === "sale" ? refundsBySale.get(m.key) : undefined;
        if (refunds) for (const r of refunds) rows.push({ m: r, paired: true });
    }
    return rows;
}

/**
 * Rows grouped under their month, newest first — mirroring the admin
 * ledger's sticky month headers. A paired refund takes its SALE's month
 * (inherits the sale's group) rather than its own refund date, same
 * rationale as the admin page: "stays in the sale's month" so a December
 * sale refunded in January doesn't fracture across two sections.
 */
function groupByMonth(
    rows: DisplayRow[],
    monthLabel: (d: Date) => string,
): { key: string; label: string; items: DisplayRow[] }[] {
    const out: { key: string; label: string; items: DisplayRow[] }[] = [];
    for (const row of rows) {
        if (row.paired) {
            const last = out[out.length - 1];
            if (last) last.items.push(row);
            continue;
        }
        const d = new Date(row.m.at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const last = out[out.length - 1];
        if (!last || last.key !== key) out.push({ key, label: monthLabel(d), items: [row] });
        else last.items.push(row);
    }
    return out;
}

type KindFilter = "all" | "sale" | "refund" | "payout" | "dispute";
type RangeFilter = "all" | "7" | "30" | "90";

function matchesFilters(m: LedgerMovement, kind: KindFilter, range: RangeFilter, query: string): boolean {
    if (kind !== "all" && m.kind !== kind) return false;
    if (range !== "all") {
        const days = Number(range);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        if (new Date(m.at).getTime() < cutoff) return false;
    }
    if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${m.buyerName ?? ""} ${m.reason ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
    }
    return true;
}

/** One cell in a CSV row — quoted, with embedded quotes doubled per RFC 4180. */
function csvCell(v: string | number): string {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
    onRefund,
}: {
    ledger: ItemLedger;
    /** Show the community's cut as its own column. */
    showCommunity?: boolean;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    /**
     * Owner-initiated refund for a sale row — distinct from the buyer's own
     * self-service refund flow, which lives entirely elsewhere and never
     * touches this component. The host supplies the transport: this package
     * has no API client of its own (see the module doc above), so which
     * endpoint gets called — the community path gated on `FINANCIAL_PAYOUTS`
     * or the member-seller path scoped to `sellerUserId` — is the host's
     * call to make based on `ledger.ownership`, not this component's.
     *
     * Resolve with `{ ok: false, error }` rather than throwing when the
     * backend's own eligibility gate refuses (already paid out, past the
     * refund window without the policy's "extended" mode, etc.) — that
     * message is shown verbatim, since the backend already writes it for a
     * host reader (e.g. "Contact Cobuntu support to process a refund").
     * Omit the prop to leave the action out entirely.
     */
    onRefund?: (saleId: string, reason: string) => Promise<{ ok: boolean; error?: string }>;
}) {
    const { movements, currency } = ledger;
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

    /* Kind / time-range / search — all client-side. The endpoint already
       returns the whole item's history in one response (see LedgerService's
       own doc comment on why this page doesn't paginate: a single item's
       ledger is nowhere near the size a community-wide one can reach), so
       filtering what's already in hand needs no round trip. */
    const [kindFilter, setKindFilter] = useState<KindFilter>("all");
    const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
    const [query, setQuery] = useState("");

    const monthLabel = (d: Date) => d.toLocaleDateString(locale, { month: "long", year: "numeric" });

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
     * Totals from the SALE rows only, and from the FULL set regardless of the
     * filters above -- a position summary that shrank because someone typed
     * into the search box would be the one number here that matters and the
     * one easiest to get wrong. Mirrors the admin ledger's summary tiles
     * (Balance owed / In escrow / Ready for payout / Paid to you), narrowed
     * to what a single item's rows can actually support: there is no "ready
     * for payout vs eligible" distinction surfaced per-row here the way the
     * admin's dedicated summary endpoint has, so ESCROW and HOLD collapse
     * into one "in escrow" figure rather than inventing a split the data
     * doesn't carry.
     */
    const sales = movements.filter((m) => m.kind === "sale");
    const refunded = movements.filter((m) => m.kind === "refund");
    /* Sale keys that already have a refund row — the refund action hides on
       these rather than ever offering a second refund the backend would
       just reject (refunds are full-only, never partial; see RefundService). */
    const refundedSaleKeys = new Set(refunded.map((m) => m.saleKey).filter((k): k is string => !!k));
    const earned = sales.reduce((n, m) => n + m.sellerNet, 0)
        - refunded.reduce((n, m) => n + m.sellerNet, 0);
    const inEscrow = sales
        .filter((m) => m.status === "ESCROW" || m.status === "HOLD")
        .reduce((n, m) => n + m.sellerNet, 0);
    const paidOut = sales
        .filter((m) => m.status === "PAID")
        .reduce((n, m) => n + m.sellerNet, 0);

    const filtered = movements.filter((m) => matchesFilters(m, kindFilter, rangeFilter, query));
    const groups = groupByMonth(buildDisplayRows(filtered), monthLabel);
    const filtersActive = kindFilter !== "all" || rangeFilter !== "all" || query.trim() !== "";

    const KIND_OPTIONS: { key: KindFilter; label: string }[] = [
        { key: "all", label: t("ledgerFilterAll") },
        { key: "sale", label: t("ledgerKind_sale") },
        { key: "refund", label: t("ledgerKind_refund") },
        { key: "payout", label: t("ledgerKind_payout") },
        { key: "dispute", label: t("ledgerKind_dispute") },
    ];
    const RANGE_OPTIONS: { key: RangeFilter; label: string }[] = [
        { key: "all", label: t("ledgerRangeAll") },
        { key: "7", label: t("ledgerRange7") },
        { key: "30", label: t("ledgerRange30") },
        { key: "90", label: t("ledgerRange90") },
    ];

    function exportCsv() {
        const header = [
            t("ledgerColMovement"), "Date", "Status", t("ledgerColGross"),
            ...(showCommunity ? [t("ledgerColCommunity")] : []),
            t("ledgerColSeller"),
        ];
        const lines = [header.map(csvCell).join(",")];
        for (const m of filtered) {
            lines.push([
                t(`ledgerKind_${m.kind}`),
                day(m.at),
                statusLabel(m.status, t),
                m.sign === -1 && !(m.kind === "dispute" && m.status === "DISPUTE_WON") ? -m.gross : m.gross,
                ...(showCommunity ? [m.communityCut] : []),
                m.sellerNet,
            ].map(csvCell).join(","));
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-[16px] font-semibold text-zinc-900">{t("ledgerTitle")}</h2>
                <button
                    type="button"
                    onClick={exportCsv}
                    className="cursor-pointer text-[12.5px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                    {t("ledgerExportCsv")}
                </button>
            </div>

            {/* Summary band, mirroring the admin ledger's SummaryTile row.
                Three tiles, not four: no per-row "ready to pay out vs still
                in escrow" split exists in this item-scoped data the way the
                admin's own summary endpoint carries it. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryTile label={t("ledgerTileEarned")} amount={cash(earned)} highlighted />
                <SummaryTile label={t("ledgerTileEscrow")} amount={cash(inEscrow)} />
                <SummaryTile label={t("ledgerTilePaidOut")} amount={cash(paidOut)} />
            </div>

            {/* Filter bar. Client-side, the same `matchesFilters` the CSV
                export reads from, so "what's on screen" and "what downloads"
                can never disagree. */}
            <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown value={kindFilter} options={KIND_OPTIONS} onChange={(k) => setKindFilter(k as KindFilter)} />
                <FilterDropdown value={rangeFilter} options={RANGE_OPTIONS} onChange={(k) => setRangeFilter(k as RangeFilter)} />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("ledgerSearchPlaceholder")}
                    className="min-w-[160px] flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-400 tabular-nums">
                    {t("ledgerMovementCount", { count: filtered.length })}
                </span>
            </div>

            {/* Wide content scrolls in its own box; the page never does. */}
            {groups.length > 0 ? (
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
                            {groups.map((g) => (
                                <Fragment key={g.key}>
                                    <tr>
                                        <td
                                            colSpan={showCommunity ? 4 : 3}
                                            className="bg-zinc-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
                                        >
                                            {g.label}
                                        </td>
                                    </tr>
                                    {g.items.map(({ m, paired }) => (
                                        <Row
                                            key={m.key}
                                            m={m}
                                            paired={paired}
                                            showCommunity={showCommunity}
                                            cash={cash}
                                            day={day}
                                            t={t}
                                            onOpen={openPanel}
                                        />
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filtersActive ? (
                <EmptyState
                    icon={<LedgerIcon />}
                    title={t("ledgerNoMatchesTitle")}
                    body={t("ledgerNoMatchesBody")}
                />
            ) : null}

            {selectedMovement && (
                <BreakdownPanel
                    m={selectedMovement}
                    visible={panelVisible}
                    cash={cash}
                    day={day}
                    dayTime={dayTime}
                    t={t}
                    onClose={closePanel}
                    onRefund={onRefund}
                    alreadyRefunded={refundedSaleKeys.has(selectedMovement.key)}
                />
            )}
        </div>
    );
}

function Row({
    m, paired, showCommunity, cash, day, t, onOpen,
}: {
    m: LedgerMovement;
    /** A refund rendered directly under its sale — indented, muted background,
     *  no repeat avatar, same treatment as the admin ledger's paired rows. */
    paired: boolean;
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

    const buyerLabel = m.buyerName || (m.kind === "sale" ? t("ledgerGuestBuyer") : null);

    /*
     * The WHOLE row opens the drawer now, not a "Fee breakdown ›" text
     * button buried in the middle of it -- same affordance the Buyers tab's
     * customer rows already use (a hover fill + a trailing chevron), rather
     * than this being the one clickable-row surface in the app that made you
     * aim for a small link instead of just clicking the row.
     */
    return (
        <tr
            onClick={expandable ? () => onOpen(m) : undefined}
            className={`border-b border-zinc-200/70 last:border-b-0 align-top transition-colors ${
                paired ? "bg-zinc-50/50" : ""
            } ${expandable ? `cursor-pointer ${paired ? "hover:bg-zinc-100/70" : "hover:bg-zinc-50"}` : ""}`}
        >
            <td className={paired ? "py-2.5 pl-10 pr-4" : "px-4 py-3"}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* No repeat avatar on a paired refund — it reads as the
                        sale's own row's continuation, not a new person. */}
                    {!paired && buyerLabel && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">
                            {initials(buyerLabel)}
                        </span>
                    )}
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
                <span className="inline-flex items-center gap-1.5">
                    {amount(m.sellerNet)}
                    {/* Decorative only -- the whole row is the click target
                        now, aria-label on the <tr> would be redundant since
                        the row's own content already reads sensibly. */}
                    {expandable && <ChevronRightIcon className="text-zinc-300" />}
                </span>
            </td>
        </tr>
    );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
            <path d="m9 6 6 6-6 6" />
        </svg>
    );
}

function SummaryTile({ label, amount, highlighted }: { label: string; amount: string; highlighted?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${highlighted ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
            <p className="text-[11.5px] text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">{amount}</p>
        </div>
    );
}

function FilterDropdown({
    value, options, onChange,
}: { value: string; options: { key: string; label: string }[]; onChange: (key: string) => void }) {
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.key === value);
    const isDefault = value === options[0]?.key;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-2 text-[12px] font-medium transition-colors ${
                    isDefault
                        ? "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                        : "border-zinc-900 bg-zinc-900/5 text-zinc-900"
                }`}
            >
                {selected?.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {open && (
                <div className="absolute top-full left-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    {options.map((o) => (
                        <button
                            key={o.key}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onChange(o.key); setOpen(false); }}
                            className={`w-full cursor-pointer px-3 py-1.5 text-left text-[12px] transition-colors ${
                                o.key === value ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
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
    m, visible, cash, day, dayTime, t, onClose, onRefund, alreadyRefunded,
}: {
    m: LedgerMovement;
    visible: boolean;
    cash: (n: number) => string;
    day: (iso: string) => string;
    dayTime: (iso: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onClose: () => void;
    onRefund?: (saleId: string, reason: string) => Promise<{ ok: boolean; error?: string }>;
    alreadyRefunded: boolean;
}) {
    const won = m.kind === "dispute" && m.status === "DISPUTE_WON";
    const negative = m.sign === -1 && !won;

    return (
        <div className="fixed inset-0 flex justify-end" style={{ zIndex: LAYERS.modal }}>
            {/*
              * LAYERS.modal (120), not z-50. The community app's left
              * sidebar sits at z-[52]/[53]/[60] -- at z-50 the backdrop
              * dimmed the page but the sidebar stayed lit and clickable
              * above it, the exact bug ModalShell was fixed for. This
              * drawer is the one view in the app that still had the old
              * number; every other overlay already takes it from here.
              */}
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
                                {initials(m.buyerName || t("ledgerGuestBuyer"))}
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
                                    {/*
                                      * The real amount, always -- even on a
                                      * member sale where Cobuntu funds this
                                      * out of its own fee rather than
                                      * deducting it from the seller
                                      * separately. "Who pays it" and "what
                                      * it cost" are different questions; the
                                      * backend now decomposes cobuntuFee so
                                      * the two lines sum correctly instead
                                      * of this one being hidden behind the
                                      * word "covered".
                                      */}
                                    <tr className="border-b border-zinc-100">
                                        <td className="px-4 py-2.5 text-zinc-500">{t("ledgerFeeStripe")}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-orange-500">
                                            {`-${cash(m.stripeFee ?? 0)}`}
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

                    {/* Sale only -- a refund/payout/dispute row has no escrow
                        window of its own to chart. */}
                    {m.kind === "sale" && <PayoutTimeline m={m} day={day} dayTime={dayTime} t={t} />}

                    {/* Document links, when one has been issued. Sale rows
                        can show an invoice; refund rows can show the credit
                        note for that specific refund. Both open in a new
                        tab -- the url is Stripe-hosted, not ours to render. */}
                    {(m.invoiceUrl || m.creditNoteUrl) && (
                        <div className="mt-6">
                            <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-3">
                                {t("ledgerDocumentsTitle")}
                            </h4>
                            <div className="flex flex-col gap-2">
                                {m.invoiceUrl && (
                                    <a
                                        href={m.invoiceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2.5 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                                    >
                                        {t("ledgerViewInvoice")}
                                        <ChevronRightIcon className="text-zinc-300" />
                                    </a>
                                )}
                                {m.creditNoteUrl && (
                                    <a
                                        href={m.creditNoteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2.5 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                                    >
                                        {t("ledgerViewCreditNote")}
                                        <ChevronRightIcon className="text-zinc-300" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Owner-initiated refund — a different feature from the
                        buyer's own self-service refund, which never reaches
                        this component. Sale rows only, and only while
                        `onRefund` is wired and this sale has no refund yet
                        (refunds are full-only; a second one would just be
                        rejected server-side, see RefundService). */}
                    {m.kind === "sale" && onRefund && !alreadyRefunded && (
                        <RefundAction m={m} t={t} onRefund={onRefund} />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * The host-initiated refund control inside the sale drawer.
 *
 * Collapsed to a single button until clicked, because most sales in this
 * drawer are never refunded — showing a reason field and a destructive
 * button by default on every sale row would make "refund" read as the
 * default action instead of the exception it is.
 *
 * The reason is required and goes straight to `onRefund`, which the host
 * forwards to the backend's own refund endpoint — the SAME endpoint that
 * already enforces eligibility (escrow-only by default, "extended" mode
 * from the item's own refund policy past that, a Cobuntu-support escalation
 * once a sale has actually been paid out). This component has no opinion on
 * any of that; it just shows whatever `error` comes back, verbatim, since
 * the backend already writes that message for a host reader.
 */
function RefundAction({
    m, t, onRefund,
}: {
    m: LedgerMovement;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onRefund: (saleId: string, reason: string) => Promise<{ ok: boolean; error?: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    /* `key` is always "sale:<id>" for a sale row — see LedgerService, which
       builds it from the same literal. Not a new field only because every
       other pairing in this view (buildDisplayRows, saleKey) already reads
       the id out of this same key rather than carrying it twice. */
    const saleId = m.key.slice("sale:".length);

    async function submit() {
        if (!reason.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        const result = await onRefund(saleId, reason.trim());
        setSubmitting(false);
        if (result.ok) setDone(true);
        else setError(result.error || t("ledgerRefundGenericError"));
    }

    if (done) {
        return (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
                {t("ledgerRefundSuccess")}
            </div>
        );
    }

    if (!open) {
        return (
            <div className="mt-6">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50"
                >
                    {t("ledgerRefundAction")}
                </button>
            </div>
        );
    }

    return (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50/40 p-4">
            <h4 className="text-[11px] font-medium text-red-600 uppercase tracking-wider mb-3">
                {t("ledgerRefundAction")}
            </h4>
            <label className="block text-[12.5px] font-medium text-zinc-700 mb-1.5">
                {t("ledgerRefundReasonLabel")}
            </label>
            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("ledgerRefundReasonPlaceholder")}
                rows={3}
                disabled={submitting}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-red-400 focus:outline-none disabled:opacity-60"
            />
            {error && (
                <p className="mt-2 text-[12.5px] text-red-600">{error}</p>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => { setOpen(false); setReason(""); setError(null); }}
                    disabled={submitting}
                    className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-60"
                >
                    {t("ledgerRefundCancel")}
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || !reason.trim()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting ? t("ledgerRefundSubmitting") : t("ledgerRefundConfirm")}
                </button>
            </div>
        </div>
    );
}

/**
 * Sale completed -> Escrow ends -> Paid out, a 3-step vertical timeline
 * mirroring the admin community ledger's exact one (same dot/line markup,
 * same three states). The admin's own comment on why this is NOT a
 * hardcoded "14-day hold": the window is per-product-type, derived from the
 * real dates -- `escrowEndsAt` is already a computed, per-sale value by the
 * time it reaches this component (see LedgerService), not guessed here.
 */
function PayoutTimeline({
    m, day, dayTime, t,
}: {
    m: LedgerMovement;
    day: (iso: string) => string;
    dayTime: (iso: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const at = (iso: string) => `${day(iso)} ${t("ledgerAtTime", { time: dayTime(iso) })}`;
    const relativeDays = (iso: string): string => {
        const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
        if (days < 0) return t("ledgerReleasingNow");
        if (days === 0) return t("ledgerReleasingToday");
        if (days === 1) return t("ledgerReleasingTomorrow");
        return t("ledgerInNDays", { count: days });
    };

    const completedAt = m.at;
    const escrowEndsAt = m.escrowEndsAt;
    const escrowDone = escrowEndsAt ? new Date(escrowEndsAt).getTime() <= Date.now() : false;
    /* No real hold: eligible essentially at purchase (an event ticket bought
       after the event already ended, so its refund window is instantly
       closed) -- a "releases in N days" note would mislead. */
    const noHold = !!(escrowEndsAt && new Date(escrowEndsAt).getTime() - new Date(completedAt).getTime() < 60000);
    const holdDays = escrowEndsAt
        ? Math.max(1, Math.round((new Date(escrowEndsAt).getTime() - new Date(completedAt).getTime()) / 86400000))
        : 0;

    /* No "refunded" step here, unlike the admin's timeline: a refund is its
       own paired row in this view (see buildDisplayRows), never a state the
       SALE movement itself carries. */
    const isPaid = m.status === "PAID";

    let step3Title: string;
    let step3Label: string;
    let step3State: "done" | "upcoming" | "pending";
    if (isPaid) {
        step3Title = t("ledgerPaidOut");
        step3Label = m.paidOutAt ? at(m.paidOutAt) : (noHold ? t("ledgerEligibleAtPurchase") : t("ledgerPaidOut"));
        step3State = "done";
    } else if (m.payoutScheduledFor) {
        step3Title = t("ledgerPayoutScheduled");
        step3Label = `${day(m.payoutScheduledFor)} (${t("ledgerNextPayoutCycle")})`;
        step3State = "upcoming";
    } else if (escrowDone) {
        step3Title = t("ledgerPayoutScheduled");
        step3Label = t("ledgerPayoutNotYetScheduled");
        step3State = "pending";
    } else {
        step3Title = t("ledgerPayoutScheduled");
        step3Label = t("ledgerAfterEscrowEnds");
        step3State = "pending";
    }

    return (
        <div className="mt-6">
            <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-3">{t("ledgerPayoutTimeline")}</h4>
            <ol className="relative pl-6">
                <TimelineRow state="done" title={t("ledgerSaleCompleted")} subtitle={at(completedAt)} />
                <TimelineRow
                    state={escrowDone ? "done" : "upcoming"}
                    title={escrowDone ? t("ledgerEscrowEnded") : t("ledgerEscrowEnds")}
                    subtitle={
                        escrowEndsAt ? (
                            <>
                                {day(escrowEndsAt)}
                                {!escrowDone && (
                                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                                        {relativeDays(escrowEndsAt)}
                                    </span>
                                )}
                                <span className="mt-0.5 block text-[11px] text-zinc-400">
                                    {noHold ? t("ledgerEligibleAtPurchase") : t("ledgerHoldAfterPurchase", { days: holdDays })}
                                </span>
                            </>
                        ) : (
                            <span className="text-zinc-400">—</span>
                        )
                    }
                />
                <TimelineRow state={step3State} title={step3Title} subtitle={step3Label} isLast />
            </ol>
        </div>
    );
}

function TimelineRow({
    state, title, subtitle, isLast,
}: {
    state: "done" | "upcoming" | "pending";
    title: string;
    subtitle: React.ReactNode;
    isLast?: boolean;
}) {
    const dotCls = state === "done"
        ? "bg-emerald-500 border-emerald-500"
        : state === "upcoming"
            ? "bg-white border-amber-500"
            : "bg-white border-zinc-300";
    const titleCls = state === "pending" ? "text-zinc-400" : "text-zinc-900";

    return (
        <li className={`relative ${isLast ? "" : "pb-4"}`}>
            {!isLast && (
                <span
                    aria-hidden="true"
                    className={`absolute -left-3 top-4 bottom-0 w-0.5 rounded-full ${state === "done" ? "bg-emerald-500" : "bg-zinc-200"}`}
                />
            )}
            <span
                aria-hidden="true"
                className={`absolute -left-[18px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-white z-10 ${dotCls}`}
            >
                {state === "done" && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </span>
            <p className={`text-[12px] font-medium ${titleCls}`}>{title}</p>
            <div className="text-[12px] text-zinc-600">{subtitle}</div>
        </li>
    );
}
