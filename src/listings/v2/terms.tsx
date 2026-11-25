"use client";

/**
 * CUSTOM TERMS FOR ONE LISTING (T-414, decided 25 Nov 2026; canvas
 * 8YTrdyqmNdkKECpACpdd7c, page "Change terms").
 *
 * A community may ask for a different commission on ONE listing, whatever
 * the seller's package says ("PBN asks 10% for this listing"). The seller's
 * package is untouched; nothing changes until the seller accepts, and
 * accepting puts the listing live on those terms.
 *
 *   ChangeTermsSheet  the community: a rate, quick picks, the live split, Send
 *   AskCard           the seller: who asks what, their terms against the ask
 *   AskCompare        the seller: what they keep a sale, now and at the ask
 *   PremiumCard       the seller, on their OWN item only: Cobuntu Premium
 *   AcceptDialog      the seller: what going live means in money, Premium once
 *
 * Cobuntu Premium is a PLATFORM feature, so its card is Cobuntu-branded
 * (slate, the Cobuntu mark, a gold seal), never in the community's theme, and
 * only the seller ever sees it.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CobuntuMark } from "../ui/marks";
import type { Say } from "./copy";
import { money, percent, shortDate } from "./format";
import type { Parties } from "./MoneyStep";
import { OneSalePanel, metaOf, keepOf } from "./sections";
import type { ListingTransport } from "./transport";
import type { ListingMoney, MoneyLine, Proposal } from "./types";
import { Icon } from "./ui";

const amountOf = (lines: MoneyLine[] | undefined, key: MoneyLine["key"]) => lines?.find((l) => l.key === key)?.amount ?? 0;

/** One sale at the cheapest paid price, the same one Earnings opens on. */
export function cheapestSale(m: ListingMoney | null): { gross: number; lines: MoneyLine[] } | null {
    if (!m) return null;
    const paid = (m.prices ?? []).filter((p) => !p.free);
    if (paid.length > 0) {
        const c = paid.reduce((lo, p) => (p.gross < lo.gross ? p : lo));
        return { gross: c.gross, lines: c.lines };
    }
    return m.oneSale ? { gross: m.oneSale.gross, lines: m.oneSale.lines } : null;
}

/** Cobuntu's platform fee on the seller's leg, as words: "2.5% + $0.05". Null when unknown or none. */
export function sellerFeeRate(say: Say, m: ListingMoney | null): string | null {
    const pct = m?.rates?.sellerFeePct;
    if (!m || pct == null || pct <= 0) return null;
    const fixed = m.rates?.sellerFeeFixed ?? 0;
    return fixed > 0 ? say("accFeeRate", { pct: percent(pct), fixed: money(fixed, m.currency) }) : percent(pct);
}

/** What the host gives the page to sell Cobuntu Premium from a listing. */
export interface PremiumCheckout {
    /** Opens Premium checkout and resolves its Stripe URL; the return comes back to `returnPath`. */
    start: (interval: "MONTHLY" | "YEARLY", returnPath: string) => Promise<string>;
    /** Display prices before VAT, e.g. "€8" and "€88". */
    monthly: string;
    yearly: string;
}

/** Focus the dialog, close on Escape, give focus back: what every sheet here does. */
function useDialog(onClose: () => void, busy: boolean) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
    }, [busy, onClose]);
    return ref;
}

