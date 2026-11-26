"use client";

/**
 * THE LISTING, BESIDE ITS CHAT (T-417; canvas 8YTrdyqmNdkKECpACpdd7c, page
 * "Listing chat": ChatConversations, ChatConversationsArt, ChatConversationsLive).
 *
 * A listing's negotiation lives in its group chat in /conversations. This is
 * the drawer on the chat's right: the same listing as the listing page, read
 * the same way (ListingPageV2 with layout="drawer" draws it from the same
 * loads, moves, confirmations and sheets), laid out in one narrow column:
 *
 *   head      the item, who is on each side, where it stands
 *   decision  the moves open now (accept, keep, approve, change terms...)
 *   money     one sale: the ring and what each side keeps; amounts glide
 *   terms     what is agreed, or what is asked against it
 *   details   price, kind or date, when it was sent, the owner
 *   footer    the moves that end or pause it (withdraw, pause, remove)
 *
 * Every move confirms first, exactly as on the listing page. There is no
 * "Reply" or "Share" here: the chat's own message box is the reply, and the
 * live page is one link away.
 */

import type { ReactNode } from "react";
import type { Say } from "./copy";
import type { Decision, Move, MoveId } from "./decision";
import { money, percent } from "./format";
import { useGlide } from "./glide";
import type { Parties } from "./MoneyStep";
import { Ring, keepOf, metaOf, pricesOf, cheapestPaid, rowsFor } from "./sections";
import type { ListingMoney, ListingStatus, Seat } from "./types";
import { Avatar, Icon } from "./ui";

/** Moves that end or pause the listing: the drawer's footer, never its decision card. */
export const FOOTER_MOVES: MoveId[] = ["withdraw", "pause", "remove"];
/** Moves about the terms: the terms card's, unless the decision card already has them. */
export const TERMS_MOVES: MoveId[] = ["changePackage", "changeTerms", "pickPackage"];

export function DrawerHead({ say, image, name, parties, status, statusLabel, terms, onClose }: {
    say: Say; image: string | null; name: string; parties: Parties;
    status: ListingStatus | null; statusLabel: string; terms: string; onClose?: () => void;
}) {
    const tone = status === "ACTIVE" ? "live" : status === "PAUSED" ? "paused" : status === "PENDING" ? "pending" : "closed";
    return (
        <header className="cbtl-dh">
            {image ? <img className="cbtl-dh-ph" src={image} alt="" /> : <span className="cbtl-dh-ph" aria-hidden="true" />}
            <span className="cbtl-dh-tt">
                <h2>{name}</h2>
                <span className="cbtl-dh-who">
                    <span className="cbtl-dh-faces" aria-hidden="true">
                        <Avatar image={parties.seller.image} name={parties.seller.name} size={20} person={{ id: parties.seller.id, usertag: parties.seller.usertag }} />
                        <span className="cbtl-dh-sq">{parties.community.icon ? <img src={parties.community.icon} alt="" /> : null}</span>
                    </span>
                    <span>{parties.seller.name} <span className="cbtl-dh-faint">{say("drwWith")}</span> {parties.community.name}</span>
                </span>
                <span className="cbtl-dh-st">
                    <span className="cbtl-dh-pill" data-tone={tone}><i aria-hidden="true" />{statusLabel}</span>
                    {terms && <span className="cbtl-dh-terms">{terms}</span>}
                </span>
            </span>
            {onClose && (
                <button type="button" className="cbtl-dh-x" onClick={onClose} aria-label={say("drwClose")}>
                    <Icon d="M18 6 6 18M6 6l12 12" size={16} stroke={2} />
                </button>
            )}
        </header>
    );
}

