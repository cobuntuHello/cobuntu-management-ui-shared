"use client";

/**
 * THE SELLER CHANGES THEIR PACKAGE (T-415, decided 25 Nov 2026; canvas
 * 8YTrdyqmNdkKECpACpdd7c, page "Change package").
 *
 * PBN's Thiago listed on Champion's 0% package when he wanted PBN to promote
 * it. Packages are the community's offer, so the seller picks another PACKAGE
 * (never a typed rate) on their own listing:
 *
 *   - the cards say what the community does at each package (from its
 *     description), what the seller keeps on one sale, and which one they are on;
 *   - the chart on the right follows the pick: the ring and its legend glide to
 *     the picked package's split;
 *   - Switch applies it. A pending listing stays in review on the new package;
 *     a live one goes back to the community's review first (its own confirm).
 *
 * The backend rule lives in core shared/listings/switchPackage.ts.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CobuntuMark } from "../ui/marks";
import type { Say } from "./copy";
import { money, percent } from "./format";
import { useGlide } from "./glide";
import type { Parties } from "./MoneyStep";
import { cheapestSale } from "./terms";
import type { ListingTransport } from "./transport";
import type { ListingMoney, MoneyLine, Package } from "./types";
import { FallbackImg, Icon, StripeGlyph, personAvatarCandidates } from "./ui";
import { PackagePoints, packagePoints } from "./packagePoints";

export { PackagePoints, packagePoints, type PackagePoint } from "./packagePoints";

const amountOf = (lines: MoneyLine[] | undefined, key: MoneyLine["key"]) => lines?.find((l) => l.key === key)?.amount ?? 0;

/** The seller's split of one sale: what the ring and the legend draw. */
interface Split { gross: number; keep: number; commission: number; cobuntu: number; stripe: number }

function splitOf(m: ListingMoney | null | undefined): Split | null {
    const sale = cheapestSale(m ?? null);
    if (!sale) return null;
    return {
        gross: sale.gross,
        keep: amountOf(sale.lines, "keep"),
        commission: amountOf(sale.lines, "commission"),
        cobuntu: amountOf(sale.lines, "cobuntu"),
        stripe: amountOf(sale.lines, "stripe"),
    };
}

const COLORS = { keep: "#4e9c78", commission: "#a99f92", cobuntu: "#e0a94e", stripe: "#b9c4d6" };
const R = 92;
const CIRC = 2 * Math.PI * R;

/** The ring for the picked package; every number glides when the pick changes. */
function SplitChart({ say, split, cur, parties, community, rate }: {
    say: Say; split: Split; cur: string; parties: Parties; community: string; rate: number;
}) {
    const g = useGlide({ gross: split.gross, keep: split.keep, commission: split.commission, cobuntu: split.cobuntu, stripe: split.stripe }, true);
    const total = Math.max(1, g.gross);
    const parts = [
        { key: "keep", v: g.keep, color: COLORS.keep },
        { key: "commission", v: g.commission, color: COLORS.commission },
        { key: "cobuntu", v: g.cobuntu, color: COLORS.cobuntu },
        { key: "stripe", v: g.stripe, color: COLORS.stripe },
    ];
    const drawn = parts.filter((p) => p.v > 0).length;
    let at = 0;
    const arcs = parts.map((p) => {
        const len = (Math.max(0, p.v) / total) * CIRC;
        const dash = Math.max(0, len - (p.v > 0 && drawn > 1 ? 3 : 0));
        const arc = { ...p, dash: `${dash} ${CIRC}`, off: -at };
        at += len;
        return arc;
    });
    const s = parties.seller;
    const row = (mark: ReactNode, color: string, name: ReactNode, amount: number, mine?: boolean) => (
        <span className="cbtl-chg-lg" data-mine={mine ? "" : undefined}>
            <i className="cbtl-chg-sw" style={{ background: color }} aria-hidden="true" />
            {mark}
            <span>{name}</span>
            <b>{money(amount, cur)}</b>
        </span>
    );
    return (
        <>
            <span className="cbtl-chg-ring">
                <svg role="img" aria-label={say("chgRingLabel", { keep: money(split.keep, cur), community, commission: money(split.commission, cur), cobuntu: money(split.cobuntu, cur), stripe: money(split.stripe, cur) })} viewBox="0 0 240 240">
                    <circle cx="120" cy="120" r={R} fill="none" stroke="var(--cbtl-line-soft)" strokeWidth="22" />
                    <g transform="rotate(-90 120 120)" fill="none" strokeWidth="22">
                        {arcs.map((a) => <circle key={a.key} cx="120" cy="120" r={R} stroke={a.color} strokeDasharray={a.dash} strokeDashoffset={a.off} />)}
                    </g>
                </svg>
                <span className="cbtl-chg-hole">
                    <small>{say("chgYouKeep")}</small>
                    <b>{money(g.keep, cur)}</b>
                    <small>{say("chgOfSale", { pct: percent(Math.round((g.keep / total) * 100)) })}</small>
                </span>
            </span>
            <span className="cbtl-chg-legend">
                {row(<span className="cbtl-chg-mk" data-round=""><FallbackImg candidates={personAvatarCandidates(s.image, { id: s.id, usertag: s.usertag })} name={s.name} /></span>, COLORS.keep, say("chgYouKeep"), g.keep, true)}
                {row(<span className="cbtl-chg-mk">{parties.community.icon ? <img src={parties.community.icon} alt="" /> : null}</span>, COLORS.commission,
                    <>{community}<small>{split.commission > 0 ? say("chgCommission", { rate: percent(rate) }) : say("chgNoCommission")}</small></>, g.commission)}
                {row(<span className="cbtl-chg-mk" data-pad=""><CobuntuMark size={18} /></span>, COLORS.cobuntu, <>{say("lineCobuntu")}<small>{say("earnCobuntuFee")}</small></>, g.cobuntu)}
                {row(<span className="cbtl-chg-mk"><StripeGlyph size={26} /></span>, COLORS.stripe, <>{say("lineStripe")}<small>{say("lineStripeNote")}</small></>, g.stripe)}
            </span>
        </>
    );
}

