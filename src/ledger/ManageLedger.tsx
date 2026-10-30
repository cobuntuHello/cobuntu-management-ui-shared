import { Fragment, useState } from "react";
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

    return (
        <tr className={`border-b border-zinc-200/70 last:border-b-0 align-top ${paired ? "bg-zinc-50/50" : ""}`}>
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
