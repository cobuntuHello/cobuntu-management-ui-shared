import type { ReactNode } from "react";
import type { EventExtras, OverviewListing, OverviewStats } from "./types";
import {
    conversion, daysUntil, delta, formatCount, formatMoney,
    hasUnattributedViews, isSellable, recentWindows,
} from "./format";

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

            {/* Tiles */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Tile
                    wide
                    label={t("overviewEarnings")}
                    value={cash(money.net)}
                    sub={
                        <>
                            {/*
                              * The split, not a single figure. Held is not
                              * spendable and paid is already gone.
                              */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
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
                        </>
                    }
                />

                <Tile
                    label={isEvent ? t("overviewGoing") : t("overviewSold")}
                    value={isEvent && extras?.going !== undefined
                        ? formatCount(extras.going, locale)
                        : formatCount(stats.sold, locale)}
                    sub={isEvent && extras?.capacity
                        ? t("overviewOfCapacity", { capacity: extras.capacity })
                        : t("overviewInLastWeeks", { count: soldWindow.current })}
                />

                <Tile
                    label={t("overviewViews")}
                    value={formatCount(views.total, locale)}
                    sub={<Delta pct={delta(viewWindow.current, viewWindow.previous)} t={t} />}
                />

                <Tile
                    label={t("overviewConversion")}
                    value={rate === null ? "—" : `${rate.toFixed(1)}%`}
                    sub={rate === null ? t("overviewNoViewsYet") : undefined}
                />

                {isEvent && startsIn !== null && (
                    <Tile label={t("overviewStartsIn")} value={t("overviewDays", { count: startsIn })} />
                )}

                <Tile label={t("overviewGross")} value={cash(money.gross)} sub={t("overviewGrossSub")} />
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
                            <a
                                key={l.listingId}
                                href={listingHref(l)}
                                className="block rounded-xl border border-zinc-200/70 bg-white p-4 transition-colors hover:border-zinc-300"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <span className="text-[14.5px] font-semibold text-zinc-900">{l.communityName}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[l.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                            {t(`overviewStatus_${l.status}`)}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-3">
                                        {l.commissionRate !== null && (
                                            <span className="text-[12.5px] text-zinc-500 tabular-nums">
                                                {t("overviewCommission", { rate: l.commissionRate })}
                                            </span>
                                        )}
                                        {/*
                                          * NO SHELF CONTROL ON THE ROW.
                                          *
                                          * It belongs on the listing's own
                                          * page, where the state, the terms and
                                          * the consequences are all on screen
                                          * together. On a summary row it is one
                                          * press away from taking a live
                                          * listing down, next to numbers that
                                          * give no context for the decision.
                                          *
                                          * The row still SAYS the state, and
                                          * links to where the act lives.
                                          */}
                                    </span>
                                </div>

                                {/*
                                  * A listing that cannot sell shows no numbers.
                                  * Four zeroes would read as "nobody bought
                                  * it", where the truth is that nobody could.
                                  */}
                                {l.status === "ACTIVE" ? (
                                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <Tile label={t("overviewViews")} value={formatCount(l.views, locale)} />
                                        <Tile label={t("overviewSold")} value={formatCount(l.sold, locale)} />
                                        <Tile label={t("overviewGross")} value={cash(l.gross)} />
                                        <Tile label={t("overviewYourNet")} value={cash(l.net)} />
                                    </div>
                                ) : (
                                    <p className="mt-2 text-[13px] text-zinc-500">
                                        {t(`overviewListingState_${l.status}`)}
                                    </p>
                                )}
                            </a>
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