/** The decision, as the drawer's dark card: what is asked of you and the moves for it. */
export function DrawerDecision({ decision, moves, extra, onMove, busy }: {
    decision: Decision; moves: Move[]; extra?: ReactNode; onMove: (id: MoveId) => void; busy?: boolean;
}) {
    const primary = moves.filter((m) => m.primary);
    const rest = moves.filter((m) => !m.primary);
    return (
        <section className="cbtl-dd" data-tone={decision.tone} aria-label={decision.eyebrow}>
            <span className="cbtl-dd-eyebrow">{decision.eyebrow}</span>
            <b className="cbtl-dd-title">{decision.title}</b>
            {decision.sub && <small className="cbtl-dd-sub">{decision.sub}</small>}
            {primary.map((m) => (
                <button key={m.id} type="button" className="cbtl-dd-p" disabled={m.disabled || busy} title={m.title} onClick={() => onMove(m.id)}>{m.label}</button>
            ))}
            {(rest.length > 0 || extra) && (
                <span className="cbtl-dd-row">
                    {rest.map((m) => (
                        <button key={m.id} type="button" className="cbtl-dd-s" disabled={m.disabled || busy} title={m.title} onClick={() => onMove(m.id)}>{m.label}</button>
                    ))}
                    {extra}
                </span>
            )}
        </section>
    );
}

/**
 * One sale, small: the ring with this seat's share in its hole, the amount it
 * keeps, and the other lines. Every amount (and so every slice) glides when
 * the money changes, so a new rate re-prices in place instead of snapping.
 */
export function DrawerMoney({ say, seat, kind, m, base, baseRate, rate, parties }: {
    say: Say; seat: Seat; kind: "event" | "product"; m: ListingMoney | null; parties: Parties;
    /** The money at the current terms, when `m` is the asked terms: says how much less the ask keeps. */
    base?: ListingMoney | null; baseRate?: number | null;
    rate: number | null;
}) {
    const prices = pricesOf(m);
    const p = prices[cheapestPaid(prices)] ?? null;
    const raw = p && !p.free ? p.lines : [];
    const glided = useGlide(Object.fromEntries(raw.map((l) => [l.key, l.amount])), true);
    if (!m) return null;
    const cur = m.currency;
    if (!p || p.free) {
        return (
            <section className="cbtl-dc cbtl-dm" aria-label={say("earnOneSale")}>
                <span className="cbtl-dc-k">{say("earnOneSale")}</span>
                <span className="cbtl-dm-free">{say("earnNothingToSplit")}</span>
            </section>
        );
    }
    const lines = raw.map((l) => ({ ...l, amount: glided[l.key] ?? l.amount }));
    const rows = rowsFor(say, seat, kind, lines, parties, metaOf(m, rate), cur);
    const keep = keepOf(seat, lines, parties);
    const share = p.gross > 0 ? Math.round((keep / p.gross) * 100) : 0;
    /*
     * The community's hole says its agreed rate, not its share of the price:
     * the commission is taken on the price before VAT and Cobuntu's cut comes
     * out of it, so the share reads lower than what was agreed (8% showed as
     * 6% on PBN's event, 26 Nov 2026). The seller's hole stays their share.
     */
    const centre = seat === "community" && rate != null
        ? { value: percent(rate), sub: say("drwCommission") }
        : { value: `${share}%`, sub: "" };
    const basePrices = pricesOf(base ?? null);
    const baseP = basePrices[cheapestPaid(basePrices)] ?? null;
    const baseKeep = baseP && !baseP.free ? keepOf(seat, baseP.lines, parties) : null;
    const less = baseKeep != null && baseKeep > keepOf(seat, raw, parties) ? baseKeep - keepOf(seat, raw, parties) : 0;
    return (
        <section className="cbtl-dc cbtl-dm" aria-label={say("earnOneSale")}>
            <span className="cbtl-dc-head">
                <span className="cbtl-dc-k">{say("drwOneSale", { amount: money(p.gross, cur) })}</span>
                {rate != null && <span className="cbtl-dc-at">{say("drwAt", { rate: percent(rate) })}</span>}
            </span>
            <span className="cbtl-dm-hero">
                <Ring rows={rows} gross={p.gross} center={centre.value} sub={centre.sub} size={84} />
                <span className="cbtl-dm-keep">
                    <small>{seat === "seller"
                        ? say(kind === "event" ? "drwYouKeepTicket" : "drwYouKeep")
                        : say(kind === "event" ? "drwTheyKeepTicket" : "drwTheyKeep", { who: parties.community.name })}</small>
                    <b>{money(keep, cur)}</b>
                    {less > 0 && baseRate != null && <small className="cbtl-dm-less">{say("drwLess", { amount: money(less, cur), rate: percent(baseRate) })}</small>}
                </span>
            </span>
            <span className="cbtl-dm-rows">
                {rows.filter((r) => !r.mine).map((r) => (
                    <span className="cbtl-dm-row" key={r.key}>
                        <i style={{ background: r.color }} aria-hidden="true" />
                        <span><b>{r.label}</b>{r.note && <small>{r.note}</small>}</span>
                        <b className="cbtl-dm-amt">{r.blank ? "-" : money(r.amount, cur)}</b>
                    </span>
                ))}
            </span>
        </section>
    );
}

