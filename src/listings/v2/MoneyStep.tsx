"use client";

/**
 * STEP 2, THE MONEY (listing page v2; the canvas' "The money", option B).
 *
 * Each seat starts from the same price and subtracts only what leaves its own
 * pocket (decided 22 Nov 2026):
 *   seller     price − Stripe − the community's commission − Cobuntu = you keep
 *   community  price − Stripe − the seller's share = the commission − Cobuntu's cut = it keeps
 * The lines come from the server already split for the seat (core
 * ListingMoneyService, finances' own split); nothing is re-derived here.
 *
 * The left column draws one sale as a ring (a split, never a progress bar),
 * its numbers underneath, every party with its real mark and the viewer's own
 * row in green. Where the community takes no commission on event tickets its
 * view stays drawn but blurred, with the reason on top: explicit, not hidden.
 *
 * Upfront payments are a dated schedule (option B, picked 23 Nov 2026): two
 * tiles (what is paid, what is next and when), then every payment by date, the
 * next one in amber with the card it is taken from. Add-ons still being agreed
 * have no date yet: a dashed tile, and their actions on the row.
 */
import type { ReactNode } from "react";
import type { Say } from "./copy";
import { dateTile, minus, money, percent, shortDate, signed } from "./format";
import { Face, ICON, Icon, addonIcon, type PartyKey } from "./ui";
import type { ListingMoney, MoneyLine, Seat, UpfrontAddon } from "./types";

const C = { keep: "#4e9c78", comm: "#c98a6b", cob: "#e0a94e", stripe: "#b9c4d6", them: "#d9d3ca" };

export interface Parties {
    community: { name: string; icon?: string | null };
    seller: { name: string; image?: string | null };
}

export interface MoneyStepProps {
    say: Say;
    seat: Seat;
    kind: "event" | "product";
    money: ListingMoney | null;
    parties: Parties;
    /** When the terms were agreed, for "Agreed 18 Nov: ...". */
    agreedOn?: string | null;
    /** Shown to the seller on a live listing (the community app's Premium card). */
    premium?: ReactNode;
    /** Add-on and card actions; absent ones draw no button. */
    onAcceptAddonPrice?: (a: UpfrontAddon) => void;
    onCancelAddon?: (a: UpfrontAddon) => void;
    onApproveAddon?: (a: UpfrontAddon) => void;
    onProposeAddonPrice?: (a: UpfrontAddon) => void;
    onDeclineAddon?: (a: UpfrontAddon) => void;
    onChangeCard?: () => void;
    busy?: boolean;
}

const amountOf = (lines: MoneyLine[] | undefined, key: MoneyLine["key"]) => lines?.find((l) => l.key === key)?.amount ?? 0;

export function MoneyStep(p: MoneyStepProps) {
    const { say, seat, money: m } = p;
    if (!m) return <p className="cbtl-hint">{say("moneyUnavailable")}</p>;
    return (
        <>
            <TicketSales {...p} m={m} />
            <Upfront {...p} m={m} />
            <Result {...p} m={m} />
            {seat === "seller" && m.live && p.premium}
        </>
    );
}

