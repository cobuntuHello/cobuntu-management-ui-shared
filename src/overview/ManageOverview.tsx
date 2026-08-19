import type { ReactNode } from "react";
import type { EventExtras, OverviewListing, OverviewStats } from "./types";
import {
    conversion, daysUntil, delta, formatCount, formatMoney,
    hasUnattributedViews, isSellable, recentWindows,
} from "./format";
import { TrendChart, hasTrend } from "./TrendChart";

/**
 * The manage page's first tab: how this is doing, and whether it can be sold.
 *
 * ── What this replaced ──────────────────────────────────────────────────────
 *
 * A tab called Overview that was the EDIT STACK — Name, Price, Category, each
 * opening a modal. Opening a product answered a question nobody arrived with.
 * The editing now lives in its own Details tab; this says how the thing is
 * doing.
 *
 * ── Two rules this file exists to keep ──────────────────────────────────────
 *
 * 1. MONEY IS NOT ONE NUMBER. Held is not spendable and paid is already gone.
 *    A single "earnings" figure invites a seller to expect a transfer that has
 *    not happened, which is exactly what six ticket sales produced: EUR 24.72
 *    earned, EUR 0 received, and no screen saying so.
 *
 * 2. LISTINGS ARE THE POINT. Nothing can be bought without one, so the state
 *    that matters most is "created, and on no shelf anywhere". It is said
 *    plainly rather than left to be inferred from zeroes.
 *
 * Presentational: the caller fetches and passes `stats`. That keeps this one
 * component for two domains and two apps, and keeps the fetching where the auth
 * already is.
 */

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface ManageOverviewProps {
    stats: OverviewStats;
    /** Event-only figures. Ignored for a product. */
    extras?: EventExtras;
    /** Where a listing row goes when pressed. */
    listingHref: (listing: OverviewListing) => string;
    /** Offered when nothing is listed anywhere. */
    onRequestListing?: () => void;
    onSelfList?: () => void;
    /*
     * There is deliberately no shelf control here. Taking a listing off the
     * shelf lives on the listing's own page, where the terms and the
     * consequences sit beside the act. A summary row is the wrong place to put
     * a press that takes a live listing down.
     */
    t: T;
    locale?: string;
    /** Rendered under the listings; the host owns any further actions. */
    footer?: ReactNode;
}

const STATUS_TONE: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-amber-50 text-amber-700",
    PAUSED: "bg-blue-50 text-blue-700",
    CANCELLED: "bg-zinc-100 text-zinc-500",
    REVOKED: "bg-zinc-100 text-zinc-500",
};

function Tile({
    label, value, sub, wide,
}: { label: string; value: string; sub?: ReactNode; wide?: boolean }) {
    return (
        /*
          * A hairline, not a rule. Five bordered boxes in a row at zinc-200
          * read as a table of cells rather than as figures, and the grid lines
          * end up louder than the numbers they contain.
          */
        <div className={`rounded-xl border border-zinc-200/70 bg-white p-3.5 ${wide ? "sm:col-span-2" : ""}`}>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">{label}</p>
            <p className="mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums text-zinc-900">{value}</p>
            {sub ? <div className="mt-1.5 text-[12px] text-zinc-500">{sub}</div> : null}
        </div>
    );
}

/** A signed change, or nothing at all when there is no baseline to compare to. */
function Delta({ pct, t }: { pct: number | null; t: T }) {
    if (pct === null) return null;
    const up = pct >= 0;
    return (
        <span className={`font-semibold ${up ? "text-emerald-700" : "text-zinc-500"}`}>
            {up ? "↑" : "↓"} {Math.abs(Math.round(pct))}%{" "}
            <span className="font-normal text-zinc-500">{t("overviewVsPrevious")}</span>
        </span>
    );
}