const SEAL = (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
        <path fill="#d9a441" d="M12 1.5l2.6 2.1 3.3-.4 1.1 3.1 2.9 1.7-.9 3.2 1.4 3-2.6 2.1-.2 3.3-3.3.5-1.8 2.8L12 21.3l-2.5 1.6-1.8-2.8-3.3-.5-.2-3.3L1.6 14.2l1.4-3-.9-3.2 2.9-1.7 1.1-3.1 3.3.4z" />
        <path d="M8.3 12.3l2.4 2.4 5-5" fill="none" stroke="#2a2416" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// The community: Change terms
// ─────────────────────────────────────────────────────────────────────────────

export function ChangeTermsSheet({ say, kind, transport, names, parties, now, base, onClose, onDone }: {
    say: Say; kind: "event" | "product"; transport: ListingTransport;
    names: { community: string; seller: string }; parties: Parties;
    /** This listing's rate today (percent), or null when none is set. */
    now: number | null;
    /** The money at today's terms, for the "at X% now" line. */
    base: ListingMoney | null;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const start = now ?? 0;
    const [rate, setRate] = useState<number>(start);
    const [draft, setDraft] = useState<string>(String(start));
    const [preview, setPreview] = useState<ListingMoney | null | "loading">("loading");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const ref = useDialog(onClose, busy);

    // The split at the typed rate, a moment after typing stops.
    useEffect(() => {
        setPreview("loading");
        const id = setTimeout(() => {
            transport.money({ rate }).then((m) => setPreview(m ?? null)).catch(() => setPreview(null));
        }, 250);
        return () => clearTimeout(id);
    }, [rate, transport]);

    const set = (r: number) => {
        const v = Math.max(0, Math.min(100, Math.round(r * 100) / 100));
        setRate(v);
        setDraft(String(v));
    };
    const picks = Array.from(new Set([start, 5, 10, 15])).sort((a, b) => a - b);
    const same = rate === start;
    const sale = preview && preview !== "loading" ? cheapestSale(preview) : null;
    const nowSale = cheapestSale(base);
    const cur = (preview && preview !== "loading" ? preview.currency : base?.currency) ?? "EUR";
    const keepsAt = sale ? keepOf("community", sale.lines, parties) : null;

    const send = async () => {
        if (same) return;
        setBusy(true); setError("");
        try {
            await transport.propose({ commissionRate: rate });
            onDone(say("ctSent", { seller: names.seller }));
        } catch (e: any) {
            setError(e?.message || say("failed"));
            setBusy(false);
        }
    };

    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="cbtl-sheet cbtl-wide cbtl-ct" role="dialog" aria-modal="true" aria-label={say("ctTitle")} tabIndex={-1} ref={ref}>
                <span className="cbtl-wide-head">
                    <span>
                        <h3>{say("ctTitle")}</h3>
                        <p>{say("ctSub", { community: names.community, seller: names.seller })}</p>
                    </span>
                    <button type="button" className="cbtl-x" aria-label={say("cancel")} onClick={onClose} disabled={busy}><Icon d="M18 6L6 18M6 6l12 12" size={16} stroke={2} /></button>
                </span>

                <div className="cbtl-ct-body">
                    <section className="cbtl-ct-sec" aria-labelledby="cbtl-ct-l">
                        <span className="cbtl-ct-row">
                            <label id="cbtl-ct-l" htmlFor="cbtl-ct-rate" className="cbtl-kick">{say("ctRateLabel", { community: names.community })}</label>
                            <span className="cbtl-ct-now">{say("ctTheirTerms", { rate: percent(start) })}</span>
                        </span>
                        <span className="cbtl-ct-step">
                            <button type="button" aria-label={say("ctLower")} onClick={() => set(rate - 1)} disabled={busy || rate <= 0}>−</button>
                            <span className="cbtl-ct-field">
                                <input id="cbtl-ct-rate" inputMode="decimal" value={draft} disabled={busy}
                                    onChange={(e) => { setDraft(e.target.value); const v = Number(e.target.value.replace(",", ".")); if (Number.isFinite(v)) set(v); }}
                                    onBlur={() => setDraft(String(rate))} />
                                <b aria-hidden="true">%</b>
                            </span>
                            <button type="button" aria-label={say("ctRaise")} onClick={() => set(rate + 1)} disabled={busy || rate >= 100}>+</button>
                        </span>
                        <span className="cbtl-ct-picks" role="group" aria-label={say("ctRateLabel", { community: names.community })}>
                            {picks.map((p) => (
                                <button key={p} type="button" aria-pressed={rate === p} onClick={() => set(p)} disabled={busy}>
                                    {percent(p)}{p === start && <small>{say("ctNow")}</small>}
                                </button>
                            ))}
                        </span>
                    </section>

                    {preview === "loading" ? <p className="cbtl-hint">{say("pkLoading")}</p>
                        : preview === null ? <p className="cbtl-hint">{say("pkNoPreview")}</p>
                            : <OneSalePanel say={say} seat="community" kind={kind} m={preview} parties={parties} meta={metaOf(preview, rate)}
                                title={say("ctSplitTitle", { price: money(sale?.gross ?? 0, cur), rate: percent(rate) })}
                                subtitle={say("ctSplitSub", { seller: names.seller })} />}

                    {nowSale && (
                        <span className="cbtl-ct-at">
                            <span>{say("ctAtNow", { rate: percent(start) })}</span>
                            <span>{say("ctKeeps", { who: names.community, amount: money(keepOf("community", nowSale.lines, parties), cur) })}</span>
                            <span>{say("ctKeeps", { who: names.seller, amount: money(amountOf(nowSale.lines, "sellerNet") || amountOf(nowSale.lines, "seller"), cur) })}</span>
                        </span>
                    )}
                </div>

                {error && <span className="cbtl-error cbtl-wide-pad" role="alert">{error}</span>}
                <span className="cbtl-wide-foot">
                    <span className="cbtl-wide-sum">
                        {!same && keepsAt != null && <><b>{percent(rate)}</b> · {say("ctKeeps", { who: names.community, amount: money(keepsAt, cur) })}</>}
                    </span>
                    <button type="button" className="cbtl-hbtn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                    <button type="button" className="cbtl-hbtn" data-kind="primary" disabled={busy || same} onClick={send}>
                        {say("ctSend", { rate: percent(rate), seller: names.seller })}
                    </button>
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// The seller: the ask, the comparison, Premium
// ─────────────────────────────────────────────────────────────────────────────

export function AskCard({ say, names, parties, offer, now }: {
    say: Say; names: { community: string; seller: string }; parties: Parties; offer: Proposal; now: number;
}) {
    const who = offer.proposedByUser?.name ?? offer.proposedBy?.name ?? names.community;
    const ask = percent(Number(offer.commissionRate ?? 0));
    const icon = parties.community.icon;
    return (
        <section className="cbtl-ask" aria-label={say("askHeadline", { community: names.community, rate: ask })}>
            <span className="cbtl-ask-who">
                <span className="cbtl-ask-mark" aria-hidden="true">{icon ? <img src={icon} alt="" /> : <i>{names.community.slice(0, 2)}</i>}</span>
                <span className="cbtl-ask-text">
                    <span className="cbtl-kick">{say("askKicker", { who, community: names.community, date: shortDate(offer.createdAt ?? null) })}</span>
                    <b>{say("askHeadline", { community: names.community, rate: ask })}</b>
                    <small>{say("askBody", { rate: percent(now), community: names.community })}</small>
                </span>
            </span>
            <span className="cbtl-ask-terms" role="group" aria-label={`${say("askYourTerms")} ${percent(now)}, ${say("askThisListing")} ${ask}`}>
                <span className="cbtl-ask-chip"><small>{say("askYourTerms")}</small><b>{percent(now)}</b></span>
                <Icon d="M5 12h14M13 6l6 6-6 6" size={20} stroke={2} />
                <span className="cbtl-ask-chip" data-new=""><small>{say("askThisListing")}</small><b>{ask}</b></span>
            </span>
        </section>
    );
}

export function AskCompare({ say, names, now, ask, base, at, cur }: {
    say: Say; names: { community: string }; now: number; ask: number;
    base: { lines: MoneyLine[] } | null; at: { lines: MoneyLine[] } | null; cur: string;
}) {
    if (!base || !at) return null;
    const keepNow = amountOf(base.lines, "keep");
    const keepAsk = amountOf(at.lines, "keep");
    return (
        <section className="cbtl-cmp" aria-label={say("askCompare")}>
            <span className="cbtl-kick">{say("askCompare")}</span>
            <span className="cbtl-cmp-row"><span>{say("askCompareNow", { rate: percent(now) })}</span><b>{money(keepNow, cur)}</b></span>
            <span className="cbtl-cmp-row" data-ask=""><span>{say("askCompareAsk", { community: names.community, rate: percent(ask) })}</span><b>{money(keepAsk, cur)}</b></span>
            {keepNow > keepAsk && <small>{say("askCompareDiff", { amount: money(keepNow - keepAsk, cur), community: names.community })}</small>}
        </section>
    );
}

/** Cobuntu Premium, Cobuntu-branded: only for the seller, on their own item, while they are not Premium. */
export function PremiumCard({ say, keep, fee, cur, onGet, onDismiss }: {
    say: Say; keep: number; fee: number; cur: string; onGet: () => void; onDismiss: () => void;
}) {
    return (
        <section className="cbtl-prem" aria-label={say("premKicker")}>
            <span className="cbtl-prem-who">
                <span className="cbtl-prem-mark"><CobuntuMark size={34} /></span>
                <span className="cbtl-prem-text">
                    <span className="cbtl-prem-kick">{SEAL}{say("premKicker")}</span>
                    <b>{say("premTitle", { fee: money(fee, cur) })}</b>
                    <small>{say("premBody")}</small>
                </span>
            </span>
            <span className="cbtl-prem-cmp" role="group" aria-label={say("premWith")}>
                <span className="cbtl-prem-row"><span>{say("premNow")}</span><b>{money(keep, cur)}</b></span>
                <span className="cbtl-prem-row" data-with=""><span>{say("premWith")}</span><span className="cbtl-prem-gain"><i>+{money(fee, cur)}</i><b>{money(keep + fee, cur)}</b></span></span>
            </span>
            <span className="cbtl-prem-acts">
                <button type="button" className="cbtl-prem-go" onClick={onGet}>{say("premGet")}</button>
                <button type="button" className="cbtl-prem-later" onClick={onDismiss}>{say("premNotNow")}</button>
            </span>
        </section>
    );
}

/** Interval, the no-refunds waiver, then Stripe: the checkout Premium requires, from a listing. */
function PremiumStep({ say, premium, returnPath }: { say: Say; premium: PremiumCheckout; returnPath: string }) {
    const [interval, setInterval_] = useState<"MONTHLY" | "YEARLY">("YEARLY");
    const [waiver, setWaiver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const go = async () => {
        setBusy(true); setError("");
        try {
            const url = await premium.start(interval, returnPath);
            window.location.assign(url);
        } catch {
            setError(say("premFailed"));
            setBusy(false);
        }
    };
    return (
        <span className="cbtl-prem-step">
            <span className="cbtl-prem-int" role="radiogroup" aria-label={say("premKicker")}>
                {(["MONTHLY", "YEARLY"] as const).map((iv) => (
                    <button key={iv} type="button" role="radio" aria-checked={interval === iv} onClick={() => setInterval_(iv)} disabled={busy}>
                        <b>{say(iv === "MONTHLY" ? "premMonthly" : "premYearly")}</b>
                        <small>{say(iv === "MONTHLY" ? "premPerMonth" : "premPerYear", { price: iv === "MONTHLY" ? premium.monthly : premium.yearly })} · {say("premVat")}</small>
                    </button>
                ))}
            </span>
            <label className="cbtl-prem-waiver">
                <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} disabled={busy} />
                <span>{say("premWaiver")}</span>
            </label>
            {error && <span className="cbtl-error" role="alert">{error}</span>}
            <button type="button" className="cbtl-prem-go" disabled={!waiver || busy} onClick={go}>{say("premContinue")}</button>
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// The seller accepts: what it means in money, and Premium once more
// ─────────────────────────────────────────────────────────────────────────────

export function AcceptDialog({ say, item, names, parties, offer, ask, now, premium, returnPath, onClose, onAccept }: {
    say: Say; item: string; names: { community: string; seller: string }; parties: Parties;
    offer: Proposal;
    /** The money at the asked rate (money({ rate })), or null while it loads. */
    ask: ListingMoney | null;
    now: number;
    /** Given only when the seller may be offered Premium (their own item, not Premium yet). */
    premium?: PremiumCheckout;
    /** This listing page, with ?accept=<proposal>, for Premium checkout to come back to. */
    returnPath: string;
    onClose: () => void;
    onAccept: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState<"main" | "premium">("main");
    const ref = useDialog(onClose, busy);
    const rate = percent(Number(offer.commissionRate ?? 0));
    const sale = cheapestSale(ask);
    const cur = ask?.currency ?? "EUR";
    const keep = amountOf(sale?.lines, "keep");
    const fee = amountOf(sale?.lines, "cobuntu");
    const feeRate = sellerFeeRate(say, ask);
    const offerPremium = !!premium && fee > 0;
    const icon = parties.community.icon;

    const accept = async () => {
        setBusy(true); setError("");
        try { await onAccept(); } catch (e: any) { setError(e?.message || say("failed")); setBusy(false); }
    };

    const row = (label: ReactNode, amount: number, mark: ReactNode, mine?: boolean) => (
        <span className="cbtl-acc-row" data-mine={mine ? "" : undefined}>{mark}<span>{label}</span><b>{money(amount, cur)}</b></span>
    );

    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="cbtl-sheet cbtl-wide cbtl-acc" role="dialog" aria-modal="true" aria-label={say("accTitle", { rate })} tabIndex={-1} ref={ref}>
                <span className="cbtl-acc-head">
                    <h3>{say("accTitle", { rate })}</h3>
                    <p>{say("accBody", { item, community: names.community, rate, now: percent(now) })}</p>
                </span>
                <div className="cbtl-acc-body">
                    {sale ? (
                        <section className="cbtl-acc-lines" aria-label={say("accKeep")}>
                            {row(say("accKeep"), keep, <i className="cbtl-acc-dot" aria-hidden="true" />, true)}
                            {row(say("accCommission", { community: names.community, rate }), amountOf(sale.lines, "commission"),
                                <span className="cbtl-acc-mk" aria-hidden="true">{icon ? <img src={icon} alt="" /> : null}</span>)}
                            {row(<>{say("accFee")}{feeRate && <small> {feeRate}</small>}</>, fee,
                                <span className="cbtl-acc-mk" data-cob="" aria-hidden="true"><CobuntuMark size={20} /></span>)}
                            {row(say("accStripe"), amountOf(sale.lines, "stripe"), <span className="cbtl-acc-mk" data-stripe="" aria-hidden="true" />)}
                        </section>
                    ) : <p className="cbtl-hint">{say("pkLoading")}</p>}

                    {offerPremium && premium && (
                        <section className="cbtl-prem cbtl-prem-in" aria-label={say("premKicker")}>
                            <span className="cbtl-prem-who">
                                <span className="cbtl-prem-mark"><CobuntuMark size={30} /></span>
                                <span className="cbtl-prem-text">
                                    <span className="cbtl-prem-kick">{SEAL}{say("accPremKicker")}</span>
                                    <b>{say("accPremTitle", { fee: money(fee, cur) })}</b>
                                </span>
                            </span>
                            <span className="cbtl-prem-row" data-with=""><span>{say("accPremWith")}</span><span className="cbtl-prem-gain"><i>+{money(fee, cur)}</i><b>{money(keep + fee, cur)}</b></span></span>
                            <small className="cbtl-prem-note">{say("accPremBody", { rate: feeRate ?? money(fee, cur) })}</small>
                            {step === "main"
                                ? <button type="button" className="cbtl-prem-go" onClick={() => setStep("premium")} disabled={busy}>{say("accPremGo")}</button>
                                : <PremiumStep say={say} premium={premium} returnPath={returnPath} />}
                        </section>
                    )}
                </div>
                {error && <span className="cbtl-error cbtl-wide-pad" role="alert">{error}</span>}
                <span className="cbtl-wide-foot">
                    <span className="cbtl-wide-sum" />
                    <button type="button" className="cbtl-hbtn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                    <button type="button" className="cbtl-hbtn" data-kind="primary" onClick={accept} disabled={busy || !sale}>{say("askAccept", { rate })}</button>
                </span>
            </div>
        </div>
    );
}

/** "Get Premium" from the card: interval, waiver, then Stripe; back to this listing page. */
export function PremiumSheet({ say, premium, returnPath, onClose }: {
    say: Say; premium: PremiumCheckout; returnPath: string; onClose: () => void;
}) {
    const ref = useDialog(onClose, false);
    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cbtl-sheet cbtl-prem cbtl-prem-in cbtl-prem-sheet" role="dialog" aria-modal="true" aria-label={say("premKicker")} tabIndex={-1} ref={ref}>
                <span className="cbtl-prem-who">
                    <span className="cbtl-prem-mark"><CobuntuMark size={30} /></span>
                    <span className="cbtl-prem-text">
                        <span className="cbtl-prem-kick">{SEAL}{say("premKicker")}</span>
                        <small>{say("premBody")}</small>
                    </span>
                </span>
                <PremiumStep say={say} premium={premium} returnPath={returnPath} />
                <button type="button" className="cbtl-prem-later" onClick={onClose}>{say("cancel")}</button>
            </div>
        </div>
    );
}