/** The left column: one sale as a ring, its parties underneath. */
export function MoneyRing({ say, seat, kind, money: m, parties, agreedOn }: MoneyStepProps) {
    const one = m?.oneSale;
    if (!m || !one) return null;
    const cur = m.currency;
    const gross = Math.max(1, one.gross);
    const commission = amountOf(one.lines, "commission");
    const stripe = amountOf(one.lines, "stripe");
    const cobuntu = amountOf(one.lines, "cobuntu");
    const keep = amountOf(one.lines, "keep");
    const share = amountOf(one.lines, "seller");
    const community = parties.community.name;
    const noComm = seat === "community" && kind === "event" && commission === 0;

    const stops: Array<[number, string]> = seat === "seller"
        ? [[keep, C.keep], [commission, C.comm], [cobuntu, C.cob], [stripe, C.stripe]]
        : [[share, C.them], [keep, C.keep], [cobuntu, C.cob], [stripe, C.stripe]];
    let at = 0;
    const conic = `conic-gradient(${stops.filter(([v]) => v > 0).map(([v, c]) => {
        const w = (v / gross) * 100;
        const s = `${c} ${at}% ${at + w}%`;
        at += w;
        return s;
    }).join(", ")})`;

    const commNote = commission === 0
        ? (kind === "event" ? say("lineCommissionNone") : say("lineCommissionNoneProduct"))
        : say("lineCommissionNote", { rate: percent(one.commissionRate) });
    const legend: Array<{ who: PartyKey; name: string; sub: string; amount: number; ring: string; mine?: boolean }> = seat === "seller"
        ? [
            { who: "seller", name: say("legendYou"), sub: say("legendWhatYouKeep"), amount: keep, ring: C.keep, mine: true },
            { who: "community", name: community, sub: commNote, amount: commission, ring: C.comm },
            { who: "cobuntu", name: "Cobuntu", sub: one.sellerPremium ? say("lineCobuntuPremium") : say("lineCobuntuSeller"), amount: cobuntu, ring: C.cob },
            { who: "stripe", name: say("lineStripe"), sub: say("lineStripeNote"), amount: stripe, ring: C.stripe },
        ]
        : [
            { who: "community", name: community, sub: commission === 0 ? commNote : say("legendWhatYouKeep"), amount: keep, ring: C.keep, mine: true },
            { who: "seller", name: parties.seller.name, sub: say("lineSellerShareNote"), amount: share, ring: C.them },
            { who: "stripe", name: say("lineStripe"), sub: say("lineStripeNote"), amount: stripe, ring: C.stripe },
            { who: "cobuntu", name: "Cobuntu", sub: cobuntuCutNote(say, community, one.platformFeeRate, cobuntu), amount: cobuntu, ring: C.cob },
        ];
    const unit = kind === "event" ? say("unitTicket") : say("unitSale");
    const terms = one.rateSource === "proposed"
        ? say("proposedTerms", { rate: percent(one.commissionRate) })
        : agreedOn && one.rateSource === "agreed"
            ? say("agreedOn", { date: shortDate(agreedOn), terms: commission === 0 ? commNote : percent(one.commissionRate) })
            : "";

    return (
        <span className="cbtl-blurwrap">
            <div className={`cbtl-donut-card${noComm ? " cbtl-blur" : ""}`} aria-hidden={noComm || undefined}>
                <h4>{say("whereOneGoes", { price: money(one.gross, cur), unit })}</h4>
                <div className="cbtl-donut" style={{ background: conic }} role="img" aria-label={say("whereOneGoes", { price: money(one.gross, cur), unit })}>
                    <div className="cbtl-donut-hole">
                        <b>{money(keep, cur)}</b>
                        <small>{seat === "seller" ? say("ringYouKeep", { price: money(one.gross, cur) }) : say("ringCommunityKeeps", { community })}</small>
                    </div>
                </div>
                <div className="cbtl-legend">
                    {legend.map((l) => (
                        <div className="cbtl-legend-row" data-mine={l.mine ? "" : undefined} key={l.who + l.name}>
                            <Face who={l.who} ring={l.ring} communityIcon={parties.community.icon} communityName={community} sellerImage={parties.seller.image} sellerName={parties.seller.name} />
                            <div><b>{l.name}</b><small>{l.sub}</small></div>
                            <span>{money(l.amount, cur)}</span>
                        </div>
                    ))}
                    {terms && <span className="cbtl-agreed">{terms}</span>}
                </div>
            </div>
            {noComm && (
                <span className="cbtl-overlay"><span className="cbtl-overlay-card"><i>0%</i><b>{say("noCommissionOverlay", { community })}</b></span></span>
            )}
        </span>
    );
}

