"use client";

/**
 * THE LISTING PAGE'S PARTS, redesigned (approved 24 Nov 2026; the design
 * canvas' "Decision bar", "Overview", "Several prices" and "Earnings" pages;
 * cobuntu-backend-monorepo docs/features/listing-page-redesign.md).
 *
 *   SectionTiles     Overview · Earnings · Negotiation, each icon its own colour
 *   DecisionBar      where it stands and the moves open now (decision.ts)
 *   OverviewSection  the manage page's Details card, read-only
 *   EarningsSection  the agreed terms, One sale, So far, then the upfront money
 *   OneSalePanel     the split of one sale: the price switcher, the ring, its
 *                    lines and what each side keeps on every price. Earnings
 *                    and the package sheet draw THE SAME panel, so what was
 *                    previewed is exactly what shows once agreed.
 *   NegotiationSection  one chat, the offers in it as small events
 *   PackageSheet     the wide sheet: packages on top, their split under them
 *
 * Every line of money comes from the server already shaped for the seat (core
 * ListingMoneyService.linesFor): who sees which Cobuntu cut is decided there,
 * never here. This file only draws the lines it was given.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CobuntuMark } from "../ui/marks";
import type { Say } from "./copy";
import { clockOf, initials, money, percent, shortDate } from "./format";
import type { Decision, MoveId } from "./decision";
import { termsLabel } from "./decision";
import { useGlide } from "./glide";
import { PackagePoints, type PackagePoint } from "./packagePoints";
import type { Parties } from "./MoneyStep";
import type { ListingTransport } from "./transport";
import type { BookingView, ListingMoney, MoneyLine, Package, Proposal, Seat, Topic } from "./types";
import { Avatar, FallbackImg, ICON, Icon, StripeGlyph, personAvatarCandidates } from "./ui";

export type SectionId = "overview" | "earnings" | "negotiation";
export const SECTIONS: SectionId[] = ["overview", "earnings", "negotiation"];

const C = { keep: "#4e9c78", comm: "#c98a6b", cob: "#e0a94e", stripe: "#b9c4d6", them: "#d9d3ca" };
const amountOf = (lines: MoneyLine[] | undefined, key: MoneyLine["key"]) => lines?.find((l) => l.key === key)?.amount ?? 0;
const has = (lines: MoneyLine[] | undefined, key: MoneyLine["key"]) => !!lines?.some((l) => l.key === key);

// ─────────────────────────────────────────────────────────────────────────────
// The tiles
// ─────────────────────────────────────────────────────────────────────────────

export interface TileState { sub: string; dot?: boolean; badge?: number }

const SECTION_ICON: Record<SectionId, string> = { overview: ICON.request, earnings: ICON.money, negotiation: ICON.talk };

export function SectionTiles({ say, active, onPick, states }: {
    say: Say; active: SectionId; onPick: (id: SectionId) => void; states: Record<SectionId, TileState>;
}) {
    const label: Record<SectionId, string> = { overview: say("secOverview"), earnings: say("secEarnings"), negotiation: say("secNegotiation") };
    return (
        <nav className="cbtl-secs" aria-label={say("secOverview") + ", " + say("secEarnings") + ", " + say("secNegotiation")}>
            {SECTIONS.map((id) => {
                const s = states[id];
                return (
                    <button type="button" key={id} className="cbtl-sec" data-sec={id} aria-current={id === active ? "page" : undefined} onClick={() => onPick(id)}>
                        <span className="cbtl-sec-ic"><Icon d={SECTION_ICON[id]} size={20} /></span>
                        <span className="cbtl-sec-text">
                            <b>{label[id]}</b>
                            <small>{s.dot && <i className="cbtl-sec-dot" aria-hidden="true" />}{s.sub}</small>
                        </span>
                        {s.badge ? <span className="cbtl-sec-badge">{s.badge}</span> : null}
                    </button>
                );
            })}
        </nav>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// The decision bar
// ─────────────────────────────────────────────────────────────────────────────

const CIRCLE = "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const MARK: Record<Decision["tone"], string> = {
    you: "M12 7.5v5.5M12 16.5v.01",
    answer: "M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7M12 17v.01",
    them: "M12 7v5l3 2",
    live: "M8 12.5l2.6 2.5L16 9.5",
    paused: "M10 9v6M14 9v6",
    closed: "M9 9l6 6M15 9l-6 6",
};

export function StatusIcon({ tone, size = 20 }: { tone: Decision["tone"]; size?: number }) {
    return (
        <span className="cbtl-si" data-tone={tone} aria-hidden="true">
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={CIRCLE} /><path d={MARK[tone]} />
            </svg>
        </span>
    );
}

export function DecisionBar({ decision, onMove, busy }: { decision: Decision; onMove: (id: MoveId) => void; busy?: boolean }) {
    return (
        <div className="cbtl-dbar" role="region" aria-label={decision.eyebrow} data-tone={decision.tone}>
            <span className="cbtl-dbar-state">
                <StatusIcon tone={decision.tone} />
                <span className="cbtl-dbar-text">
                    <span className="cbtl-dbar-eyebrow" data-tone={decision.tone}>{decision.eyebrow}</span>
                    <b>{decision.title}</b>
                    {decision.sub && <small>{decision.sub}</small>}
                </span>
            </span>
            {decision.moves.length > 0 && (
                <span className="cbtl-dbar-moves">
                    {decision.moves.map((m) => (
                        <button key={m.id + m.label} type="button" className="cbtl-dbtn"
                            data-kind={m.primary ? "primary" : m.text ? "text" : undefined}
                            disabled={m.disabled || busy} title={m.title} onClick={() => onMove(m.id)}>
                            {m.label}
                        </button>
                    ))}
                </span>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Party marks: the community, Cobuntu and Stripe square; people round; no rings
// ─────────────────────────────────────────────────────────────────────────────

export type Who = "seller" | "community" | "cobuntu" | "stripe" | "owner";

export function Mark({ who, parties, size = 28 }: { who: Who; parties: Parties; size?: number }) {
    const box = { width: size, height: size };
    if (who === "owner") {
        // The community that owns the item: square, its own icon.
        const o = parties.owner ?? parties.community;
        return <span className="cbtl-mk" data-sq="" data-pad={o.icon ? "" : undefined} style={box}>{o.icon ? <img src={o.icon} alt="" /> : <i>{initials(o.name)}</i>}</span>;
    }
    if (who === "stripe") return <span className="cbtl-mk" data-sq="" style={box}><StripeGlyph size={size} /></span>;
    if (who === "cobuntu") return <span className="cbtl-mk" data-sq="" data-pad="" style={box}><CobuntuMark size={size - 8} /></span>;
    if (who === "community") {
        const c = parties.community;
        return <span className="cbtl-mk" data-sq="" data-pad={c.icon ? "" : undefined} style={box}>{c.icon ? <img src={c.icon} alt="" /> : <i>{initials(c.name)}</i>}</span>;
    }
    const s = parties.seller;
    return <span className="cbtl-mk" style={box}><FallbackImg candidates={personAvatarCandidates(s.image, { id: s.id, usertag: s.usertag })} name={s.name} /></span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// One sale: the ring, its lines, every price
// ─────────────────────────────────────────────────────────────────────────────

type Price = { productId: string; label: string | null; gross: number; free: boolean; lines: MoneyLine[] };

/** Every price the money carries, or the one sale an older backend sends. */
export function pricesOf(m: ListingMoney | null): Price[] {
    if (!m) return [];
    if (m.prices && m.prices.length > 0) return m.prices.map((p) => ({ productId: p.productId, label: p.label, gross: p.gross, free: p.free, lines: p.lines }));
    if (m.oneSale) return [{ productId: "one", label: null, gross: m.oneSale.gross, free: false, lines: m.oneSale.lines }];
    return [];
}

