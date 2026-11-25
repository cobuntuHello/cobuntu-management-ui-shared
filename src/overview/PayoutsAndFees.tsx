import type { CSSProperties, ReactNode } from "react";
import type { OverviewMoney, FeeRates, StripeDestination, OwnershipModel, FeeBreakdown } from "./types";
import { CobuntuMark } from "../listings/ui/marks";
import { FallbackImg, StripeGlyph, personAvatarCandidates } from "../listings/v2/ui";

/**
 * WHERE THE MONEY GOES (Overview). Option A of the 25 Nov 2026 mock, built
 * from its artboards (A · Before the first sale, A · Selling, A · on a phone).
 *
 * A ring with the exact lines beside it, then one payouts tile:
 *
 *   1. A RING, NOT A BAR. A bar reads as progress where nothing progresses
 *      (the money-UI rule). Its centre answers the one question the seller
 *      arrives with: "Impact Hub got €301.65 of €339.48".
 *
 *   2. NEVER A ROW OF ZEROS. Before the first sale the card shows ONE sale's
 *      split ("Impact Hub gets €32.96 of every €36.90"), which the backend
 *      sends as `money.oneSale`, split by finances through the item's one
 *      live listing. A free item gets one line instead of the card.
 *
 *   3. EVERY PARTY BY NAME, WITH ITS REAL MARK. "Impact Hub keeps", "PBN's
 *      commission", Cobuntu, Stripe. VAT is a line under the owner's own row
 *      (theirs to declare), not a slice: it is part of what they keep.
 *
 *   4. ONE PAYOUTS TILE whose colour says the state: amber when something is
 *      needed (connect Stripe, payouts off), green once money went out with
 *      nothing waiting, neutral while it is on its way.
 *
 * Owner's side only (ManageOverview hides it for a carrier or a single
 * community's view), so it never shows Cobuntu's cut OF the community's
 * commission: a member seller never sees the platform's deal with the
 * community, and the backend leaves it out of the one-sale split.
 *
 * Renders nothing on a backend that predates the fields (no `breakdown` or no
 * `ownership`); the tiles above stand on their own.
 */

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Who a slice of money belongs to, drawn the way the listing page draws it. */
export type MoneyParty = { kind: "community" | "user"; name: string; imageUrl: string | null };

const MARK = 32;

/* One colour per party, told apart by lightness as well as hue. */
const COLOR = { net: "#2F7A57", community: "#E0A030", cobuntu: "#8B93A1", stripe: "#635BFF" } as const;