export function PackageSwitchSheet({ say, transport, names, parties, currentId, live, onClose, onDone }: {
    say: Say; transport: ListingTransport;
    names: { community: string; seller: string }; parties: Parties;
    /** The package the listing is on now. */
    currentId: string | null;
    /** The listing is live (or paused): switching sends it back to review. */
    live: boolean;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const [packages, setPackages] = useState<Package[] | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [previews, setPreviews] = useState<Record<string, ListingMoney | null>>({});
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    // Every package's split up front: each card says what you keep on it.
    useEffect(() => {
        let alive = true;
        transport.packages()
            .then((ps) => {
                if (!alive) return;
                setPackages(ps);
                setPicked((p) => p ?? ps.find((x) => x.id !== currentId)?.id ?? ps[0]?.id ?? null);
                ps.forEach((p) => {
                    transport.money({ packageId: p.id })
                        .then((m) => { if (alive) setPreviews((v) => ({ ...v, [p.id]: m && m.previewPackage?.id === p.id ? m : (p.id === currentId ? m : null) })); })
                        .catch(() => { if (alive) setPreviews((v) => ({ ...v, [p.id]: null })); });
                });
            })
            .catch(() => { if (alive) setPackages([]); });
        return () => { alive = false; };
    }, [transport, currentId]);

    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { if (confirming) setConfirming(false); else onClose(); } };
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
    }, [busy, confirming, onClose]);

    const pkg = packages?.find((p) => p.id === picked) ?? null;
    const current = packages?.find((p) => p.id === currentId) ?? null;
    const split = useMemo(() => (picked ? splitOf(previews[picked]) : null), [picked, previews]);
    const cur = (picked && previews[picked]?.currency) || "EUR";
    const isCurrent = !!pkg && pkg.id === currentId;

    const run = async () => {
        if (!pkg || !transport.switchPackage) return;
        setBusy(true); setError("");
        try {
            const out = await transport.switchPackage(pkg.id);
            // In review (it was pending, or a live one went back): the community looks next.
            onDone(out?.status === "PENDING"
                ? say("chgDoneReview", { name: pkg.name, community: names.community })
                : say("chgDone", { name: pkg.name, community: names.community }));
        } catch (e: any) {
            setError(e?.message || say("failed"));
            setBusy(false);
            setConfirming(false);
        }
    };
    const submit = () => { if (live) setConfirming(true); else void run(); };

    const keepOn = (id: string) => splitOf(previews[id])?.keep ?? null;
    const now = currentId ? keepOn(currentId) : null;

    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="cbtl-sheet cbtl-wide cbtl-chg" role="dialog" aria-modal="true" aria-label={say("chgTitle", { community: names.community })} tabIndex={-1} ref={ref}>
                <span className="cbtl-wide-head">
                    {parties.community.icon && <img className="cbtl-chg-logo" src={parties.community.icon} alt="" />}
                    <span>
                        <h3>{say("chgTitle", { community: names.community })}</h3>
                        <p>{say("chgSub", { community: names.community })}</p>
                    </span>
                    <button type="button" className="cbtl-x" aria-label={say("cancel")} onClick={onClose} disabled={busy}><Icon d="M18 6L6 18M6 6l12 12" size={16} stroke={2} /></button>
                </span>

                {packages === null ? <p className="cbtl-wide-pad">{say("loading")}</p> : packages.length === 0 ? (
                    <p className="cbtl-wide-pad">{say("composeNoPackages", { community: names.community })}</p>
                ) : (
                    <div className="cbtl-chg-body">
                        <div className="cbtl-chg-cards" role="radiogroup" aria-label={say("chgPackages", { community: names.community })}>
                            {packages.map((p) => {
                                const keep = keepOn(p.id);
                                const on = p.id === picked;
                                const mine = p.id === currentId;
                                const less = !mine && keep != null && now != null && keep < now ? now - keep : 0;
                                return (
                                    <button key={p.id} type="button" role="radio" aria-checked={on} className="cbtl-chg-card" onClick={() => setPicked(p.id)} disabled={busy}>
                                        <span className="cbtl-chg-top">
                                            <i className="cbtl-rad" aria-hidden="true" />
                                            <span className="cbtl-chg-name"><b>{p.name}</b>{mine && <small>{say("chgYourNow")}</small>}</span>
                                            <strong className="cbtl-chg-rate">{percent(Number(p.rate))}</strong>
                                        </span>
                                        <PackagePoints points={packagePoints(p.description)} />
                                        <span className="cbtl-chg-keep">
                                            <span>{say("chgKeepSale")}</span>
                                            {less > 0 && <small>{say("chgLess", { amount: money(less, cur) })}</small>}
                                            <b>{keep == null ? "…" : money(keep, cur)}</b>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <section className="cbtl-chg-chart" aria-label={pkg ? say("chgChartOn", { name: pkg.name }) : undefined}>
                            <span className="cbtl-chg-chart-head">
                                <small>{pkg ? say("chgChartOn", { name: pkg.name }) : ""}</small>
                                <b>{split ? say("chgWhereGoes", { price: money(split.gross, cur) }) : say("pkLoading")}</b>
                            </span>
                            {split && <SplitChart say={say} split={split} cur={cur} parties={parties} community={names.community} rate={Number(pkg?.rate ?? 0)} />}
                        </section>
                    </div>
                )}

                {error && <span className="cbtl-error cbtl-wide-pad" role="alert">{error}</span>}
                <span className="cbtl-wide-foot">
                    <span className="cbtl-wide-sum cbtl-chg-note">
                        <span className="cbtl-chg-clock" aria-hidden="true"><Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" size={17} stroke={2} /></span>
                        {say("chgReviewNote", { community: names.community })}
                    </span>
                    <button type="button" className="cbtl-hbtn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                    <button type="button" className="cbtl-hbtn" data-kind="primary" disabled={busy || !pkg || isCurrent} onClick={submit}>
                        {!pkg ? say("chgMove") : isCurrent ? say("chgYourNow") : say("chgSwitchTo", { name: pkg.name })}
                    </button>
                </span>

                {confirming && pkg && (
                    <div className="cbtl-chg-confirm" role="alertdialog" aria-modal="true" aria-label={say("chgLiveTitle")}>
                        <div className="cbtl-chg-confirm-card">
                            <h3>{say("chgLiveTitle")}</h3>
                            <p>{say("chgLiveBody", { community: names.community, name: pkg.name })}</p>
                            <span className="cbtl-chg-states">
                                <span data-was=""><small>{say("chgLiveNow")}</small><b>{current ? `${current.name} · ${percent(Number(current.rate))}` : ""}</b></span>
                                <Icon d="M5 12h14M13 6l6 6-6 6" size={18} stroke={2} />
                                <span><small>{say("chgInReview", { community: names.community })}</small><b>{`${pkg.name} · ${percent(Number(pkg.rate))}`}</b></span>
                            </span>
                            <p className="cbtl-chg-kept">{say("chgSalesKeep")}</p>
                            <span className="cbtl-chg-confirm-foot">
                                <button type="button" className="cbtl-hbtn" onClick={() => setConfirming(false)} disabled={busy}>{say("chgKeepLive")}</button>
                                <button type="button" className="cbtl-hbtn" data-kind="primary" onClick={() => void run()} disabled={busy}>{say("chgSwitchSend", { community: names.community })}</button>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