/** The cheapest paid price: where One sale opens (the same one the backend's oneSale is). */
export function cheapestPaid(prices: Price[]): number {
    let at = -1;
    prices.forEach((p, i) => { if (!p.free && (at < 0 || p.gross < prices[at].gross)) at = i; });
    return at < 0 ? 0 : at;
}

export interface Row {
    key: string; who: Who; label: string; note?: string; amount: number; color: string; mine?: boolean;
    /** No figure to show yet (a commission before any package is picked): a dash, no slice. */
    blank?: boolean;
}

/** What Cobuntu takes from this stream, as the line's note: "8% of event sales". */
function cobuntuRateNote(say: Say, kind: "event" | "product", meta: PanelMeta): string | undefined {
    const pct = meta.cobuntuPct ?? (meta.platformFeeRate ? meta.platformFeeRate * 100 : null);
    if (pct == null) return undefined;
    const stream = say(kind === "event" ? "streamEvents" : "streamProducts");
    return pct === 0 ? say("lineCobuntuZero", { stream }) : say("lineCobuntuRate", { rate: percent(pct), stream });
}

/**
 * What this seat keeps, whichever way the lines are cut. A community selling
 * its own item in itself is both sides of the sale, so it keeps both shares.
 */
export function keepOf(seat: Seat, lines: MoneyLine[], parties?: Parties): number {
    if (parties?.owner && parties.listedOnOwner) {
        return seat === "seller"
            ? amountOf(lines, "keep") + amountOf(lines, "communityNet")
            : amountOf(lines, "sellerNet") + amountOf(lines, "keep");
    }
    return amountOf(lines, "keep");
}

/** The lines of one sale as this seat reads them, keep first (the ring's order). */
export function rowsFor(say: Say, seat: Seat, kind: "event" | "product", lines: MoneyLine[], parties: Parties, meta: PanelMeta, cur: string): Row[] {
    const community = parties.community.name;
    const seller = parties.owner?.name ?? parties.seller.name;
    const commission = amountOf(lines, "commission");
    const stripeRow: Row = { key: "stripe", who: "stripe", label: say("lineStripe"), note: say("lineStripeNote"), amount: amountOf(lines, "stripe"), color: C.stripe };

    /*
     * A COMMUNITY'S OWN ITEM (25 Nov 2026). "You" is the owning community,
     * and the Cobuntu line says exactly what Cobuntu takes from this stream.
     *   - listed in itself: there is no one else in the sale, so no community
     *     line at all (a community does not pay itself a commission); it keeps
     *     both shares, from either seat.
     *   - listed in ANOTHER community, read by the owner: that community and
     *     its agreed commission (none until a package is picked), and Cobuntu
     *     on the owner's own leg. The other community's side (Cobuntu's cut of
     *     its commission) is its business, read from its own seat below.
     */
    if (parties.owner && parties.listedOnOwner) {
        const cob = seat === "seller"
            ? amountOf(lines, "cobuntu") + amountOf(lines, "commissionCut")
            : amountOf(lines, "sellerFee") + amountOf(lines, "cobuntu");
        return [
            { key: "keep", who: "owner", label: say("earnYouKeep"), amount: keepOf(seat, lines, parties), color: C.keep, mine: true },
            { key: "cobuntu", who: "cobuntu", label: say("lineCobuntu"), note: cobuntuRateNote(say, kind, meta), amount: cob, color: C.cob },
            stripeRow,
        ];
    }
    if (parties.owner && seat === "seller") {
        const noTerms = meta.commissionPct === null && meta.commissionSource !== undefined && commission === 0;
        return [
            { key: "keep", who: "owner", label: say("earnYouKeep"), amount: amountOf(lines, "keep"), color: C.keep, mine: true },
            {
                key: "commission", who: "community", label: community, amount: commission, color: C.comm, blank: noTerms,
                note: noTerms ? say("lineCommissionNotYet") : say("lineCommissionNote", { rate: percent(meta.commissionPct ?? meta.rate) }),
            },
            { key: "cobuntu", who: "cobuntu", label: say("lineCobuntu"), note: cobuntuRateNote(say, kind, meta), amount: amountOf(lines, "cobuntu"), color: C.cob },
            stripeRow,
        ];
    }

    const commNote = commission === 0 && meta.rate === 0
        ? (kind === "event" ? say("lineCommissionNone") : say("lineCommissionNoneProduct"))
        : say("lineCommissionNote", { rate: percent(meta.rate) });
    const stripe: Row = { key: "stripe", who: "stripe", label: say("lineStripe"), note: say("lineStripeNote"), amount: amountOf(lines, "stripe"), color: C.stripe };
    if (seat === "seller") {
        const fee = amountOf(lines, "cobuntu");
        // A community-owned item hides nothing: its seller reads the cut of the commission too.
        const owned = has(lines, "commissionCut");
        const cut = amountOf(lines, "commissionCut");
        return [
            { key: "keep", who: "seller", label: say("earnYouKeep"), amount: amountOf(lines, "keep"), color: C.keep, mine: true },
            owned
                ? { key: "commission", who: "community", label: say("earnKeeps", { who: community }), note: commNote, amount: amountOf(lines, "communityNet"), color: C.comm }
                : { key: "commission", who: "community", label: community, note: commNote, amount: commission, color: C.comm },
            {
                key: "cobuntu", who: "cobuntu", label: say("lineCobuntu"), amount: fee + (owned ? cut : 0), color: C.cob,
                note: owned && cut > 0
                    ? say("earnCobuntuBoth", { fee: money(fee, cur), seller: say("you").toLowerCase(), cut: money(cut, cur) })
                    : meta.premium ? say("lineCobuntuPremium") : say("earnCobuntuFee"),
            },
            stripe,
        ];
    }
    // The community reads everything: Cobuntu's fee on the seller as well as its cut.
    const sellerFee = has(lines, "sellerNet") ? amountOf(lines, "sellerFee") : 0;
    const sellerAmount = has(lines, "sellerNet") ? amountOf(lines, "sellerNet") : amountOf(lines, "seller");
    const cut = amountOf(lines, "cobuntu");
    const cobNote = sellerFee > 0
        ? say("earnCobuntuBoth", { fee: money(sellerFee, cur), seller, cut: money(cut, cur) })
        : cut === 0 && meta.platformFeeRate === 0 ? say("lineCobuntuNone", { community }) : say("earnCobuntuCut", { cut: money(cut, cur) });
    return [
        { key: "keep", who: "community", label: say("earnKeeps", { who: community }), note: commission === 0 ? commNote : undefined, amount: amountOf(lines, "keep"), color: C.keep, mine: true },
        { key: "seller", who: parties.owner ? "owner" : "seller", label: seller, note: say("earnSellerKeeps"), amount: sellerAmount, color: C.them },
        { key: "cobuntu", who: "cobuntu", label: say("lineCobuntu"), note: cobNote, amount: sellerFee + cut, color: C.cob },
        stripe,
    ];
}

