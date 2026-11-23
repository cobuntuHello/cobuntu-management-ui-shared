"use client";

/**
 * The seller's booking, changed on the listing page itself (listing page v2;
 * the community app does everything in the app, decided 23 Nov 2026).
 *
 *   CardSheet     a new card: Stripe's own form embedded in the sheet when the
 *                 host gives a publishable key, else Stripe's page and back.
 *   RequestSheet  the guest count, the one free date change (priced by
 *                 Cobuntu from the venue's rules, never by this page), and the
 *                 logistics and marketing answers, with the venue site's own
 *                 questions and choices.
 */
import { useEffect, useRef, useState } from "react";
import type { Say } from "./copy";
import { money, shortDate } from "./format";
import type { DateOptions, DateQuote, ListingTransport } from "./transport";
import type { BookingView } from "./types";
import { Sheet } from "./ui";

// ── the card ────────────────────────────────────────────────────────────────

const STRIPE_JS = "https://js.stripe.com/v3";

/** Stripe.js from Stripe's own address, once per page (Stripe requires it be loaded from there). */
function loadStripe(): Promise<any> {
    const w = window as any;
    if (w.Stripe) return Promise.resolve(w.Stripe);
    if (w.__cbtlStripe) return w.__cbtlStripe;
    w.__cbtlStripe = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = STRIPE_JS;
        s.async = true;
        s.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error("Stripe did not load")));
        s.onerror = () => reject(new Error("Stripe did not load"));
        document.head.appendChild(s);
    });
    return w.__cbtlStripe;
}

export function CardSheet({ say, transport, eventId, publishableKey, returnUrl, onClose, navigate }: {
    say: Say; transport: ListingTransport; eventId: string; publishableKey?: string; returnUrl: string; onClose: () => void;
    /** How to leave for Stripe's page; the browser's own navigation unless the host routes it. */
    navigate?: (url: string) => void;
}) {
    const mount = useRef<HTMLDivElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let checkout: any = null;
        let cancelled = false;
        (async () => {
            try {
                if (!transport.startCardChange) throw new Error(say("failed"));
                if (!publishableKey) {
                    // No key for the embedded form: Stripe's own page, then back here.
                    const r = await transport.startCardChange(eventId, { returnUrl, embedded: false });
                    if (r.checkoutUrl) (navigate ?? ((u: string) => window.location.assign(u)))(r.checkoutUrl);
                    return;
                }
                const r = await transport.startCardChange(eventId, { returnUrl, embedded: true });
                if (!r.clientSecret) throw new Error(say("failed"));
                const Stripe = await loadStripe();
                if (cancelled) return;
                checkout = await Stripe(publishableKey).initEmbeddedCheckout({ fetchClientSecret: async () => r.clientSecret });
                if (cancelled) { checkout.destroy(); return; }
                checkout.mount(mount.current);
                setLoading(false);
            } catch (e: any) {
                if (!cancelled) { setError(e?.message || say("failed")); setLoading(false); }
            }
        })();
        return () => { cancelled = true; try { checkout?.destroy(); } catch { /* already gone */ } };
    }, [eventId, publishableKey, returnUrl, say, transport, navigate]);
    return (
        <Sheet title={say("sheetCardTitle")} onClose={onClose}>
            <p>{say("sheetCardBody")}</p>
            {loading && <p>{publishableKey ? say("sheetCardLoading") : say("sheetCardRedirect")}</p>}
            {error && <span className="cbtl-error" role="alert">{error}</span>}
            <div ref={mount} />
            <div className="cbtl-sheet-foot"><button type="button" className="cbtl-btn" onClick={onClose}>{say("cancel")}</button></div>
        </Sheet>
    );
}

// ── the request ─────────────────────────────────────────────────────────────

/** The venue site's questions (teja-website BookingDetails.tsx), same choices. */
const FORMATS = ["One-off", "Weekly", "Monthly", "Other"];
const OUTSIDE = ["Earlier access, before the event starts", "Later access, after the event ends"];
const SHARE = ["Yes", "No"];
const CONTACT = ["A call first", "Email"];
const DEFAULT_DURATIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

type Section = Record<string, string | string[]>;

function Choice({ label, options, value, onPick, disabled }: { label: string; options: string[]; value?: string; onPick: (v: string) => void; disabled?: boolean }) {
    return (
        <div className="cbtl-choices" role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={value === o} className="cbtl-choice" disabled={disabled} onClick={() => onPick(o)}>{o}</button>
            ))}
        </div>
    );
}