/** What is agreed, or the ask against it, and the moves about terms. */
export function DrawerTerms({ say, now, nowSub, ask, askWho, askLabel, askSub, actions, onMove, busy }: {
    say: Say; now: string; nowSub: string;
    /** The rate asked for this listing, when there is an open ask. */
    ask: string | null; askWho: string;
    /** The ask's label when it is not "<who> asks" (your own: "You proposed"). */
    askLabel?: string;
    /** Under the asked rate: its package's name, else "this listing only". */
    askSub?: string;
    actions: Move[]; onMove: (id: MoveId) => void; busy?: boolean;
}) {
    if (!now && !ask && actions.length === 0) return null;
    return (
        <section className="cbtl-dc cbtl-dt" aria-label={say("drwTerms")}>
            <span className="cbtl-dc-k">{say("drwTerms")}</span>
            {ask ? (
                <span className="cbtl-dt-cmp">
                    <span className="cbtl-dt-box"><small>{say("drwNow")}</small><b>{now || "-"}</b>{nowSub && <span>{nowSub}</span>}</span>
                    <Icon d="M5 12h14M13 6l6 6-6 6" size={16} stroke={2.2} />
                    <span className="cbtl-dt-box" data-ask=""><small>{askLabel ?? say("drwAsks", { who: askWho })}</small><b>{ask}</b><span>{askSub ?? say("drwThisListing")}</span></span>
                </span>
            ) : now ? (
                <span className="cbtl-dt-now"><b>{now}</b>{nowSub && <small>{nowSub}</small>}</span>
            ) : null}
            {actions.length > 0 && (
                <span className="cbtl-dt-acts">
                    {actions.map((m) => (
                        <button key={m.id} type="button" className="cbtl-dt-btn" disabled={m.disabled || busy} onClick={() => onMove(m.id)}>
                            <Icon d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" size={14} stroke={2} />{m.label}
                        </button>
                    ))}
                </span>
            )}
        </section>
    );
}

export function DrawerDetails({ say, items }: { say: Say; items: Array<{ label: string; value: ReactNode }> }) {
    const shown = items.filter((x) => x.value != null && x.value !== "");
    if (shown.length === 0) return null;
    return (
        <section className="cbtl-dc" aria-label={say("drwDetails")}>
            <span className="cbtl-dc-k">{say("drwDetails")}</span>
            <span className="cbtl-dd-tiles">
                {shown.map((x) => <span className="cbtl-dd-tile" key={x.label}><small>{x.label}</small><b>{x.value}</b></span>)}
            </span>
        </section>
    );
}

export function DrawerFooter({ moves, onMove, busy }: { moves: Move[]; onMove: (id: MoveId) => void; busy?: boolean }) {
    if (moves.length === 0) return null;
    return (
        <footer className="cbtl-df">
            {moves.map((m) => (
                <button key={m.id} type="button" className="cbtl-df-btn" data-danger={m.id === "withdraw" || m.id === "remove" ? "" : undefined}
                    disabled={m.disabled || busy} title={m.title} onClick={() => onMove(m.id)}>{m.label}</button>
            ))}
        </footer>
    );
}