export function ManageOverview({
    stats, extras, listingHref, onRequestListing, onSelfList,
    t, locale = "en-GB", footer,
}: ManageOverviewProps) {
    const { money, views, listings, weekly } = stats;
    const isEvent = stats.kind === "event";
    const sellable = isSellable(stats);

    const soldWindow = recentWindows(weekly, "sold");
    const viewWindow = recentWindows(weekly, "views");
    const rate = conversion(stats.sold, views.total);
    const startsIn = daysUntil(extras?.startsAt, new Date());

    const cash = (n: number) => formatMoney(n, money.currency, locale);

    return (
        <div className="space-y-5">
            {/*
              * NOT SELLABLE leads, because it makes every number below it moot.
              * Zeroes across a dashboard read as "no sales"; the truth is that
              * there is nowhere to buy it, and those are different problems
              * with different fixes.
              */}
            {!sellable && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <p className="text-[17px] font-semibold text-zinc-900">
                        {isEvent ? t("overviewNotSellableEvent") : t("overviewNotSellableProduct")}
                    </p>
                    <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-zinc-600">
                        {listings.length === 0 ? t("overviewNoListingsBody") : t("overviewNoActiveListingBody")}
                    </p>
                    {(onRequestListing || onSelfList) && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {onRequestListing && (
                                <button
                                    type="button"
                                    onClick={onRequestListing}
                                    className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white"
                                >
                                    {t("overviewAskCommunity")}
                                </button>
                            )}
                            {onSelfList && (
                                <button
                                    type="button"
                                    onClick={onSelfList}
                                    className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-[13px] font-semibold text-zinc-700"
                                >
                                    {t("overviewSellItMyself")}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/*
              * THE NUMBERS AND THE TREND, SIDE BY SIDE.
              *
              * Stacked, the tiles pushed the chart below the fold on a laptop,
              * so the page opened on four totals with no shape to them. The
              * totals answer "how much", the chart answers "which way" -- and
              * neither is much use without the other in view.
              *
              * FOUR TILES, and no fifth. Every extra ratio (conversion, days
              * until it starts) competed with the money for the same glance and
              * lost; what a seller opens this page for is what they earned,
              * what it grossed, how many looked and how many bought.
              */}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-3">
                    <Tile
                        label={t("overviewNetEarnings")}
                        value={cash(money.net)}
                        sub={
                            /*
                              * The split, not one figure: held is not spendable
                              * and paid is already gone.
                              */
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {money.held > 0 && (
                                    <span>
                                        {t("overviewHeld", { amount: cash(money.held) })}
                                        {money.nextPayoutAt && (
                                            <> {t("overviewDueOn", {
                                                date: new Date(money.nextPayoutAt).toLocaleDateString(locale, {
                                                    day: "numeric", month: "short",
                                                }),
                                            })}</>
                                        )}
                                    </span>
                                )}
                                {money.due > 0 && <span>{t("overviewDue", { amount: cash(money.due) })}</span>}
                                {money.paid > 0 && <span>{t("overviewPaid", { amount: cash(money.paid) })}</span>}
                                {money.net === 0 && <span>{t("overviewNoEarningsYet")}</span>}
                            </div>
                        }
                    />

                    <Tile
                        label={t("overviewGrossEarnings")}
                        value={cash(money.gross)}
                        sub={t("overviewGrossSub")}
                    />

                    <Tile
                        label={t("overviewTotalViews")}
                        value={formatCount(views.total, locale)}
                        sub={<Delta pct={delta(viewWindow.current, viewWindow.previous)} t={t} />}
                    />

                    <Tile
                        label={isEvent ? t("overviewGoing") : t("overviewSales")}
                        value={isEvent && extras?.going !== undefined
                            ? formatCount(extras.going, locale)
                            : formatCount(stats.sold, locale)}
                        sub={isEvent && extras?.capacity
                            ? t("overviewOfCapacity", { capacity: extras.capacity })
                            : t("overviewInLastWeeks", { count: soldWindow.current })}
                    />
                </div>

                {/*
                  * Absent below two weeks of data: one point is not a trend, and
                  * a chart with a single dot invites a reading the data does not
                  * support. The tiles then take the full width rather than
                  * leaving a hole where a figure would be.
                  */}
                {hasTrend(weekly) ? (
                    <TrendChart weekly={weekly} currency={money.currency} locale={locale} t={t} />
                ) : (
                    <div className="hidden rounded-xl border border-dashed border-zinc-200 p-6 text-center text-[13px] text-zinc-400 lg:flex lg:items-center lg:justify-center">
                        {t("overviewTrendTooEarly")}
                    </div>
                )}
            </div>

            {/* Listings: one section per community */}
            <div>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[16px] font-semibold text-zinc-900">{t("overviewWhereItSells")}</h2>
                    {listings.length > 0 && (
                        <span className="text-[13px] text-zinc-500">
                            {t("overviewCarriedBy", { count: listings.length })}
                        </span>
                    )}
                </div>

                {listings.length === 0 ? (
                    /*
                      * A DIFFERENT sentence from the banner above, which has
                      * already said nobody can buy it. Repeating that line here
                      * says the same thing twice on one screen; this says what
                      * the section itself is for.
                      */
                    <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-[13px] text-zinc-500">
                        {t("overviewNoListingsHere")}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {listings.map((l) => (
                            /*
                              * A CARD WITH A BUTTON, not a giant link.
                              *
                              * The card carries four figures and three facts
                              * about the agreement; making all of it one click
                              * target means a seller reading the numbers
                              * navigates away by accident, and leaves no room
                              * for a second action later. The way in is named
                              * and sized like a way in.
                              *
                              * The community's ICON leads, because a seller
                              * carried by four communities recognises a logo
                              * before they read a name. Communities without one
                              * get their initial in the same square, so the
                              * left edge of every card lines up either way -- a
                              * missing image must not shift the whole row.
                              */
                            <div
                                key={l.listingId}
                                className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white"
                            >
                                <div className="flex items-start gap-3 p-4">
                                    {l.communityIcon ? (
                                        <img
                                            src={l.communityIcon}
                                            alt=""
                                            className="h-11 w-11 flex-none rounded-lg object-cover"
                                        />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-zinc-100 text-[15px] font-bold text-zinc-500"
                                        >
                                            {l.communityName.trim().charAt(0).toUpperCase()}
                                        </span>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="text-[15px] font-semibold text-zinc-900">
                                                {l.communityName}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[l.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                                {t(`overviewStatus_${l.status}`)}
                                            </span>
                                        </div>

                                        {/*
                                          * WHAT WAS AGREED, in one line. A rate
                                          * on its own does not say what for; the
                                          * package names the arrangement and the
                                          * date says since when. The requested
                                          * date stands in when there is no
                                          * approval date -- rows approved before
                                          * that column existed have none, and
                                          * inventing one would put a wrong date
                                          * under a record.
                                          */}
                                        <p className="mt-0.5 truncate text-[12.5px] text-zinc-500">
                                            {[
                                                l.packageName,
                                                l.commissionRate !== null ? t("overviewCommission", { rate: l.commissionRate }) : null,
                                                l.approvedAt
                                                    ? t("overviewApprovedOn", { date: new Date(l.approvedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })
                                                    : l.requestedAt
                                                        ? t("overviewRequestedOn", { date: new Date(l.requestedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })
                                                        : null,
                                            ].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>

                                    <a
                                        href={listingHref(l)}
                                        className="flex-none rounded-lg bg-zinc-100 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
                                    >
                                        {t("overviewManageListing")}
                                    </a>
                                    {/*
                                      * NO SHELF CONTROL ON THE CARD. It belongs
                                      * on the listing's own page, where the
                                      * state, the terms and the consequences are
                                      * on screen together. Here it would sit one
                                      * press from taking a live listing down,
                                      * beside numbers that give no context for
                                      * the decision.
                                      */}
                                </div>

                                {/*
                                  * The figures sit in their own band, divided
                                  * from the agreement above. A listing that
                                  * cannot sell shows none of them: four zeroes
                                  * read as "nobody bought it", where the truth
                                  * is that nobody could.
                                  */}
                                {l.status === "ACTIVE" ? (
                                    <dl className="grid grid-cols-2 border-t border-zinc-200/70 bg-zinc-50/60 sm:grid-cols-4">
                                        {[
                                            [t("overviewViews"), formatCount(l.views, locale)],
                                            [t("overviewSold"), formatCount(l.sold, locale)],
                                            [t("overviewGross"), cash(l.gross)],
                                            [t("overviewYourNet"), cash(l.net)],
                                        ].map(([label, value], i) => (
                                            <div
                                                key={label}
                                                className={`px-4 py-2.5 ${i % 2 === 1 ? "" : "border-r border-zinc-200/70"} ${i < 2 ? "border-b border-zinc-200/70 sm:border-b-0" : ""} sm:border-r sm:last:border-r-0`}
                                            >
                                                <dt className="text-[10.5px] font-bold uppercase tracking-[.08em] text-zinc-400">
                                                    {label}
                                                </dt>
                                                <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">
                                                    {value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                ) : (
                                    <p className="border-t border-zinc-200/70 bg-zinc-50/60 px-4 py-2.5 text-[12.5px] text-zinc-500">
                                        {t(`overviewListingState_${l.status}`)}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/*
                  * The footnote that stops the sections looking broken. Views
                  * belonging to no listing are real views; the two numbers are
                  * not a partition and never were.
                  */}
                {hasUnattributedViews(stats) && (
                    <p className="mt-3 text-[12px] text-zinc-500">
                        {t("overviewUnattributedViews", { count: views.unattributed })}
                    </p>
                )}

                {footer}
            </div>
        </div>
    );
}