function cobuntuCutNote(say: Say, community: string, platformFeeRate: number, cut: number): string {
    if (cut === 0 && platformFeeRate === 0) return say("lineCobuntuNone", { community });
    return say("lineCobuntuCut", { rate: percent(platformFeeRate * 100) });
}

function TicketSales({ say, seat, kind, m, parties }: MoneyStepProps & { m: ListingMoney }) {
    const one = m.oneSale;
    const sold = m.soldSoFar;
    if (!one && !sold) return null;
    const cur = m.currency;
    const community = parties.community.name;
    const unit = kind === "event" ? say("unitTicket") : say("unitSale");
    const commission = amountOf(one?.lines, "commission");
    const noComm = seat === "community" && kind === "event" && one && commission === 0;
    const rate = one?.commissionRate ?? 0;
    const commNote = commission === 0 && rate === 0
        ? (kind === "event" ? say("lineCommissionNone") : say("lineCommissionNoneProduct"))
        : say("lineCommissionNote", { rate: percent(rate) });

    type Row = { k: "price" | "minus" | "sub" | "keep"; key: MoneyLine["key"]; label: string; note?: string; who: PartyKey; ring?: string };
    const rows: Row[] = seat === "seller"
        ? [
            { k: "price", key: "price", label: kind === "event" ? say("lineTicketPrice") : say("linePrice"), who: "ticket" },
            { k: "minus", key: "stripe", label: say("lineStripe"), note: say("lineStripeNote"), who: "stripe", ring: C.stripe },
            { k: "minus", key: "commission", label: say("lineCommission", { community }), note: commNote, who: "community", ring: C.comm },
            { k: "minus", key: "cobuntu", label: say("lineCobuntu"), note: one?.sellerPremium ? say("lineCobuntuPremium") : say("lineCobuntuSeller"), who: "cobuntu", ring: C.cob },
            { k: "keep", key: "keep", label: say("lineYouKeep"), who: "seller", ring: C.keep },
        ]
        : [
            { k: "price", key: "price", label: kind === "event" ? say("lineTicketPrice") : say("linePrice"), who: "ticket" },
            { k: "minus", key: "stripe", label: say("lineStripe"), note: say("lineStripeNote"), who: "stripe", ring: C.stripe },
            { k: "minus", key: "seller", label: say("lineSellerShare", { seller: parties.seller.name }), note: say("lineSellerShareNote"), who: "seller", ring: C.them },
            { k: "sub", key: "commission", label: say("lineCommunityCommission", { community }), note: commission === 0 && kind === "event" ? say("lineCommunityCommissionNone") : percent(rate), who: "community" },
            { k: "minus", key: "cobuntu", label: say("lineCobuntu"), note: cobuntuCutNote(say, community, one?.platformFeeRate ?? 0, amountOf(one?.lines, "cobuntu")), who: "cobuntu", ring: C.cob },
            { k: "keep", key: "keep", label: say("lineCommunityKeeps", { community }), who: "community", ring: C.keep },
        ];
    const fmt = (k: Row["k"], v: number) => (k === "minus" ? minus(v, cur) : money(v, cur));
    const cols = sold ? "minmax(0,1.5fr) minmax(0,.8fr) minmax(0,.9fr)" : "minmax(0,1.6fr) minmax(0,1fr)";
    const keep = amountOf(one?.lines, "keep");
    const share = amountOf(one?.lines, "seller");

    return (
        <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="cbtl-slot-head">{kind === "event" ? say("moneyTicketSales") : say("moneySales")}</span>
            <span className="cbtl-blurwrap">
                <div className={`cbtl-table${noComm ? " cbtl-blur" : ""}`} style={{ ["--cbtl-cols" as any]: cols }} aria-hidden={noComm || undefined}>
                    <div className="cbtl-thead">
                        <span />
                        <span>{say("colOne", { unit })}</span>
                        {sold && <span>{say("colSold", { count: sold.count })}</span>}
                    </div>
                    {rows.map((r) => (
                        <div className="cbtl-trow" data-k={r.k} key={r.key + r.k}>
                            <div>
                                <Face who={r.who} ring={r.ring} communityIcon={parties.community.icon} communityName={community} sellerImage={parties.seller.image} sellerName={parties.seller.name} />
                                <div><b>{r.label}</b>{r.note && <small>{r.note}</small>}</div>
                            </div>
                            <span className="cbtl-amt" data-big={!sold && r.k === "keep" ? "" : undefined}>{one ? fmt(r.k, amountOf(one.lines, r.key)) : ""}</span>
                            {sold && <span className="cbtl-amt" data-big={r.k === "keep" ? "" : undefined}>{fmt(r.k, amountOf(sold.lines, r.key))}</span>}
                        </div>
                    ))}
                </div>
                {noComm && one && (
                    <span className="cbtl-overlay">
                        <span className="cbtl-overlay-card">
                            <i>0%</i>
                            <b>{say("noCommissionOverlay", { community })}</b>
                            <small>{say("noCommissionNote", { price: money(one.gross, cur), seller: parties.seller.name, keep: money(share || keep, cur), community })}</small>
                        </span>
                    </span>
                )}
            </span>
            {!sold && !m.live && <span className="cbtl-small">{say("soldColumnLater")}</span>}
        </section>
    );
}

