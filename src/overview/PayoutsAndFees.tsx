import type { ReactNode } from "react";
import type { OverviewMoney, FeeRates, StripeDestination, OwnershipModel } from "./types";
import { CobuntuMark } from "../listings/ui/marks";
import { FallbackImg, StripeGlyph, personAvatarCandidates } from "../listings/v2/ui";

/**
 * "Payouts & fees" — what the seller keeps, what came off the top, and where
 * and when the rest lands.
 *
 * REDESIGNED from a ledger table into a summary. The old card asked the seller
 * to read five labelled rows and do the arithmetic themselves to reach the one
 * figure they came for, then repeated the destination and the timing as two
 * filled panels underneath. It ran about a screen tall and read like a receipt.
 *
 * Three ideas replace it:
 *
 *   1. LEAD WITH THE ANSWER. "You keep" is the headline, at headline size, with
 *      the gross demoted to a caption beneath it. Everything else on the card
 *      exists to explain that number, so nothing else competes with it.
 *
 *   2. SHOW THE SPLIT, DON'T TABULATE IT. One stacked bar gives the shape of
 *      the deal at a glance -- how much of the bar is the seller's is the whole
 *      question -- and the legend beneath carries the exact amounts and rates,
 *      so nothing is lost to the picture. A percentage is easier to feel as a
 *      width than to read as a number.
 *
 *   3. SAY WHERE AND WHEN AS A SENTENCE. Two facts, one line each, on a soft
 *      footer rather than two bordered panels.
 *
 * Built from the OWNER's side, so a member seller sees Stripe as covered rather
 * than as a charge they never paid.
 *
 * Renders nothing on a backend that predates the fields (no `breakdown` or no
 * `ownership`) -- the tiles above still stand on their own.
 */

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Who a slice of money belongs to, drawn the way the listing page draws it. */
export type MoneyParty = { kind: "community" | "user"; name: string; imageUrl: string | null };

const MARK = 24;