export function RequestSheet({ say, transport, eventId, booking, guestCount, locked, community, currency, onClose, onSaved }: {
    say: Say; transport: ListingTransport; eventId: string; booking: BookingView; guestCount: number | null; locked: boolean;
    community: string; currency: string; onClose: () => void; onSaved: (message: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [guests, setGuests] = useState(String(guestCount ?? booking.guestCount ?? ""));
    const [log, setLog] = useState<Section>((booking.details?.logistics as Section) ?? {});
    const [mkt, setMkt] = useState<Section>((booking.details?.marketing as Section) ?? {});
    const [day, setDay] = useState("");
    const [hours, setHours] = useState(3);
    const [options, setOptions] = useState<DateOptions | null>(null);
    const [start, setStart] = useState<number | null>(null);
    const [quote, setQuote] = useState<DateQuote | null>(null);
    const canDate = !!(transport.dateOptions && transport.dateQuote && transport.changeDate);
    const dateUsed = !!booking.dateChangedAt;

    async function run(fn: () => Promise<void>, ok: string) {
        setBusy(true);
        setError("");
        try { await fn(); onSaved(ok); } catch (e: any) { setError(e?.message || say("failed")); } finally { setBusy(false); }
    }

    useEffect(() => {
        setStart(null);
        setQuote(null);
        if (!day || !transport.dateOptions) { setOptions(null); return; }
        let live = true;
        transport.dateOptions(eventId, day, hours).then((o) => { if (live) setOptions(o); }).catch((e) => { if (live) setError(e?.message || say("failed")); });
        return () => { live = false; };
    }, [day, hours, eventId, transport, say]);

    useEffect(() => {
        setQuote(null);
        if (start == null || !day || !transport.dateQuote) return;
        let live = true;
        transport.dateQuote(eventId, { date: day, start, hours }).then((q) => { if (live) setQuote(q); }).catch((e) => { if (live) setError(e?.message || say("failed")); });
        return () => { live = false; };
    }, [start, day, hours, eventId, transport, say]);

    const set = (sect: "log" | "mkt", k: string, v: string | string[]) => (sect === "log" ? setLog({ ...log, [k]: v }) : setMkt({ ...mkt, [k]: v }));
    const text = (sect: Section, k: string) => (typeof sect[k] === "string" ? (sect[k] as string) : "");
    const list = (sect: Section, k: string) => (Array.isArray(sect[k]) ? (sect[k] as string[]) : []);

    return (
        <Sheet title={say("sheetRequestTitle")} onClose={onClose} busy={busy}>
            {locked && <p>{say("sheetLocked", { community })}</p>}
            {error && <span className="cbtl-error" role="alert">{error}</span>}

            {transport.setGuests && (
                <div className="cbtl-field">
                    <span className="cbtl-label">{say("sheetGuests")}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input className="cbtl-input" type="number" min={1} max={10000} value={guests} disabled={locked || busy} onChange={(e) => setGuests(e.target.value)} aria-label={say("sheetGuests")} />
                        <button type="button" className="cbtl-btn" disabled={locked || busy || !(Number(guests) >= 1)} onClick={() => run(() => transport.setGuests!(eventId, Math.round(Number(guests))), say("saved"))}>{say("sheetSaveGuests")}</button>
                    </div>
                </div>
            )}

            {canDate && (
                <div className="cbtl-field">
                    <span className="cbtl-label">{say("sheetDate")}</span>
                    {dateUsed ? <p>{say("sheetDateUsed", { community })}</p> : (
                        <>
                            <p>{say("sheetDateHint")}</p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input className="cbtl-input" type="date" value={day} disabled={busy} onChange={(e) => setDay(e.target.value)} aria-label={say("sheetDay")} style={{ flex: "1 1 160px" }} />
                                <select className="cbtl-select" value={hours} disabled={busy} onChange={(e) => setHours(Number(e.target.value))} aria-label={say("sheetHours")} style={{ flex: "0 0 120px", height: 42 }}>
                                    {(options?.durations ?? DEFAULT_DURATIONS).map((h) => <option key={h} value={h}>{h}h</option>)}
                                </select>
                            </div>
                            {options && (
                                <div className="cbtl-slots" role="group" aria-label={say("sheetStart")}>
                                    {options.slots.map((sl) => (
                                        <button key={sl.at} type="button" className="cbtl-slot" aria-pressed={start === sl.at} disabled={!!sl.blocked || busy} title={sl.blocked ?? undefined} onClick={() => setStart(sl.at)}>{sl.label}</button>
                                    ))}
                                </div>
                            )}
                            {quote && (
                                <p>
                                    {say("sheetQuote", { total: money(quote.totalCents, currency), paid: money(quote.paidCents, currency), second: money(quote.secondPaymentCents, currency) })}
                                    {quote.secondChargeDueAt ? ` ${shortDate(quote.secondChargeDueAt)}.` : ""}
                                    {quote.member ? ` ${say("sheetQuoteMember")}.` : ""}
                                </p>
                            )}
                            <div className="cbtl-sheet-foot">
                                <button type="button" className="cbtl-btn" data-kind="go" disabled={!quote || busy} onClick={() => run(() => transport.changeDate!(eventId, { date: day, start: start!, hours }), say("saved"))}>{say("sheetMoveDate")}</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {transport.setDetails && (
                <>
                    <div className="cbtl-field"><span className="cbtl-label">{say("logistics")}</span></div>
                    <div className="cbtl-field">
                        <span className="cbtl-label">{say("sheetFormat")}</span>
                        <Choice label={say("sheetFormat")} options={FORMATS} value={text(log, "format")} disabled={locked || busy} onPick={(v) => set("log", "format", v)} />
                    </div>
                    {text(log, "format") === "Other" && (
                        <label className="cbtl-field"><span className="cbtl-label">{say("sheetFormatOther")}</span>
                            <input className="cbtl-input" maxLength={200} value={text(log, "formatOther")} disabled={locked || busy} onChange={(e) => set("log", "formatOther", e.target.value)} /></label>
                    )}
                    <label className="cbtl-field"><span className="cbtl-label">{say("sheetSchedule")}</span>
                        <textarea className="cbtl-textarea" maxLength={4000} value={text(log, "schedule")} disabled={locked || busy} onChange={(e) => set("log", "schedule", e.target.value)} /></label>
                    <div className="cbtl-field">
                        <span className="cbtl-label">{say("sheetOutside")} <i>{say("optional")}</i></span>
                        <div className="cbtl-choices">
                            {OUTSIDE.map((o) => {
                                const on = list(log, "outside").includes(o);
                                return <button key={o} type="button" role="checkbox" aria-checked={on} className="cbtl-choice" disabled={locked || busy}
                                    onClick={() => set("log", "outside", on ? list(log, "outside").filter((x) => x !== o) : [...list(log, "outside"), o])}>{o}</button>;
                            })}
                        </div>
                    </div>
                    <label className="cbtl-field"><span className="cbtl-label">{say("sheetAccessSetup")} <i>{say("optional")}</i></span>
                        <textarea className="cbtl-textarea" maxLength={4000} value={text(log, "accessSetup")} disabled={locked || busy} onChange={(e) => set("log", "accessSetup", e.target.value)} /></label>
                    <label className="cbtl-field"><span className="cbtl-label">{say("sheetPrevious")} <i>{say("optional")}</i></span>
                        <textarea className="cbtl-textarea" maxLength={4000} value={text(log, "previous")} disabled={locked || busy} onChange={(e) => set("log", "previous", e.target.value)} /></label>
                    <div className="cbtl-field"><span className="cbtl-label">{say("marketing")}</span></div>
                    <label className="cbtl-field"><span className="cbtl-label">{say("sheetPlan")}</span>
                        <textarea className="cbtl-textarea" maxLength={4000} value={text(mkt, "plan")} disabled={locked || busy} onChange={(e) => set("mkt", "plan", e.target.value)} /></label>
                    <div className="cbtl-field"><span className="cbtl-label">{say("sheetShare")}</span>
                        <Choice label={say("sheetShare")} options={SHARE} value={text(mkt, "share")} disabled={locked || busy} onPick={(v) => set("mkt", "share", v)} /></div>
                    <label className="cbtl-field"><span className="cbtl-label">{say("sheetMore")} <i>{say("optional")}</i></span>
                        <textarea className="cbtl-textarea" maxLength={4000} value={text(mkt, "more")} disabled={locked || busy} onChange={(e) => set("mkt", "more", e.target.value)} /></label>
                    <div className="cbtl-field"><span className="cbtl-label">{say("sheetContact")} <i>{say("optional")}</i></span>
                        <Choice label={say("sheetContact")} options={CONTACT} value={text(mkt, "contact")} disabled={locked || busy} onPick={(v) => set("mkt", "contact", v)} /></div>
                    <div className="cbtl-sheet-foot">
                        <button type="button" className="cbtl-btn" data-kind="go" disabled={locked || busy} onClick={() => run(() => transport.setDetails!(eventId, { logistics: log, marketing: mkt }), say("saved"))}>{say("sheetSaveDetails")}</button>
                    </div>
                </>
            )}
            <div className="cbtl-sheet-foot"><button type="button" className="cbtl-btn" onClick={onClose} disabled={busy}>{say("done")}</button></div>
        </Sheet>
    );
}

/** The community's price for an add-on someone asked for, before VAT. */
export function PriceSheet({ say, name, currency, onClose, onSend }: { say: Say; name: string; currency: string; onClose: () => void; onSend: (cents: number) => Promise<void> }) {
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const per = currency.toUpperCase() === "JPY" ? 1 : 100;
    const cents = Math.round(Number(value.replace(",", ".")) * per);
    return (
        <Sheet title={say("upPropose", { name })} onClose={onClose} busy={busy}>
            <label className="cbtl-field">
                <span className="cbtl-label">{say("priceBeforeVat", { currency: currency.toUpperCase() })}</span>
                <input className="cbtl-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            {error && <span className="cbtl-error" role="alert">{error}</span>}
            <div className="cbtl-sheet-foot">
                <button type="button" className="cbtl-btn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                <button type="button" className="cbtl-btn" data-kind="go" disabled={busy || !(cents > 0)} onClick={async () => {
                    setBusy(true); setError("");
                    try { await onSend(cents); onClose(); } catch (e: any) { setError(e?.message || say("failed")); setBusy(false); }
                }}>{say("composeSend")}</button>
            </div>
        </Sheet>
    );
}