type SchedRow =
    | { type: "pay"; key: string; tone: "paid" | "next" | "off" | "bad"; date: string | null; title: string; sub: string; amount: number; state: string; card?: boolean }
    | { type: "addon"; key: string; a: UpfrontAddon; tone: "act" | "plain" | "incl"; sub: string; action: "accept" | "decide" | "pill" | "incl" | "next"; pill?: string };

function Upfront(p: MoneyStepProps & { m: ListingMoney }) {
    const { say, seat, m, parties, busy } = p;
    const cur = m.currency;
    const u = m.upfront;
    const community = parties.community.name;
    const seller = parties.seller.name;
    const head = seat === "seller" ? say("upHeadSeller", { community }) : say("upHeadCommunity", { seller });

    if (!u) {
        return (
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="cbtl-slot-head">{head}</span>
                <div className="cbtl-list"><div className="cbtl-row" data-tone="incl"><span className="cbtl-dash"><Icon d={ICON.room} size={17} stroke={1.7} /></span><span className="cbtl-row-main"><small>{say("upNoneHere")}</small></span></div></div>
            </section>
        );
    }

    const waitingOn = seat === "seller" ? community : say("you").toLowerCase();
    const card = u.card;
    const paidCount = u.payments.filter((x) => x.state === "paid").length + u.addons.filter((a) => a.paidAt && a.status !== "REFUNDED" && !a.included).length;
    const next = u.next;
    const nextWaiting = u.payments.some((x) => x.key === "second" && x.state === "waiting");

    const rows: SchedRow[] = [];
    const ofN = u.isPriority ? 1 : 2;
    for (const x of u.payments) {
        if (x.state === "cancelled") continue;
        const isNext = x.state === "next" || x.state === "waiting";
        const subBits = [ofN > 1 ? say("upPayment", { n: x.key === "first" ? 1 : 2, of: ofN }) : ""];
        if (x.state === "waiting") subBits.push(say("upOnceAccepted", { who: waitingOn }));
        if (seat === "community" && x.stripe > 0) subBits.push(`${money(x.gross, cur)} − ${money(x.stripe, cur)} Stripe`);
        rows.push({
            type: "pay", key: x.key, date: x.paidAt ?? x.dueAt,
            tone: x.state === "paid" ? "paid" : isNext ? "next" : x.state === "failed" ? "bad" : "off",
            title: u.room || say("upRoom"),
            sub: subBits.filter(Boolean).join(" · "),
            amount: x.amount,
            state: x.state === "paid" ? (seat === "seller" ? say("upPaid") : say("upStateIn")) : x.state === "failed" ? say("upStateFailed") : x.state === "refunded" ? say("upStateRefunded") : say("upStateNext"),
            card: isNext || x.state === "failed",
        });
    }
    for (const a of u.addons) {
        if (a.paidAt && a.status !== "REFUNDED" && !a.included) {
            rows.push({
                type: "pay", key: a.id, date: a.paidAt, tone: "paid", title: a.name,
                sub: seat === "community" && a.stripe > 0 ? `${money(a.gross, cur)} − ${money(a.stripe, cur)} Stripe` : feeLine(say, a, cur),
                amount: a.amount, state: seat === "seller" ? say("upPaid") : say("upStateIn"),
            });
        }
    }
    rows.sort((a, b) => {
        if (a.type !== "pay" || b.type !== "pay") return 0;
        return (a.date ? Date.parse(a.date) : Infinity) - (b.date ? Date.parse(b.date) : Infinity);
    });
    const included = u.addons.filter((a) => a.included && !["DECLINED", "CANCELLED"].includes(a.status));
    const due = u.addons.filter((a) => !a.paidAt && !a.included && (a.status === "APPROVED" || a.status === "CHARGE_FAILED"));
    const toAgree = u.addons.filter((a) => !a.included && (a.status === "REQUESTED" || a.status === "PRICE_PROPOSED"));

    const summary = m.live
        ? (seat === "seller" ? say("upInAll", { amount: money(u.total, cur) }) : say("upToYouInAll", { amount: money(u.total, cur) }))
        : say("upAgreedSoFar", { amount: money(u.total, cur) });
    const cardWords = seat === "seller"
        ? (card?.last4 ? say("upFromYourCard", { last4: card.last4 }) : say("upFromYourCardNoLast4"))
        : say("upFromTheirCard", { seller });

    return (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="cbtl-up-head"><span className="cbtl-slot-head">{head}</span><span>{summary}</span></div>
            <div className="cbtl-tiles">
                <div className="cbtl-tile">
                    <small>{seat === "seller" ? say("upPaid") : say("upReceived")}</small>
                    <b>{money(u.paid, cur)}</b>
                    <small>{paidCount === 1 ? say("upOnePaymentSub") : say("upPaymentsSub", { count: paidCount })}{seat === "community" ? `, ${say("upAfterStripe")}` : ""}</small>
                </div>
                {next && (
                    <div className="cbtl-tile" data-tone="next">
                        <small>{next.dueAt ? say("upNext", { date: shortDate(next.dueAt) }) : say("upNextNoDate")}</small>
                        <b>{money(next.amount, cur)}</b>
                        <small>{nextWaiting ? `${say("upOnceAccepted", { who: waitingOn })}, ${cardWords}` : cardWords}</small>
                    </div>
                )}
            </div>
            <div className="cbtl-list">
                {rows.map((r) => r.type === "pay" && (
                    <div className="cbtl-row" data-tone={r.tone === "next" ? "next" : undefined} key={r.key}>
                        <DateTile iso={r.date} next={r.tone === "next"} />
                        <span className="cbtl-row-main">
                            <b>{r.title}</b>
                            {r.sub && <small>{r.sub}</small>}
                            {r.card && (
                                <span className="cbtl-card-line">
                                    <Icon d={ICON.card} size={14} />
                                    <span>{seat === "seller" ? (card?.last4 ? say("upYourCard", { last4: card.last4 }) : say("upFromYourCardNoLast4")) : say("upTheirCard", { seller })}</span>
                                    {seat === "seller" && p.onChangeCard && <button type="button" className="cbtl-link" onClick={p.onChangeCard}>{say("upChangeCard")}</button>}
                                </span>
                            )}
                        </span>
                        <span className="cbtl-row-side">
                            <b>{money(r.amount, cur)}</b>
                            <span className="cbtl-state" data-tone={r.tone === "next" ? "next" : r.tone === "bad" ? "bad" : r.tone === "off" ? "off" : undefined}>
                                {r.tone === "paid" && <Icon d={ICON.check} size={12} stroke={3} />}{r.state}
                            </span>
                        </span>
                    </div>
                ))}
                {due.map((a) => (
                    <div className="cbtl-row" data-tone="next" key={a.id}>
                        <span className="cbtl-dash" data-act=""><Icon d={addonIcon(a.name, a.slot)} size={17} stroke={1.7} /></span>
                        <span className="cbtl-row-main">
                            <b>{a.name}</b>
                            <small>{feeLine(say, a, cur)}</small>
                            <span className="cbtl-card-line"><Icon d={ICON.card} size={14} />{seat === "seller" ? cardWords : say("upTheirCard", { seller })}</span>
                        </span>
                        <span className="cbtl-row-side">
                            <b>{money(a.amount, cur)}</b>
                            <span className="cbtl-state" data-tone={a.status === "CHARGE_FAILED" ? "bad" : "next"}>{a.status === "CHARGE_FAILED" ? say("upStateFailed") : say("upStateNext")}</span>
                        </span>
                    </div>
                ))}
                {included.map((a) => (
                    <div className="cbtl-row" data-tone="incl" key={a.id}>
                        <span className="cbtl-dash"><Icon d={addonIcon(a.name, a.slot)} size={17} stroke={1.7} /></span>
                        <span className="cbtl-row-main"><b>{a.name}</b><small>{say("upWithTheRoom")}</small></span>
                        <span className="cbtl-row-side"><span className="cbtl-pill" data-tone="ok">{say("upIncluded")}</span></span>
                    </div>
                ))}
                {toAgree.length > 0 && <span className="cbtl-group">{say("upToAgree")}</span>}
                {toAgree.map((a) => {
                    const proposed = a.status === "PRICE_PROPOSED";
                    const sellerActs = seat === "seller" && proposed;
                    const communityActs = seat === "community" && !proposed;
                    const sub = proposed
                        ? (seat === "seller"
                            ? say("upProposedBy", { who: community, amount: money(a.proposedCents ?? a.listedCents, cur) })
                            : say("upYouProposed", { amount: money(a.proposedCents ?? a.listedCents, cur) }))
                        : say("upFrom", { amount: money(a.listedCents, cur) });
                    const acts = sellerActs || communityActs;
                    return (
                        <div className="cbtl-row" data-tone={acts ? "act" : undefined} key={a.id}>
                            <span className="cbtl-dash" data-act={acts ? "" : undefined}><Icon d={addonIcon(a.name, a.slot)} size={17} stroke={1.7} /></span>
                            <span className="cbtl-row-main"><b>{a.name}</b><small>{sub}</small></span>
                            <span className="cbtl-row-side">
                                {sellerActs && (p.onAcceptAddonPrice || p.onCancelAddon) && (
                                    <span className="cbtl-row-btns">
                                        {p.onAcceptAddonPrice && <button type="button" className="cbtl-btn" data-kind="go" data-size="s" disabled={busy} onClick={() => p.onAcceptAddonPrice!(a)}>{say("upAccept", { amount: money(a.proposedCents ?? a.listedCents, cur) })}</button>}
                                        {p.onCancelAddon && <button type="button" className="cbtl-btn" data-kind="no" data-size="icon" disabled={busy} aria-label={say("upDecline", { name: a.name })} onClick={() => p.onCancelAddon!(a)}>✕</button>}
                                    </span>
                                )}
                                {communityActs && (p.onApproveAddon || p.onDeclineAddon) && (
                                    <span className="cbtl-row-btns">
                                        {p.onApproveAddon && <button type="button" className="cbtl-btn" data-kind="go" data-size="icon" disabled={busy} aria-label={say("upApprove", { name: a.name })} onClick={() => p.onApproveAddon!(a)}>✓</button>}
                                        {p.onProposeAddonPrice && <button type="button" className="cbtl-btn" data-size="icon" disabled={busy} aria-label={say("upPropose", { name: a.name })} onClick={() => p.onProposeAddonPrice!(a)}>€</button>}
                                        {p.onDeclineAddon && <button type="button" className="cbtl-btn" data-kind="no" data-size="icon" disabled={busy} aria-label={say("upDecline", { name: a.name })} onClick={() => p.onDeclineAddon!(a)}>✕</button>}
                                    </span>
                                )}
                                {!acts && <span className="cbtl-pill" data-tone="them">{say("upTheirTurn", { who: proposed ? seller : community })}</span>}
                            </span>
                        </div>
                    );
                })}
            </div>
            <span className="cbtl-small">{seat === "seller" ? say("upNoteSeller") : say("upNoteCommunity")}</span>
        </section>
    );
}