const CIRC = 2 * Math.PI * 80;

/**
 * The amount in a ring's hole, sized to fit it. The hole is about 0.57 of the
 * ring's width; "€6.90" keeps the full 20px, "US$3,997.00" steps down until it
 * sits inside instead of running over the wedges (seen live on a USD 3,997
 * programme, 24 Nov 2026). Money keeps all its decimals; only the size gives.
 */
export function holeFontSize(text: string, ringSize: number): number {
    const room = ringSize * 0.52;
    return Math.max(11, Math.min(20, Math.floor(room / (Math.max(1, text.length) * 0.6))));
}

export function Ring({ rows, gross, center, sub, size = 176 }: { rows: Row[]; gross: number; center: string; sub: string; size?: number }) {
    const total = Math.max(1, gross);
    const parts = rows.filter((r) => r.amount > 0);
    const gap = parts.length > 1 ? 2 : 0;
    let at = 0;
    return (
        <span className="cbtl-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true">
                <circle cx="120" cy="120" r="80" fill="none" stroke="var(--cbtl-line-soft)" strokeWidth="24" />
                <g transform="rotate(-90 120 120)" fill="none" strokeWidth="24">
                    {parts.map((r) => {
                        const len = (r.amount / total) * CIRC;
                        const el = <circle key={r.key} cx="120" cy="120" r="80" stroke={r.color} strokeDasharray={`${Math.max(0, len - gap)} ${CIRC}`} strokeDashoffset={-at} />;
                        at += len;
                        return el;
                    })}
                </g>
            </svg>
            <span className="cbtl-ring-hole"><b style={{ fontSize: holeFontSize(center, size) }}>{center}</b><small>{sub}</small></span>
        </span>
    );
}

export interface PanelMeta {
    rate: number; premium: boolean; platformFeeRate: number;
    /** Cobuntu's rate on this stream, percent (ListingMoney.rates); works for a free item too. */
    cobuntuPct?: number | null;
    /** The commission terms, percent; null when none are agreed or offered yet. */
    commissionPct?: number | null;
    commissionSource?: "agreed" | "matrix" | "proposed" | "none";
}

/** The panel's rates, from the money read: the sale preview's, else the rates sent for a free item. */
export function metaOf(m: ListingMoney | null, termsRate: number | null): PanelMeta {
    const one = m?.oneSale ?? null;
    const r = m?.rates ?? null;
    return {
        rate: one?.commissionRate ?? termsRate ?? r?.commissionPct ?? 0,
        premium: !!one?.sellerPremium,
        platformFeeRate: one?.platformFeeRate ?? (r ? r.cobuntuPct / 100 : 0),
        cobuntuPct: r?.cobuntuPct ?? (one ? one.platformFeeRate * 100 : null),
        commissionPct: r ? r.commissionPct : one ? (one.rateSource === "none" ? null : one.commissionRate) : termsRate,
        commissionSource: r?.commissionSource ?? one?.rateSource,
    };
}

/**
 * ONE SALE. The same panel in Earnings and in the package sheet. With several
 * prices a switcher picks which one the ring and lines show; a column says
 * what this seat keeps on every price. Donations follow their own rule
 * (finances' calculateDonationSplit), so they are a line under it, never a
 * slice of the ring.
 */
export function OneSalePanel({ say, seat, kind, m, parties, meta, title, subtitle, blurred, glide }: {
    say: Say; seat: Seat; kind: "event" | "product"; m: ListingMoney; parties: Parties; meta: PanelMeta;
    title: string; subtitle?: string; blurred?: ReactNode;
    /**
     * When `m` is replaced (Change terms re-prices the split at every click),
     * the amounts count to their new values and the ring's slices follow,
     * instead of the panel snapping as if it reloaded. Off everywhere else.
     */
    glide?: boolean;
}) {
    const prices = useMemo(() => pricesOf(m), [m]);
    const [picked, setPicked] = useState(() => cheapestPaid(prices));
    useEffect(() => { setPicked(cheapestPaid(prices)); }, [prices]);
    const cur = m.currency;
    const p = prices[picked] ?? prices[0];
    // Every amount below (lines, notes, the ring) reads these, so they glide together.
    const rawLines = p && !p.free ? p.lines : [];
    const glided = useGlide(Object.fromEntries(rawLines.map((l) => [l.key, l.amount])), !!glide);
    if (!p) return null;
    const lines = rawLines.map((l) => ({ ...l, amount: glided[l.key] ?? l.amount }));
    const paid = prices.filter((x) => !x.free);
    const rows = p.free ? [] : rowsFor(say, seat, kind, lines, parties, meta, cur);
    const community = parties.community.name;
    const labelOf = (x: Price) => x.label ?? (kind === "event" ? say("earnOneTicket") : say("earnOneSale"));

    const donation = m.donation ?? null;
    let donationText = "";
    if (donation) {
        const dl = donation.lines;
        const amount = money(donation.amount, cur);
        if (parties.owner && parties.listedOnOwner) {
            donationText = say("earnDonationSellerNoComm", { amount, keep: money(keepOf(seat, dl, parties), cur) });
        } else if (seat === "seller") {
            donationText = amountOf(dl, "commission") > 0
                ? say("earnDonationSeller", { amount, keep: money(amountOf(dl, "keep"), cur), community })
                : say("earnDonationSellerNoComm", { amount, keep: money(amountOf(dl, "keep"), cur) });
        } else {
            donationText = say("earnDonationCommunity", {
                amount, community, keep: money(amountOf(dl, "keep"), cur), seller: parties.seller.name,
                theirs: money(has(dl, "sellerNet") ? amountOf(dl, "sellerNet") : amountOf(dl, "seller"), cur),
            });
        }
    }

    const body = (
        <div className="cbtl-panel">
            <span className="cbtl-panel-head">
                <span className="cbtl-panel-title"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
                {prices.length > 1 && (
                    <span className="cbtl-seg" role="group" aria-label={say("ovPrice")}>
                        {prices.map((x, i) => (
                            <button key={x.productId + i} type="button" aria-pressed={i === picked} onClick={() => setPicked(i)}>
                                {labelOf(x)}<b>{x.free ? say("free") : money(x.gross, cur)}</b>
                            </button>
                        ))}
                    </span>
                )}
            </span>
            {p.free ? (
                <span className="cbtl-panel-free">{say("earnNothingToSplit")}</span>
            ) : (
                <div className="cbtl-panel-body" data-every={paid.length > 1 ? "" : undefined}>
                    <Ring rows={rows} gross={p.gross} center={money(p.gross, cur)} sub={labelOf(p)} />
                    <span className="cbtl-lines">
                        {rows.map((r) => (
                            <span className="cbtl-line" data-mine={r.mine ? "" : undefined} key={r.key}>
                                <i className="cbtl-sw" style={{ background: r.color }} aria-hidden="true" />
                                <Mark who={r.who} parties={parties} />
                                <span className="cbtl-line-name"><b>{r.label}</b>{r.note && <small>{r.note}</small>}</span>
                                <b className="cbtl-line-amt">{r.blank ? "—" : money(r.amount, cur)}</b>
                            </span>
                        ))}
                    </span>
                    {paid.length > 1 && (
                        <span className="cbtl-every">
                            <span className="cbtl-kicker">{seat === "seller" ? say("earnYouKeepEvery") : say("earnKeepsEvery", { who: community })}</span>
                            {prices.map((x, i) => (
                                <button key={x.productId + i} type="button" className="cbtl-every-row" aria-current={i === picked ? "true" : undefined} onClick={() => setPicked(i)}>
                                    <span>{labelOf(x)} · {x.free ? say("free") : money(x.gross, cur)}</span>
                                    <b>{x.free ? say("earnNothingToSplit") : money(keepOf(seat, x.lines, parties), cur)}</b>
                                </button>
                            ))}
                        </span>
                    )}
                </div>
            )}
            {donationText && (
                <span className="cbtl-donation">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                    <span>{donationText}</span>
                </span>
            )}
        </div>
    );
    if (!blurred) return body;
    return (
        <span className="cbtl-blurwrap">
            <span className="cbtl-blur" aria-hidden="true">{body}</span>
            {blurred}
        </span>
    );
}