function initialsOf(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * The party's real mark, as on the listing page's Earnings: a community
 * square with its icon, a person round with their photo or library avatar.
 * Inline sizes, so a host page without the listing page's stylesheet still
 * draws them.
 */
function PartyMark({ party }: { party: MoneyParty | null }) {
    const box = "inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-zinc-200 text-[10px] font-bold text-zinc-600 [&>img]:h-full [&>img]:w-full [&>img]:object-cover";
    if (!party) {
        // The community side with no single community to name (several carry it).
        return (
            <span aria-hidden="true" className={`${box} rounded-lg text-zinc-500`} style={{ width: MARK, height: MARK }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
        );
    }
    if (party.kind === "community") {
        return (
            <span aria-hidden="true" className={`${box} rounded-lg`} style={{ width: MARK, height: MARK }}>
                {party.imageUrl ? <img src={party.imageUrl} alt="" /> : initialsOf(party.name)}
            </span>
        );
    }
    return (
        <span aria-hidden="true" className={`${box} rounded-full`} style={{ width: MARK, height: MARK }}>
            <FallbackImg candidates={personAvatarCandidates(party.imageUrl, null)} name={party.name} />
        </span>
    );
}

function CobuntuBadge() {
    return (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-zinc-200" style={{ width: MARK, height: MARK }}>
            <CobuntuMark size={MARK - 10} />
        </span>
    );
}

/** A percent that shows decimals only when it has them: 8, not 8.00. */
function pct(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** A share of the whole, as people say it: 89%, 6.5%, 2.2%. */
function share(part: number, whole: number): string {
    if (whole <= 0) return "";
    const p = (part / whole) * 100;
    return `${p >= 10 ? Math.round(p) : Math.round(p * 10) / 10}%`;
}

/**
 * The owner's name as the ring's centre can hold it, or null to leave it out.
 *
 * The centre is a circle about 110px across at its top line, and a full name
 * ran into the ring ("PBN | Porto Business Network gets"). Community names
 * often carry a tagline after a bar or a dash, and the part before it is the
 * name people use, so the centre takes that. A name still longer than two
 * short lines drops out ("Keeps €9.10"): the owner's own line beside the ring
 * names them in full either way.
 */
const RING_NAME_MAX = 22;
export function ringName(name: string): string | null {
    const brand = name.split(/\s+[|·•–—-]\s+/)[0].trim();
    return brand && brand.length <= RING_NAME_MAX ? brand : null;
}

/** The bank label from what Stripe gave us, as much of it as exists. */
function accountLine(d: StripeDestination, t: T): string {
    const who = t(d.scope === "community" ? "feesDestCommunity" : "feesDestUser");
    const bank = [d.bankBrand, d.last4 ? `••${d.last4}` : null].filter(Boolean).join(" ");
    const tail = [bank || null, d.country].filter(Boolean).join(" · ");
    return tail ? `${who} · ${tail}` : who;
}

/** One party's slice of the money: its line beside the ring, its arc in it. */
type Slice = {
    key: "net" | "community" | "cobuntu" | "stripe";
    label: string;
    /** The line under the name: what this row includes, or how it is worked out. */
    sub?: string | null;
    amount: number;
    display: string;
    color: string;
    mark: ReactNode;
    /** The mark's corner, so the phone's party-coloured ring follows its shape. */
    round: boolean;
};

/*
 * The ring. Arcs are shares of the whole, drawn with stroke dashes on one
 * circle each, with a small gap between neighbours and a floor so a 74-cent
 * fee on a €36.90 ticket is still a visible sliver. The lines beside it carry
 * the exact figures, so the ring never has to be measured.
 */
const R = 70;
const C = 2 * Math.PI * R;
const GAP = 3;
const FLOOR = 2.5;

function Ring({ slices, whole, label, children }: { slices: Slice[]; whole: number; label: string; children: ReactNode }) {
    const drawn = whole > 0 ? slices.filter((s) => s.amount > 0) : [];
    let at = 0;
    const arcs = drawn.map((s) => {
        const span = (s.amount / whole) * C;
        const arc = { key: s.key, color: s.color, len: Math.max(span - GAP, FLOOR), offset: at };
        at += span;
        return arc;
    });
    return (
        <div className="relative shrink-0 self-center" style={{ width: 200, height: 200 }}>
            <svg width="200" height="200" viewBox="0 0 180 180" role="img" aria-label={label} className="absolute inset-0">
                <circle cx="90" cy="90" r={R} fill="none" stroke="#e4e4e7" strokeWidth="20" />
                {arcs.map((a) => (
                    <circle
                        key={a.key}
                        data-arc={a.key}
                        cx="90" cy="90" r={R} fill="none"
                        stroke={a.color} strokeWidth="20"
                        strokeDasharray={`${a.len.toFixed(2)} ${C.toFixed(2)}`}
                        strokeDashoffset={(-a.offset).toFixed(2)}
                        transform="rotate(-90 90 90)"
                    />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-8 text-center">{children}</div>
        </div>
    );
}

/**
 * A line beside the ring: the party's colour, mark, name, and what it got.
 * On a phone the colour moves onto a ring round the mark and the share drops
 * (A · on a phone), so the name keeps the width.
 */
function Line({ slice, share: s, last }: { slice: Slice; share: string; last: boolean }) {
    return (
        <div className={`flex items-center gap-2.5 py-3 sm:gap-3 ${last ? "" : "border-b border-zinc-200"}`}>
            <span aria-hidden="true" className="hidden h-2.5 w-2.5 shrink-0 rounded-full sm:inline-block" style={{ background: slice.color }} />
            <span
                className={`inline-flex shrink-0 ${slice.round ? "rounded-full" : "rounded-lg"} shadow-[0_0_0_2px_var(--party)] sm:shadow-none`}
                style={{ "--party": slice.color } as CSSProperties}
            >
                {slice.mark}
            </span>
            {/* Wraps rather than truncates: a clipped name hides whose amount it is. */}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold leading-snug text-zinc-900">{slice.label}</span>
                {slice.sub ? <span className="text-[12.5px] leading-snug text-zinc-500">{slice.sub}</span> : null}
            </span>
            {slice.display ? (
                <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[15px] font-bold tabular-nums text-zinc-900">{slice.display}</span>
                    {s ? <span className="hidden text-[12px] tabular-nums text-zinc-500 sm:block">{s}</span> : null}
                </span>
            ) : null}
        </div>
    );
}

/** The payouts tile: one state, one colour, at most one action. */
function PayoutTile({ tone, icon, title, sub, action }: {
    tone: "amber" | "green" | "neutral";
    icon: ReactNode;
    title: string;
    sub?: string | null;
    action?: ReactNode;
}) {
    const box = tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white";
    const head = tone === "amber" ? "text-amber-950" : tone === "green" ? "text-emerald-950" : "text-zinc-900";
    const body = tone === "amber" ? "text-amber-800" : tone === "green" ? "text-emerald-800" : "text-zinc-600";
    return (
        <div data-tone={tone} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 lg:col-span-2 ${box}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                {icon}
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-semibold ${head}`}>{title}</span>
                    {sub ? <span className={`text-[13px] ${body}`}>{sub}</span> : null}
                </div>
            </div>
            {action}
        </div>
    );
}

function CheckDisc() {
    return (
        <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: COLOR.net }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
    );
}

function ClockDisc() {
    return (
        <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </span>
    );
}

export function PayoutsAndFees({
    money, ownership, rates, destination, t, cash, locale = "en-GB", owner = null, broker = null, connectStripeHref = null,
    kind = "product", sold = 0,
}: {
    money: OverviewMoney;
    ownership?: OwnershipModel;
    rates?: FeeRates;
    destination?: StripeDestination | null;
    t: T;
    cash: (n: number) => string;
    locale?: string;
    /** Who keeps the net: the owning community or person. Null draws a neutral mark. */
    owner?: MoneyParty | null;
    /** The community taking the commission, when exactly one does. */
    broker?: MoneyParty | null;
    /**
     * Where to connect Stripe, when no account is connected and this viewer is
     * the one who can connect it (the owning person, or the owning community's
     * leaders). The host decides; null shows no button.
     */
    connectStripeHref?: string | null;
    /** Tickets or sales: what one sale is called, and when its money goes out. */
    kind?: "product" | "event";
    /** How many were sold, for "10 tickets". */
    sold?: number;
}) {
    if (!money.breakdown || !ownership) return null;

    const hasSales = money.gross > 0;
    const isMember = ownership === "member";
    const isEvent = kind === "event";

    // A free item: nothing changes hands, so there is nothing to break down.
    if (!hasSales && money.free) {
        return (
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-8">
                <h3 className="m-0 text-[17px] font-bold tracking-tight text-zinc-900">{t("overviewMoneyTitle")}</h3>
                <p className="m-0 text-[13.5px] text-zinc-600">{t("feesFree")}</p>
            </div>
        );
    }

    // Before the first sale: one sale's split, when the backend could say it.
    const one = !hasSales ? money.oneSale ?? null : null;
    const b: FeeBreakdown = hasSales ? money.breakdown : one ?? money.breakdown;
    const whole = hasSales ? money.gross : one ? one.gross : 0;
    const shown = whole > 0;

    // Who keeps the net, as the card names them. A member reads their own card.
    const ownerName = owner?.name?.trim() || null;
    const named = !isMember && ownerName ? ownerName : null;
    const centreName = named ? ringName(named) : null;
    const count = t(isEvent ? (sold === 1 ? "feesCountTicket" : "feesCountTickets") : (sold === 1 ? "feesCountSale" : "feesCountSales"), { count: sold });

    const commissionRate = rates?.communityPct ?? null;
    const cobuntuRate = !isMember ? rates?.cobuntuPct ?? null : null;
    // The member's own fee, stated as the rate it is (its amount's share of the price is not).
    const sellerFeePct = isMember ? rates?.sellerFeePct ?? null : null;
    const sellerFeeFixed = rates?.sellerFeeFixed ?? 0;

    const slices: Slice[] = [
        {
            key: "net",
            label: isMember ? t("feesYouKeep") : named ? t("feesPartyKeeps", { name: named }) : t("feesCommunityNet"),
            // VAT is inside what the owner keeps (theirs to declare), not a slice of its own.
            sub: b.vat > 0 ? t(isMember ? "feesIncludesVatYours" : "feesIncludesVatTheirs", { amount: cash(b.vat) }) : null,
            amount: b.net,
            display: cash(b.net),
            color: COLOR.net,
            mark: <PartyMark party={owner ?? { kind: isMember ? "user" : "community", name: "", imageUrl: null }} />,
            round: (owner?.kind ?? (isMember ? "user" : "community")) === "user",
        },
        // No line for a community that takes nothing (a community's own item, sold on itself).
        ...(b.community > 0 || commissionRate != null
            ? [{
                key: "community" as const,
                label: broker?.name ? t("feesPartyCommission", { name: broker.name }) : t("feesCommunityCommission"),
                sub: commissionRate != null
                    ? t(b.vat > 0 ? "feesRateOfPriceBeforeVat" : "feesRateOfPrice", { rate: pct(commissionRate) })
                    : null,
                amount: b.community,
                display: cash(b.community),
                color: COLOR.community,
                mark: <PartyMark party={broker} />,
                round: broker?.kind === "user",
            }]
            : []),
        {
            key: "cobuntu",
            label: t("feesCobuntu"),
            sub: cobuntuRate != null
                ? t(isEvent ? "feesPlatformFeeRateTickets" : "feesPlatformFeeRate", { rate: pct(cobuntuRate) })
                : sellerFeePct != null && sellerFeePct > 0
                    ? (sellerFeeFixed > 0
                        ? t("feesPlatformFeeYourShare", { rate: pct(sellerFeePct), fixed: cash(sellerFeeFixed) })
                        : t("feesPlatformFeeYourShareRate", { rate: pct(sellerFeePct) }))
                    : t("feesPlatformFee"),
            amount: b.cobuntu,
            display: cash(b.cobuntu),
            color: COLOR.cobuntu,
            mark: <CobuntuBadge />,
            round: false,
        },
        {
            key: "stripe",
            label: t("feesStripe"),
            sub: t("feesCardProcessing"),
            amount: b.stripe,
            // One sale's Stripe fee depends on the card: an estimate, said as one.
            display: one ? t("feesAbout", { amount: cash(b.stripe) }) : cash(b.stripe),
            color: COLOR.stripe,
            mark: <StripeGlyph size={MARK} />,
            round: false,
        },
    ];

    const ringLabel = shown
        ? `${hasSales ? t("feesTaken", { amount: cash(whole) }) : t("feesOnEvery", { amount: cash(whole) })}: ${slices.filter((s) => s.amount > 0).map((s) => `${s.label} ${s.display}`).join(", ")}`
        : t("feesNothingSoldYet");

    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

    /* The payouts tile: one state, one colour. */
    const connected = !!destination && destination.connected;
    let tile: ReactNode;
    if (!connected) {
        tile = (
            <PayoutTile
                tone="amber"
                icon={<StripeGlyph size={40} />}
                title={!connectStripeHref ? t("feesDestNone") : named ? t("feesConnectToGetPaid", { name: named }) : t("feesConnectToGetPaidYou")}
                sub={t(isEvent ? "feesPaysOutEvent" : "feesPaysOutItem")}
                action={connectStripeHref ? (
                    <a
                        href={connectStripeHref}
                        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    >
                        {t("feesConnectStripe")}
                    </a>
                ) : null}
            />
        );
    } else {
        const account = accountLine(destination!, t);
        if (!destination!.payoutsEnabled) {
            tile = <PayoutTile tone="amber" icon={<StripeGlyph size={40} />} title={t("feesDestPayoutsOff")} sub={t("feesLandsIn", { account })} />;
        } else if (money.held > 0 && money.nextPayoutAt) {
            tile = <PayoutTile tone="neutral" icon={<ClockDisc />} title={t("feesHeldUntil", { amount: cash(money.held), date: day(money.nextPayoutAt) })} sub={t("feesLandsIn", { account })} />;
        } else if (money.due > 0) {
            tile = <PayoutTile tone="neutral" icon={<ClockDisc />} title={t("feesReadyToPayOut", { amount: cash(money.due) })} sub={t("feesLandsIn", { account })} />;
        } else if (money.paid > 0) {
            tile = <PayoutTile tone="green" icon={<CheckDisc />} title={t("feesPaidOutSoFar", { amount: cash(money.paid) })} sub={t("feesNothingWaiting", { account })} />;
        } else {
            tile = <PayoutTile tone="neutral" icon={<StripeGlyph size={40} />} title={t("feesLandsIn", { account })} sub={t("feesNextPayoutNone")} />;
        }
    }

    return (
        <div className="grid gap-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:gap-y-7 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-x-11">
            <div className="flex min-w-0 flex-col gap-[18px]">
                <div className="flex flex-col gap-1">
                    <h3 className="m-0 text-[17px] font-bold tracking-tight text-zinc-900 sm:text-[18px]">{t("overviewMoneyTitle")}</h3>
                    <p className="m-0 text-[13px] text-zinc-500">
                        {hasSales ? `${t("feesTaken", { amount: cash(money.gross) })} · ${count}` : t("feesNothingSoldYet")}
                    </p>
                </div>
                <Ring slices={slices} whole={whole} label={ringLabel}>
                    {shown ? (
                        <>
                            <span data-ring-label className="line-clamp-2 max-w-[112px] text-[12px] leading-snug text-zinc-600">
                                {centreName
                                    ? t(hasSales ? "feesRingGot" : "feesRingGets", { name: centreName })
                                    : named
                                        ? t(hasSales ? "feesRingOwnerGot" : "feesRingOwnerGets")
                                        : t(hasSales ? "feesRingYouGot" : "feesRingYouGet")}
                            </span>
                            <span className="text-[24px] font-extrabold leading-tight tracking-tight tabular-nums sm:text-[26px]" style={{ color: COLOR.net }}>{cash(b.net)}</span>
                            <span className="text-[12px] text-zinc-600">
                                {t(hasSales ? "feesRingOf" : "feesRingOfEvery", { amount: cash(whole) })}
                            </span>
                        </>
                    ) : (
                        <span className="text-[13px] text-zinc-500">{t("feesNothingSoldYet")}</span>
                    )}
                </Ring>
            </div>

            <div className="flex min-w-0 flex-col">
                <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-zinc-500">
                    {one
                        ? t(isEvent ? "feesOnEveryTicket" : "feesOnEverySale", { amount: cash(one.gross) })
                        : hasSales ? `${t("feesSoFar")} · ${count}` : t("feesWhoTakesWhat")}
                </p>
                {slices.map((s, i) => (
                    <Line
                        key={s.key}
                        slice={shown ? s : { ...s, display: "" }}
                        share={shown ? share(s.amount, whole) : ""}
                        last={i === slices.length - 1}
                    />
                ))}
            </div>

            {tile}
        </div>
    );
}