function feeLine(say: Say, a: UpfrontAddon, cur: string): string {
    const base = a.proposedCents ?? a.listedCents;
    return base > 0 ? say("upFeeVat", { amount: money(base, cur) }) : "";
}

function DateTile({ iso, next }: { iso: string | null; next: boolean }) {
    const t = dateTile(iso);
    if (!t) return <span className="cbtl-dash" data-act={next ? "" : undefined}><Icon d={ICON.card} size={16} /></span>;
    return <span className="cbtl-dtile" data-next={next ? "" : undefined}><b>{t.mon}</b><span>{t.day}</span></span>;
}

function Result({ say, seat, kind, m, parties }: MoneyStepProps & { m: ListingMoney }) {
    const r = m.result;
    if (!r) return null;
    const cur = m.currency;
    const unit = kind === "event" ? say("unitTicket") : say("unitSale");
    const units = kind === "event" ? say("unitTickets") : say("unitSales");
    const community = parties.community.name;
    if (r.kind === "breakEven") {
        return (
            <div className="cbtl-result">
                <div>
                    <b>{say("resultBreakEven")}</b>
                    <span>{say("resultBreakEvenSum", { unit, amount: money(r.perSale, cur) })}</span>
                    <small>{say("resultBreakEvenNote", { amount: money(r.upfront, cur) })}</small>
                </div>
                <strong>{say("resultBreakEvenAmount", { count: r.sales, units })}</strong>
            </div>
        );
    }
    if (r.kind === "sellerSoFar") {
        const after = r.afterNext;
        const note = after == null || !r.nextDueAt ? "" : r.salesToCover
            ? say("resultSellerNote", { date: shortDate(r.nextDueAt), after: signed(after, cur), count: r.salesToCover, units })
            : say("resultSellerNoteCovered", { date: shortDate(r.nextDueAt), after: signed(after, cur) });
        return (
            <div className="cbtl-result" data-live="">
                <div>
                    <b>{kind === "event" ? say("resultSellerSoFarEvent") : say("resultSellerSoFarItem")}</b>
                    <span>{r.upfrontPaid > 0
                        ? say("resultSellerSum", { sales: money(r.fromSales, cur), units, upfront: money(r.upfrontPaid, cur) })
                        : say("resultSellerSumNoUpfront", { sales: money(r.fromSales, cur), units })}</span>
                    {note && <small>{note}</small>}
                </div>
                <strong>{signed(r.amount, cur)}</strong>
            </div>
        );
    }
    if (seat !== "community") return null;
    return (
        <div className="cbtl-result" data-live="">
            <div>
                <b>{say("resultCommunitySoFar", { community })}</b>
                <span>{say("resultCommunitySum", { upfront: money(r.upfrontIn, cur), commission: money(r.fromSales, cur) })}</span>
                {r.toCome > 0 && r.nextDueAt && <small>{say("resultCommunityNote", { amount: money(r.toCome, cur), seller: parties.seller.name, date: shortDate(r.nextDueAt) })}</small>}
            </div>
            <strong>{money(r.amount, cur)}</strong>
        </div>
    );
}