/** Every line a seat reads, at zero: the shape of the split with nothing in it. */
function zeroLines(seat: Seat): MoneyLine[] {
    const keys: MoneyLine["key"][] = seat === "seller"
        ? ["price", "stripe", "commission", "cobuntu", "keep", "commissionCut", "communityNet"]
        : ["price", "stripe", "seller", "sellerFee", "sellerNet", "commission", "cobuntu", "keep"];
    return keys.map((key) => ({ key, amount: 0 }));
}

/**
 * THE SPLIT'S PLACEHOLDER (the canvas' "Earnings, no package agreed yet",
 * 24 Nov 2026): the same panel as One sale, drawn empty. A dashed ring and
 * every party's line with its real mark, so the shape of the split is
 * clear even when there is nothing in it.
 *   free      every line at 0.00, "Free" in the ring
 *   no terms  the lines without figures (grey bars), Pick a package below
 */
function PlaceholderPanel({ say, seat, kind, parties, meta, cur, title, center, sub, zero, foot, action }: {
    say: Say; seat: Seat; kind: "event" | "product"; parties: Parties; meta: PanelMeta; cur: string;
    title: string; center: string; sub: string;
    /** Show 0.00 on every line (free); otherwise grey bars (nothing agreed yet). */
    zero: boolean;
    foot: string; action?: ReactNode;
}) {
    const rows = rowsFor(say, seat, kind, zeroLines(seat), parties, meta, cur);
    return (
        <div className="cbtl-panel" data-placeholder="">
            <span className="cbtl-panel-head"><span className="cbtl-panel-title"><b>{title}</b></span></span>
            <div className="cbtl-panel-body">
                <span className="cbtl-ring" style={{ width: 176, height: 176 }}>
                    <svg width="176" height="176" viewBox="0 0 240 240" aria-hidden="true">
                        <circle cx="120" cy="120" r="80" fill="none" stroke="var(--cbtl-line)" strokeWidth="24" strokeDasharray="6 8" />
                    </svg>
                    <span className="cbtl-ring-hole"><b style={{ fontSize: holeFontSize(center, 176) }}>{center}</b><small>{sub}</small></span>
                </span>
                <span className="cbtl-lines">
                    {rows.map((r) => (
                        <span className="cbtl-line" data-mine={r.mine ? "" : undefined} key={r.key}>
                            <i className="cbtl-sw" aria-hidden="true" />
                            <Mark who={r.who} parties={parties} />
                            <span className="cbtl-line-name"><b>{r.label}</b>{(zero || r.who === "cobuntu") && r.note && <small>{r.note}</small>}</span>
                            {r.blank ? <b className="cbtl-line-amt">—</b> : zero ? <b className="cbtl-line-amt">{money(0, cur)}</b> : <i className="cbtl-ghost" aria-hidden="true" />}
                        </span>
                    ))}
                </span>
            </div>
            <span className="cbtl-panel-foot"><span>{foot}</span>{action}</span>
        </div>
    );
}