function initialsOf(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * The party's real mark (Overview, 25 Nov 2026: "missing the community icon,
 * user icon, platform icon and Stripe icon"), as on the listing page's
 * Earnings: a community square with its icon, a person round with their photo
 * or their library avatar, Cobuntu's mark, Stripe's. Inline sizes, so a host
 * page without the listing page's stylesheet still draws them.
 */
function PartyMark({ party }: { party: MoneyParty | null }) {
    const box = "inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-zinc-200 text-[10px] font-bold text-zinc-600 [&>img]:h-full [&>img]:w-full [&>img]:object-cover";
    if (!party) {
        // The community side with no single community to name (several carry it).
        return (
            <span aria-hidden="true" className={`${box} rounded-md text-zinc-500`} style={{ width: MARK, height: MARK }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
        );
    }
    if (party.kind === "community") {
        return (
            <span aria-hidden="true" className={`${box} rounded-md`} style={{ width: MARK, height: MARK }}>
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
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-inset ring-zinc-200" style={{ width: MARK, height: MARK }}>
            <CobuntuMark size={MARK - 8} />
        </span>
    );
}

function TaxBadge() {
    return (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-bold text-zinc-500 ring-1 ring-inset ring-zinc-200" style={{ width: MARK, height: MARK }}>
            %
        </span>
    );
}

/** A percent that shows decimals only when it has them: 8, not 8.00. */
function pct(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** The bank label from what Stripe gave us, as much of it as exists. */
function accountLine(d: StripeDestination, t: T): string {
    const who = t(d.scope === "community" ? "feesDestCommunity" : "feesDestUser");
    const bank = [d.bankBrand, d.last4 ? `••${d.last4}` : null].filter(Boolean).join(" ");
    const tail = [bank || null, d.country].filter(Boolean).join(" · ");
    return tail ? `${who} · ${tail}` : who;
}

/**
 * One slice of the split.
 *
 * `swatch` is a Tailwind bg-* class rather than a raw colour so the palette
 * stays in one place, and `hollow` marks the covered-Stripe case: a ring rather
 * than a fill, because it is a line in the story with no width in the bar.
 */
type Slice = {
    key: string;
    label: string;
    note?: string | null;
    /**
     * A second line under the label, for a figure that is a slice OF this row
     * rather than a sibling of it. The commission uses it to say what Cobuntu
     * took out and what the community is left with -- neither belongs in the
     * bar, because both are already inside this row's width.
     */
    sub?: string | null;
    amount: number;
    /** What the legend prints. Usually the money; "covered" for absorbed Stripe. */
    display: string;
    swatch: string;
    hollow?: boolean;
    /** Whose money this is: the party's own mark, beside the colour that ties it to the bar. */
    mark: ReactNode;
};

/**
 * The bar. Widths are shares of gross, and a non-zero slice is floored at a
 * visible sliver -- a 40-cent fee on a 400-euro sale is a real deduction and
 * should not vanish into a hairline. The floor makes the row slightly wider
 * than its track, which the clip absorbs; the legend carries the exact figures
 * either way, so the bar never has to be measured.
 *
 * The 2px gap between slices is a right border in the surface colour, not a
 * margin: it keeps the segments mathematically adjacent, and `last:` drops it
 * so the bar ends flush inside its rounded track.
 */
function SplitBar({ slices, gross, label }: { slices: Slice[]; gross: number; label: string }) {
    const drawn = slices.filter((s) => s.amount > 0 && !s.hollow);

    // Nothing sold yet: a quiet empty track, so the card keeps its shape and
    // the seller can still read the structure of the deal off the legend.
    if (gross <= 0 || drawn.length === 0) {
        return <div className="h-3 rounded-full bg-zinc-200/70" aria-hidden="true" />;
    }

    return (
        <div
            role="img"
            aria-label={label}
            className="flex h-3 overflow-hidden rounded-full bg-zinc-200/70"
        >
            {drawn.map((s) => (
                <span
                    key={s.key}
                    className={`${s.swatch} h-full border-r-2 border-zinc-50 last:border-r-0`}
                    style={{ width: `${Math.max((s.amount / gross) * 100, 1.5)}%` }}
                />
            ))}
        </div>
    );
}

/** A legend entry: the colour in the bar, whose it is, what it is, and what it cost. */
function LegendItem({ slice }: { slice: Slice }) {
    return (
        <div className="flex items-baseline gap-2.5 border-t border-zinc-200/70 py-2.5 first:border-t-0 first:pt-0">
            <span
                className={`h-2 w-2 shrink-0 self-center rounded-full ${
                    slice.hollow ? "bg-transparent ring-1 ring-zinc-300" : slice.swatch
                }`}
            />
            <span className="self-center">{slice.mark}</span>
            {/* Wraps rather than truncates: a clipped "Community commissi..."
                hides which line the amount beside it belongs to. */}
            <span className="min-w-0 flex-1 text-[14px] leading-snug text-zinc-700">
                {slice.label}
                {slice.note ? <span className="ml-1 text-zinc-400">{slice.note}</span> : null}
                {slice.sub ? (
                    <span className="mt-0.5 block text-[12px] text-zinc-500">{slice.sub}</span>
                ) : null}
            </span>
            <span
                className={`shrink-0 text-[14px] font-semibold tabular-nums ${
                    slice.hollow ? "text-zinc-400" : "text-zinc-900"
                }`}
            >
                {slice.display}
            </span>
        </div>
    );
}

export function PayoutsAndFees({
    money, ownership, rates, destination, t, cash, locale = "en-GB", owner = null, broker = null, connectStripeHref = null,
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
}) {
    const b = money.breakdown;
    // Pre-feature backend: the tiles above already stand on their own.
    if (!b || !ownership) return null;

    const isMember = ownership === "member";
    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

    /*
     * The seller's own share leads the bar and the legend. Reading left to
     * right then answers "how much of this is mine" before it answers "who
     * took what", which is the order the question actually arrives in.
     */
    const slices: Slice[] = [
        {
            key: "net",
            label: t(isMember ? "feesYouKeep" : "feesCommunityNet"),
            amount: b.net,
            display: cash(b.net),
            swatch: "bg-emerald-600",
            mark: <PartyMark party={owner ?? { kind: isMember ? "user" : "community", name: "", imageUrl: null }} />,
        },
        ...(b.community > 0 || rates?.communityPct != null
            ? [{
                key: "community",
                label: t("feesCommunityCommission"),
                note: rates?.communityPct != null ? t("feesPct", { rate: pct(rates.communityPct) }) : null,
                /*
                 * What the community is actually PAID, when the backend says.
                 * The listing rows beneath this card report that figure, and
                 * without this line the two read as a contradiction rather
                 * than as a commission and the cut taken out of it.
                 *
                 * Only when there is a cut: a zero would add a line that says
                 * nothing, and on a community-owned item there is no broker at
                 * all.
                 */
                sub: b.communityCut
                    ? `${t("feesCommunityCut", { amount: cash(b.communityCut) })} · ${t("feesCommunityReceives", { amount: cash(b.community - b.communityCut) })}`
                    : null,
                amount: b.community,
                display: cash(b.community),
                swatch: "bg-amber-500",
                mark: <PartyMark party={broker} />,
            }]
            : []),
        {
            key: "cobuntu",
            label: t("feesCobuntu"),
            note: !isMember && rates?.cobuntuPct != null ? t("feesPct", { rate: pct(rates.cobuntuPct) }) : null,
            amount: b.cobuntu,
            display: cash(b.cobuntu),
            swatch: "bg-zinc-400",
            mark: <CobuntuBadge />,
        },
        ...(b.vat > 0
            ? [{ key: "vat", label: t("feesVat"), amount: b.vat, display: cash(b.vat), swatch: "bg-zinc-300", mark: <TaxBadge /> }]
            : []),
        /*
         * The real amount, always. On a member sale booked before Cobuntu
         * Premium Phase 3 (all-in fee) Cobuntu PAID this out of the `cobuntu`
         * fee above; since Phase 3 the seller's share pays it on top. Either
         * way that is who settles it, not whether it happened. `b.stripe`/`b.cobuntu` are already decomposed
         * server-side (see OverviewService) so the two bars sum back to the
         * same all-in total either way; showing Stripe as "covered" with no
         * width hid a real cost rather than explaining who carries it.
         */
        { key: "stripe", label: t("feesStripe"), amount: b.stripe, display: cash(b.stripe), swatch: "bg-sky-600", mark: <StripeGlyph size={MARK} /> },
    ];

    const barLabel = slices
        .filter((s) => s.amount > 0)
        .map((s) => `${s.label} ${s.display}`)
        .join(", ");

    return (
        /*
         * WHERE THE MONEY GOES, as approved (Overview redesign, board 9): the
         * split on the left with where it lands, the exact lines on the right.
         * The big "you keep" figure that used to open this card is gone: the
         * Overview hero above already says it, and saying it twice made the two
         * read as different numbers.
         */
        <div className="grid gap-6 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-5 sm:p-7 lg:grid-cols-2 lg:gap-10">
            <div className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="m-0 text-[16px] font-bold tracking-tight text-zinc-900">{t("overviewMoneyTitle")}</h3>
                    <span className="text-[13px] text-zinc-500">
                        {money.gross > 0 ? t("feesFromGross", { amount: cash(money.gross) }) : t("feesNothingTakenYet")}
                    </span>
                </div>

                <SplitBar slices={slices} gross={money.gross} label={barLabel} />

                {/* Where, and when. */}
                <div className="space-y-1 border-t border-zinc-200/70 pt-3.5">
                    <p className="m-0 text-[13px] text-zinc-600">
                        {destination && destination.connected ? (
                            <>
                                {t("feesLandsIn", { account: accountLine(destination, t) })}
                                <span className={`ml-1.5 font-medium ${destination.payoutsEnabled ? "text-emerald-700" : "text-amber-700"}`}>
                                    {destination.payoutsEnabled ? t("feesDestReady") : t("feesDestPayoutsOff")}
                                </span>
                            </>
                        ) : (
                            <span className="font-medium text-amber-700">{t("feesDestNone")}</span>
                        )}
                    </p>
                    {/* Straight to the setup that fixes it: the owner's own, or the community's. */}
                    {!(destination && destination.connected) && connectStripeHref && (
                        <a
                            href={connectStripeHref}
                            className="mt-1.5 inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                        >
                            <StripeGlyph size={16} />
                            {t("feesConnectStripe")}
                        </a>
                    )}
                    <p className="m-0 text-[13px] text-zinc-500">
                        {money.held > 0 && money.nextPayoutAt
                            ? t("feesHeldUntil", { amount: cash(money.held), date: day(money.nextPayoutAt) })
                            : money.due > 0
                                ? t("feesReadyToPayOut", { amount: cash(money.due) })
                                : t("feesNextPayoutNone")}
                    </p>
                </div>
            </div>

            {/* Exact figures, one divided row each, so nothing is lost to the picture. */}
            <div className="min-w-0">
                {slices.map((s) => <LegendItem key={s.key} slice={s} />)}
            </div>
        </div>
    );
}