/** "€0.55 to €1.92", or one figure when every price leaves the same. */
export function keepRange(say: Say, m: ListingMoney | null): string {
    const paid = pricesOf(m).filter((p) => !p.free).map((p) => amountOf(p.lines, "keep"));
    if (paid.length === 0 || !m) return "";
    const lo = Math.min(...paid), hi = Math.max(...paid);
    return lo === hi ? money(lo, m.currency) : say("pkRange", { low: money(lo, m.currency), high: money(hi, m.currency) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Earnings
// ─────────────────────────────────────────────────────────────────────────────

export interface Terms { name: string | null; rate: number | null; sub: string }

export function EarningsSection({ say, seat, kind, m, parties, terms, onPickPackage, onChangePackage, points, links, children }: {
    say: Say; seat: Seat; kind: "event" | "product"; m: ListingMoney | null; parties: Parties; terms: Terms;
    /** Shown on the empty state while the request is open. */
    onPickPackage?: () => void;
    /** The seller moves their listing onto another of their packages (T-415): a button on the terms card. */
    onChangePackage?: () => void;
    /** What the package they are on means, as a checklist (its description). */
    points?: PackagePoint[];
    links?: { payouts?: string; ledger?: string };
    /** The upfront money, the result and the Premium card (MoneyStep's parts), below. */
    children?: ReactNode;
}) {
    if (!m) return <p className="cbtl-hint">{say("moneyUnavailable")}</p>;
    const community = parties.community.name;
    const seller = parties.seller.name;
    const one = m.oneSale;
    const prices = pricesOf(m);
    const anyPaid = prices.some((p) => !p.free);
    // A community selling its own item in itself needs no terms: nobody else takes a commission.
    const selfOwned = !!parties.owner && !!parties.listedOnOwner;
    const noTerms = !!one && one.rateSource === "none" && terms.rate == null && !selfOwned;
    const cur = m.currency;
    const meta: PanelMeta = metaOf(m, terms.rate);
    const unit = kind === "event" ? say("unitTicket") : say("unitSale");
    const termsText = termsLabel(say, terms.rate ?? one?.commissionRate ?? null, terms.name, kind);
    // TEJÁ takes no commission on event tickets: its view stays drawn, blurred, with the reason on top.
    const noComm = seat === "community" && kind === "event" && !!one && amountOf(one.lines, "commission") === 0 && !parties.owner;

    let main: ReactNode;
    if (!anyPaid) {
        main = (
            <PlaceholderPanel say={say} seat={seat} kind={kind} parties={parties} meta={meta} cur={cur} zero
                title={kind === "event" ? say("earnOneTicket") : say("earnOneSale")}
                center={say("earnFreeTitle")} sub={say("earnNothingToSplit")} foot={say("earnFreeBody")} />
        );
    } else if (noTerms) {
        main = (
            <PlaceholderPanel say={say} seat={seat} kind={kind} parties={parties} meta={meta} cur={cur} zero={false}
                title={say("earnEmptyTitle")}
                center={money(prices[cheapestPaid(prices)].gross, cur)} sub={kind === "event" ? say("earnOneTicket") : say("earnOneSale")}
                foot={seat === "seller" ? say("earnEmptySeller", { community }) : say("earnEmptyCommunity", { seller, community })}
                action={onPickPackage ? <button type="button" className="cbtl-hbtn" onClick={onPickPackage}>{say("barPickPackage")}</button> : undefined} />
        );
    } else {
        main = (
            <OneSalePanel say={say} seat={seat} kind={kind} m={m} parties={parties} meta={meta}
                title={kind === "event" ? say("earnOneTicket") : say("earnOneSale")}
                subtitle={termsText ? say("earnHowSplits", { unit, terms: termsText }) : undefined}
                blurred={noComm ? <span className="cbtl-overlay"><span className="cbtl-overlay-card"><i>0%</i><b>{say("noCommissionOverlay", { community })}</b></span></span> : undefined} />
        );
    }

    const sold = m.live ? m.soldSoFar : null;
    return (
        <div className="cbtl-earn">
            {!noTerms && anyPaid && terms.rate != null && !(parties.owner && parties.listedOnOwner) && (
                <div className="cbtl-terms">
                    <span className="cbtl-terms-ic" aria-hidden="true"><Icon d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" size={20} /></span>
                    <span className="cbtl-terms-text">
                        <span className="cbtl-terms-top">
                            {terms.name && <b>{terms.name}</b>}
                            <strong>{terms.rate === 0 ? "0%" : percent(terms.rate)}</strong>
                            <small>{say("earnCommission")}</small>
                        </span>
                        <span>{[terms.sub, seat === "community" && one && one.platformFeeRate > 0 ? say("earnCobuntuShare", { rate: percent(one.platformFeeRate * 100) }) : ""].filter(Boolean).join(" ")}</span>
                        {points && points.length > 0 && <PackagePoints points={points} />}
                    </span>
                    {onChangePackage
                        ? <button type="button" className="cbtl-hbtn cbtl-terms-btn" onClick={onChangePackage}><Icon d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" size={15} stroke={2} />{say("chgMove")}</button>
                        : <span className="cbtl-terms-marks" aria-hidden="true"><Mark who={parties.owner ? "owner" : "seller"} parties={parties} size={30} /><Mark who="community" parties={parties} size={30} /></span>}
                </div>
            )}
            {sold && sold.count > 0 && <SoFar say={say} seat={seat} m={m} parties={parties} links={links} />}
            {main}
            {children}
        </div>
    );
}

function SoFar({ say, seat, m, parties, links }: { say: Say; seat: Seat; m: ListingMoney; parties: Parties; links?: { payouts?: string; ledger?: string } }) {
    const s = m.soldSoFar!;
    const cur = m.currency;
    const l = s.lines;
    const community = parties.community.name;
    const selfOwned = !!parties.owner && !!parties.listedOnOwner;
    const stats: Array<{ label: string; amount: number; keep?: boolean }> = selfOwned
        ? [
            // A community selling its own item: everything but Stripe and Cobuntu is its own.
            { label: say("earnInSales"), amount: amountOf(l, "price") },
            {
                label: say("earnStripeCobuntu"),
                amount: amountOf(l, "stripe") + (seat === "seller"
                    ? amountOf(l, "cobuntu") + amountOf(l, "commissionCut")
                    : amountOf(l, "sellerFee") + amountOf(l, "cobuntu")),
            },
            { label: say("earnYouKept"), amount: keepOf(seat, l, parties), keep: true },
        ]
        : seat === "seller" && parties.owner
        ? [
            // A community's item in another community: that community's commission, Cobuntu on the owner's own leg.
            { label: say("earnInSales"), amount: amountOf(l, "price") },
            { label: say("earnTook", { who: community }), amount: amountOf(l, "commission") },
            { label: say("earnStripeCobuntu"), amount: amountOf(l, "stripe") + amountOf(l, "cobuntu") },
            { label: say("earnYouKept"), amount: amountOf(l, "keep"), keep: true },
        ]
        : seat === "seller"
        ? [
            { label: say("earnInSales"), amount: amountOf(l, "price") },
            { label: say("earnTook", { who: community }), amount: has(l, "communityNet") ? amountOf(l, "communityNet") : amountOf(l, "commission") },
            { label: say("earnStripeCobuntu"), amount: amountOf(l, "stripe") + amountOf(l, "cobuntu") + amountOf(l, "commissionCut") },
            { label: say("earnYouKept"), amount: amountOf(l, "keep"), keep: true },
        ]
        : [
            { label: say("earnInSales"), amount: amountOf(l, "price") },
            { label: parties.owner?.name ?? parties.seller.name, amount: has(l, "sellerNet") ? amountOf(l, "sellerNet") : amountOf(l, "seller") },
            { label: say("earnStripeCobuntu"), amount: amountOf(l, "stripe") + amountOf(l, "cobuntu") + (has(l, "sellerNet") ? amountOf(l, "sellerFee") : 0) },
            { label: say("earnKept", { who: community }), amount: amountOf(l, "keep"), keep: true },
        ];
    const link = seat === "seller" ? (links?.payouts ? { href: links.payouts, label: say("seePayouts") } : null) : (links?.ledger ? { href: links.ledger, label: say("openLedger") } : null);
    return (
        <section className="cbtl-sofar" aria-label={say("earnSoFar")}>
            <span className="cbtl-panel-head">
                <span className="cbtl-panel-title"><b>{say("earnSoFar")}</b><small>{say("earnSoFarSub", { count: s.count })}</small></span>
                {link && <a className="cbtl-link" href={link.href}>{link.label}</a>}
            </span>
            <span className="cbtl-stats4">
                {stats.map((x) => (
                    <span className="cbtl-stat4" data-keep={x.keep ? "" : undefined} key={x.label}><small>{x.label}</small><b>{money(x.amount, cur)}</b></span>
                ))}
            </span>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview: the manage page's Details card, read-only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every photo of the item, banner first: the product's media list (where many
 * products keep their photos ONLY), then the legacy banner and card fields,
 * then an event's own images. Same order as the manage page's Details card.
 */
export function imagesOf(item: any): string[] {
    const out: string[] = [];
    const push = (v: unknown) => { if (typeof v === "string" && v && !out.includes(v)) out.push(v); };
    const media = [...(item?.product_media ?? [])]
        .filter((m: any) => m?.url && (!m.mimeType || /^image\//i.test(String(m.mimeType))))
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const banner = media.find((m: any) => m.isBanner) ?? media[0];
    if (banner) push(banner.url);
    push(item?.cardImageUrl); push(item?.bannerImageUrl);
    for (const m of media) push(m.url);
    push(item?.bannerUrl); push(item?.coverImage); push(item?.imageUrl); push(item?.image);
    for (const x of [...(item?.images ?? []), ...(item?.media ?? []), ...(item?.gallery ?? [])]) {
        if (typeof x === "string") push(x);
        else if (x && (!x.type || /image/i.test(String(x.type)))) push(x.url ?? x.imageUrl ?? x.src);
    }
    return out;
}

/** "17 Nov 2026, 13:25": when it was sent, to the minute. */
export function sentAt(iso: string | null | undefined, tz?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(tz ? { timeZone: tz } : {}) });
    return `${day}, ${clockOf(iso, tz)}`;
}

/** A description may arrive as HTML from the editor: read it as plain paragraphs, never as markup. */
function paragraphsOf(text: unknown): string[] {
    if (typeof text !== "string" || !text.trim()) return [];
    const plain = text
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
    return plain.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function namesOf(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x: any) => (typeof x === "string" ? x : x?.name ?? x?.tag?.name ?? x?.label ?? "")).filter(Boolean);
}

const ROW_ICON = {
    name: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6",
    price: "M17.5 6.5a6.5 6.5 0 1 0 0 11M4 10.5h9M4 13.5h9",
    date: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
    category: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    tags: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
    value: "M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13",
    person: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    sent: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
    room: ICON.room,
};

function InfoRow({ icon, label, children, muted }: { icon: string; label?: string; children: ReactNode; muted?: boolean }) {
    return (
        <span className="cbtl-irow">
            <span className="cbtl-irow-ic" aria-hidden="true"><Icon d={icon} size={16} stroke={2} /></span>
            <span className="cbtl-irow-v">{label && <small>{label}</small>}<b data-muted={muted ? "" : undefined}>{children}</b></span>
        </span>
    );
}

export function OverviewSection({ say, kind, item, m, listingPrice, owner, createdAt, tz, booking, room, facts, onChangeRequest }: {
    say: Say; kind: "event" | "product"; item: any; m: ListingMoney | null;
    listingPrice?: { amount: number; currency: string } | null;
    /**
     * Whose item it is: the community for a community-owned item (its square
     * icon), else the member. Never the collaborator who happened to send the
     * request (seen live: "Buntu" on Finance Social Club's own event).
     */
    owner: null | { community: boolean; name: string; id?: string | null; usertag?: string | null; image?: string | null };
    createdAt?: string | null; tz?: string; booking: BookingView | null; room: string | null;
    /** What the seller told the venue, grouped: [title, [label, value][]][]. */
    facts: Array<{ title: string; rows: Array<[string, unknown]> }>;
    onChangeRequest?: () => void;
}) {
    const images = imagesOf(item);
    const [at, setAt] = useState(0);
    const cur = m?.currency ?? listingPrice?.currency ?? "EUR";
    const prices = pricesOf(m);
    const paid = prices.filter((p) => !p.free);
    const single = m?.oneSale?.gross ?? (listingPrice ? Math.round(listingPrice.amount * (String(cur).toUpperCase() === "JPY" ? 1 : 100)) : null);
    const priceText = prices.length > 1 && paid.length > 0
        ? say("ovPrices", { count: prices.length, price: money(Math.min(...paid.map((p) => p.gross)), cur) })
        : single ? money(single, cur) : say("free");
    const category = [
        item?.category?.name ?? item?.categoryName,
        item?.subcategory?.name ?? item?.subCategory?.name ?? item?.subCategoryName,
    ].filter(Boolean).join(" › ");
    const tags = namesOf(item?.tags);
    const valueLines: Array<{ value?: number }> = Array.isArray(item?.valueLines) ? item.valueLines : [];
    const valueTotal = valueLines.reduce((s, l) => s + (Number(l?.value) || 0), 0);
    const when = kind === "event" && item?.startDate
        ? `${new Date(item.startDate).toLocaleDateString("en-GB", { weekday: "short", ...(tz ? { timeZone: tz } : {}) })} ${shortDate(item.startDate, tz)}, ${clockOf(item.startDate, tz)}${item?.endDate ? ` to ${clockOf(item.endDate, tz)}` : ""}`
        : "";
    const paras = paragraphsOf(item?.description);
    const shownFacts = facts.map((g) => ({ ...g, rows: g.rows.filter(([, v]) => v && (!Array.isArray(v) || v.length)) })).filter((g) => g.rows.length);

    /*
     * THE HIERARCHY (24 Nov 2026): the header names it; then the facts, as
     * rows on the page beside the photos (no box around them: boxes are for
     * what you act on, the tiles and the bar); then the long-form description
     * under its own heading, read like an article; then, for a venue booking,
     * its own headed sections. The name is not repeated: the title says it.
     */
    return (
        <div className="cbtl-ov">
            <div className="cbtl-ov-top">
                <div className="cbtl-ov-media">
                    <div className="cbtl-ov-photo">
                        {images.length > 0 ? <img src={images[at] ?? images[0]} alt={item?.name ?? ""} /> : <Icon d={ICON.request} size={40} stroke={1.3} />}
                        {images.length > 1 && (
                            <>
                                <span className="cbtl-ov-count"><Icon d="M3 3h18v18H3zM8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM21 15l-5-5L5 21" size={12} stroke={2} />{say("ovPhotoCount", { n: at + 1, count: images.length })}</span>
                                <button type="button" className="cbtl-ov-arrow" data-side="prev" aria-label={say("ovPrev")} onClick={() => setAt((at - 1 + images.length) % images.length)}><Icon d="M15 18l-6-6 6-6" size={14} stroke={2.2} /></button>
                                <button type="button" className="cbtl-ov-arrow" data-side="next" aria-label={say("ovNext")} onClick={() => setAt((at + 1) % images.length)}><Icon d="M9 18l6-6-6-6" size={14} stroke={2.2} /></button>
                            </>
                        )}
                    </div>
                    {images.length > 1 && (
                        <span className="cbtl-ov-thumbs">
                            {images.map((src, i) => (
                                <button type="button" key={src} className="cbtl-ov-thumb" aria-current={i === at ? "true" : undefined} aria-label={say("ovPhotoCount", { n: i + 1, count: images.length })} onClick={() => setAt(i)}>
                                    <img src={src} alt="" />
                                </button>
                            ))}
                        </span>
                    )}
                </div>
                <div className="cbtl-ov-rows">
                    <InfoRow icon={ROW_ICON.price} label={say("ovPrice")}>{priceText}</InfoRow>
                    {when && <InfoRow icon={ROW_ICON.date} label={say("ovDate")}>{when}</InfoRow>}
                    <InfoRow icon={ROW_ICON.category} label={say("ovCategory")} muted={!category}>{category || say("ovNoCategory")}</InfoRow>
                    <InfoRow icon={ROW_ICON.tags} label={say("ovTags")} muted={tags.length === 0}>{tags.length ? tags.join(", ") : say("ovNoTags")}</InfoRow>
                    {valueLines.length > 0 && (
                        <InfoRow icon={ROW_ICON.value} label={say("ovValue")}>
                            {valueLines.length === 1 ? say("ovValueLine", { total: money(valueTotal, cur) }) : say("ovValueLines", { count: valueLines.length, total: money(valueTotal, cur) })}
                        </InfoRow>
                    )}
                    {createdAt && <InfoRow icon={ROW_ICON.sent} label={say("ovSent")}>{sentAt(createdAt)}</InfoRow>}
                    {owner?.name && (
                        <span className="cbtl-irow">
                            <span className="cbtl-irow-ic" aria-hidden="true"><Icon d={ROW_ICON.person} size={16} stroke={2} /></span>
                            <span className="cbtl-irow-v">
                                <small>{say("ovOwner")}</small>
                                <span className="cbtl-irow-person">
                                    {owner.community
                                        ? <span className="cbtl-mk" data-sq="" data-pad={owner.image ? "" : undefined} style={{ width: 24, height: 24 }}>{owner.image ? <img src={owner.image} alt="" /> : <i>{initials(owner.name)}</i>}</span>
                                        : <Avatar image={owner.image} name={owner.name} size={24} person={{ id: owner.id, usertag: owner.usertag }} />}
                                    <b>{owner.name}</b>
                                    {owner.usertag && <small>@{owner.usertag}</small>}
                                </span>
                            </span>
                        </span>
                    )}
                </div>
            </div>

            {paras.length > 0 && (
                <section className="cbtl-ov-sec" aria-label={say("ovDescription")}>
                    <h3 className="cbtl-ov-h">{say("ovDescription")}</h3>
                    <div className="cbtl-ov-prose">{paras.map((t, i) => <p key={i}>{t}</p>)}</div>
                </section>
            )}

            {booking && (
                <section className="cbtl-ov-sec" aria-label={say("ovBooking")}>
                    <span className="cbtl-ov-sec-head">
                        <h3 className="cbtl-ov-h">{say("ovBooking")}</h3>
                        {onChangeRequest && <button type="button" className="cbtl-hbtn" onClick={onChangeRequest}>{say("changeRequest")}</button>}
                    </span>
                    <span className="cbtl-ov-facts">
                        <InfoRow icon={ROW_ICON.room}>{say("ovRoomTotal", { room: room || say("upRoom"), amount: money(booking.totalAmountCents, booking.currency) })}</InfoRow>
                        {booking.guestCount ? <InfoRow icon={ROW_ICON.person}>{say("ovGuests", { count: booking.guestCount })}</InfoRow> : null}
                    </span>
                </section>
            )}

            {shownFacts.map((g) => (
                <section className="cbtl-ov-sec" key={g.title} aria-label={g.title}>
                    <h3 className="cbtl-ov-h">{g.title}</h3>
                    <div className="cbtl-facts">
                        {g.rows.map(([k, v]) => <span className="cbtl-fact" key={k}><small>{k}</small><span>{Array.isArray(v) ? v.join(", ") : String(v)}</span></span>)}
                    </div>
                </section>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Negotiation: one chat
// ─────────────────────────────────────────────────────────────────────────────

type ChatItem =
    | { type: "msg"; id: string; at: number | null; mine: boolean; body: string; name: string; image: string | null; person: { id?: string | null; usertag?: string | null } }
    | { type: "event"; id: string; at: number | null; text: string };

const ts = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const n = Date.parse(iso);
    return Number.isFinite(n) ? n : null;
};

/** Every topic's messages and every offer, in one stream, in time order. */
export function chatItems(say: Say, a: {
    seat: Seat; kind: "event" | "product"; topics: Topic[]; proposals: Proposal[]; sellerId: string | null; meId: string | null;
    names: { community: string; seller: string }; other: { name: string; image?: string | null }; me?: { name?: string | null; avatarUrl?: string | null };
}): ChatItem[] {
    const items: ChatItem[] = [];
    const isMine = (author: string) => a.meId ? author === a.meId : a.seat === "seller" ? author === a.sellerId : author !== a.sellerId;
    for (const t of a.topics) {
        for (const c of t.comments) {
            const mine = isMine(c.authorUserId);
            items.push({
                type: "msg", id: c.id, at: ts(c.createdAt), mine, body: c.body,
                name: mine ? (a.me?.name ?? say("you")) : (c.author?.name ?? a.other.name),
                image: mine ? (a.me?.avatarUrl ?? null) : (c.author?.profileImage ?? null),
                person: { id: c.author?.id ?? c.authorUserId, usertag: c.author?.usertag ?? null },
            });
        }
    }
    for (const p of a.proposals) {
        const by = p.proposedByUserId ?? p.proposedByUser?.id ?? p.proposedBy?.id ?? null;
        const who = by && a.sellerId && by === a.sellerId ? a.names.seller : a.names.community;
        const terms = termsLabel(say, Number(p.commissionRate ?? 0), p.package?.name ?? null, a.kind);
        const text = p.status === "ACCEPTED" ? say("chatAgreed", { terms }) : p.status === "REJECTED" ? say("chatDeclined", { terms }) : say("chatOffered", { who, terms });
        items.push({ type: "event", id: `p-${p.id}`, at: ts(p.createdAt), text });
    }
    // Stable: undated items keep their place after the dated ones.
    return items.map((x, i) => ({ x, i })).sort((p, q) => {
        if (p.x.at == null && q.x.at == null) return p.i - q.i;
        if (p.x.at == null) return 1;
        if (q.x.at == null) return -1;
        return p.x.at - q.x.at || p.i - q.i;
    }).map((y) => y.x);
}

export function NegotiationSection({ say, seat, kind, topics, proposals, sellerId, me, other, names, transport, after }: {
    say: Say; seat: Seat; kind: "event" | "product"; topics: Topic[]; proposals: Proposal[]; sellerId: string | null;
    me?: { id?: string | null; name?: string | null; avatarUrl?: string | null };
    other: { name: string; image?: string | null }; names: { community: string; seller: string };
    transport: ListingTransport; after: (m?: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const list = useRef<HTMLDivElement>(null);
    const items = chatItems(say, { seat, kind, topics, proposals, sellerId, meId: me?.id ?? null, names, other, me });
    useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [items.length]);

    const send = useCallback(async () => {
        const text = draft.trim();
        if (!text || busy) return;
        setBusy(true); setError("");
        try {
            // A reply goes to the newest open thread; with none, the first message opens one.
            const open = topics.filter((t) => t.status === "OPEN");
            const target = open[open.length - 1];
            if (target) await transport.comment(target.id, text);
            else await transport.openTopic({ subject: say("chatSubject"), body: text });
            setDraft("");
            await after();
        } catch (e: any) {
            setError(e?.message || say("failed"));
        } finally {
            setBusy(false);
        }
    }, [after, busy, draft, say, topics, transport]);

    let lastDay = "";
    const today = shortDate(new Date().toISOString());
    return (
        <div className="cbtl-chat">
            <div className="cbtl-chat-list" ref={list}>
                {items.length === 0 && <p className="cbtl-chat-empty">{say("chatEmpty", { who: other.name })}</p>}
                {items.map((x) => {
                    const day = x.at ? shortDate(new Date(x.at).toISOString()) : "";
                    const divider = day && day !== lastDay ? <span className="cbtl-chat-day" key={`d-${x.id}`}>{day === today ? say("chatToday") : day}</span> : null;
                    if (day) lastDay = day;
                    if (x.type === "event") return [divider, <span className="cbtl-chat-event" key={x.id}>{x.text}</span>];
                    return [divider, (
                        <span className="cbtl-chat-row" data-mine={x.mine ? "" : undefined} key={x.id}>
                            {!x.mine && <Avatar image={x.image} name={x.name} size={28} person={x.person} />}
                            <span className="cbtl-bub">
                                {x.body}
                                {x.at && <small>{clockOf(new Date(x.at).toISOString())}</small>}
                            </span>
                        </span>
                    )];
                })}
            </div>
            <form className="cbtl-chat-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <input className="cbtl-chat-input" placeholder={say("chatPlaceholder")} aria-label={say("chatPlaceholder")} maxLength={4000} value={draft} disabled={busy}
                    onChange={(e) => setDraft(e.target.value)} />
                <button type="submit" className="cbtl-chat-send" aria-label={say("chatSend")} disabled={busy || !draft.trim()}>
                    <Icon d="M12 19V5M5 12l7-7 7 7" size={18} stroke={2} />
                </button>
            </form>
            {error && <span className="cbtl-error" role="alert">{error}</span>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pick a package: the wide sheet (option A)
// ─────────────────────────────────────────────────────────────────────────────

export function PackageSheet({ say, seat, kind, transport, names, parties, offer, initialId, onClose, onDone }: {
    say: Say; seat: Seat; kind: "event" | "product"; transport: ListingTransport;
    names: { community: string; seller: string }; parties: Parties;
    /** The other side's open offer: picking its package turns Send into Accept. */
    offer: Proposal | null;
    initialId?: string | null;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const [packages, setPackages] = useState<Package[] | null>(null);
    const [picked, setPicked] = useState<string | null>(initialId ?? null);
    const [previews, setPreviews] = useState<Record<string, ListingMoney | null | "loading">>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { transport.packages().then(setPackages).catch(() => setPackages([])); }, [transport]);
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
    }, [busy, onClose]);
    useEffect(() => {
        if (!picked || previews[picked] !== undefined) return;
        setPreviews((p) => ({ ...p, [picked]: "loading" }));
        transport.money({ packageId: picked })
            .then((m) => setPreviews((p) => ({ ...p, [picked]: m && m.previewPackage?.id === picked ? m : null })))
            .catch(() => setPreviews((p) => ({ ...p, [picked]: null })));
    }, [picked, previews, transport]);

    const pkg = packages?.find((p) => p.id === picked) ?? null;
    const preview = picked ? previews[picked] : undefined;
    const accepting = !!(offer && pkg && offer.package?.id === pkg.id);
    const to = seat === "community" ? names.seller : names.community;
    const range = preview && preview !== "loading" ? keepRange(say, preview) : "";
    const meta: PanelMeta = preview && preview !== "loading"
        ? metaOf(preview, Number(pkg?.rate ?? 0))
        : { rate: Number(pkg?.rate ?? 0), premium: false, platformFeeRate: 0, commissionPct: pkg ? Number(pkg.rate) : null };

    const submit = async () => {
        if (!pkg) return;
        setBusy(true); setError("");
        try {
            if (accepting && offer) await transport.respond(offer.id, "ACCEPTED");
            else await transport.propose({ packageId: pkg.id });
            onDone(say("saved"));
        } catch (e: any) {
            setError(e?.message || say("failed"));
            setBusy(false);
        }
    };

    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="cbtl-sheet cbtl-wide" role="dialog" aria-modal="true" aria-label={seat === "community" ? say("pkTitleFor", { seller: names.seller }) : say("pkTitle")} tabIndex={-1} ref={ref}>
                <span className="cbtl-wide-head">
                    <span>
                        <h3>{seat === "community" ? say("pkTitleFor", { seller: names.seller }) : say("pkTitle")}</h3>
                        <p>{seat === "community" ? say("pkSubCommunity", { seller: names.seller }) : say("pkSubSeller", { community: names.community })}</p>
                    </span>
                    <button type="button" className="cbtl-x" aria-label={say("cancel")} onClick={onClose} disabled={busy}><Icon d="M18 6L6 18M6 6l12 12" size={16} stroke={2} /></button>
                </span>

                {packages === null ? <p className="cbtl-wide-pad">{say("loading")}</p> : packages.length === 0 ? (
                    <p className="cbtl-wide-pad">{say("composeNoPackages", { community: names.community })}</p>
                ) : (
                    <>
                        <div className="cbtl-pkgs" role="radiogroup" aria-label={say("composePackage")}>
                            {packages.map((p) => (
                                <button key={p.id} type="button" role="radio" aria-checked={picked === p.id} className="cbtl-pkg" onClick={() => setPicked(p.id)} disabled={busy}>
                                    <span className="cbtl-pkg-top"><i className="cbtl-rad" aria-hidden="true" /><b>{p.name}</b></span>
                                    <span className="cbtl-pkg-rate"><strong>{percent(Number(p.rate))}</strong><small>{say("earnCommission")}</small></span>
                                    {p.description && <span className="cbtl-pkg-desc">{p.description}</span>}
                                </button>
                            ))}
                        </div>
                        <div className="cbtl-wide-pad">
                            {!pkg ? <p className="cbtl-hint">{say("pkPickOne")}</p>
                                : preview === "loading" || preview === undefined ? <p className="cbtl-hint">{say("pkLoading")}</p>
                                    : preview === null ? <p className="cbtl-hint">{say("pkNoPreview")}</p>
                                        : <OneSalePanel say={say} seat={seat} kind={kind} m={preview} parties={parties} meta={meta}
                                            title={say("pkSplitTitle", { name: pkg.name })} subtitle={say("pkSplitSub")} />}
                        </div>
                    </>
                )}

                {error && <span className="cbtl-error cbtl-wide-pad" role="alert">{error}</span>}
                <span className="cbtl-wide-foot">
                    <span className="cbtl-wide-sum">
                        {pkg && <><b>{say("pkPicked", { terms: termsLabel(say, Number(pkg.rate), pkg.name, kind) })}</b>{range && <> · {seat === "community" ? say("pkKeepsRange", { who: names.community, range }) : say("pkYouKeepRange", { range })}</>}</>}
                    </span>
                    <button type="button" className="cbtl-hbtn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                    <button type="button" className="cbtl-hbtn" data-kind="primary" disabled={busy || !pkg} onClick={submit}>
                        {pkg ? (accepting ? say("pkAccept", { name: pkg.name }) : say("pkSendTo", { name: pkg.name, who: to })) : say("barPickPackage")}
                    </button>
                </span>
            </div>
        </div>
    );
}
