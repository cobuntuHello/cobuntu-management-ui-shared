import { useState, type ReactNode } from "react";
import type { EventExtras, OverviewListing, OverviewStats } from "./types";
import {
    conversion, daysUntil, delta, formatCount, formatMoney,
    isSellable, recentWindows,
} from "./format";
import { EmptyState, ShelfIcon } from "./EmptyState";
import { PayoutsAndFees } from "./PayoutsAndFees";
import { NextStep } from "./NextStep";
import { OverviewHero } from "./OverviewHero";
import { StatsStrip } from "./StatsStrip";
import { ListingsTable } from "./ListingsTable";
import { ByCommunityChart } from "./ByCommunityChart";

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
    onSelfList?: () => void;
    /**
     * Opens the host's publish flow. Shown on the next-step card only for an
     * event that was never published (`stats.everPublished === false`); a
     * product has no publish step, so it is never offered there.
     */
    onPublish?: () => void;
    /** A course reads "Students" where a product reads "Sales". Courses are products. */
    itemType?: "course";
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
    /**
     * The community whose site this is, and how to ask it to carry the item.
     *
     * Offered when nothing carries it yet. Once something does, it is offered
     * again only when `stats.mayCarryMany` (a Premium member's own item) and
     * THIS community is not one of the carriers; otherwise the page states the
     * one-community limit instead of offering a second the API would refuse.
     */
    requestOn?: {
        name: string;
        /** This community's tag, to tell whether it already carries the item.
         *  Without it a Premium seller is never offered a second community:
         *  the page cannot rule out asking a community that already has it. */
        communityTag?: string;
        onRequest: () => void;
        pending?: boolean;
    };
    /**
     * Where to connect Stripe for the account the money lands in: the owning
     * person's ("user") or the owning community's ("community"). Return null
     * when this app cannot take the viewer there; the money card then shows
     * the missing account without a button. Shown only to the viewer who can
     * act on it: the owner for a person's item, a leader (or staff) for a
     * community's.
     */
    connectStripeHref?: (scope: "user" | "community") => string | null | undefined;
}

/**
 * The community taking the commission, for its mark in the money card: the one
 * carrier when exactly one community takes a commission, else none (the card
 * then draws a neutral community mark rather than picking one of several).
 */
function brokerOf(listings: OverviewListing[]): { kind: "community"; name: string; imageUrl: string | null } | null {
    const paid = listings.filter((l) => l.status === "ACTIVE");
    const pool = paid.length > 0 ? paid : listings;
    if (pool.length !== 1) return null;
    const l = pool[0];
    return { kind: "community", name: l.communityName, imageUrl: l.communityIcon ?? null };
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
    stats, extras, listingHref, onSelfList, onPublish, itemType,
    t, locale = "en-GB", footer, requestOn, connectStripeHref,
}: ManageOverviewProps) {
    const { money, views, listings, weekly } = stats;
    /*
     * A Premium member's own item, carried elsewhere but not by this community:
     * offer this one too. Any row here counts as carried, whatever its status
     * (the existing row is what the seller acts on), and without the tag the
     * page cannot tell, so it offers nothing rather than guess.
     */
    const here = requestOn?.communityTag?.toLowerCase();
    const offerAlsoHere = !!stats.mayCarryMany && !!here && listings.length > 0
        && !listings.some((l) => l.communityTag?.toLowerCase() === here);
    const isEvent = stats.kind === "event";
    const sellable = isSellable(stats);
    const role = stats.viewerRole;
    const isCarrier = role === "carrier";

    /*
     * The Connect Stripe button goes to whoever the money lands with, and only
     * for the viewer who can connect it: the owner of a person's item; a
     * leader, the owner or staff for a community's. An older backend that
     * names no role leaves it to the host.
     */
    const stripeScope: "user" | "community" = stats.destination?.scope ?? (stats.ownership === "member" ? "user" : "community");
    const mayConnect = !role
        || (stripeScope === "user" ? role === "owner" : role === "community-leader" || role === "owner" || role === "admin");
    const stripeHref = mayConnect && connectStripeHref ? connectStripeHref(stripeScope) ?? null : null;

    /*
     * THE COMMUNITY FILTER rescopes the page to one listing: its views, sales,
     * gross, what is kept and its own weekly series. Held / due / paid and the
     * fee split are properties of the whole item, not of one listing, so they
     * step aside while a single community is selected rather than showing a
     * whole-item figure under a one-community heading.
     */
    const [scopeId, setScopeId] = useState<string | null>(null);
    const scoped = scopeId ? listings.find((l) => l.listingId === scopeId) ?? null : null;

    const communityTotal = listings.reduce((n, l) => n + (l.communityNet ?? 0), 0);
    const heroValue = scoped
        ? (isCarrier ? scoped.communityNet ?? 0 : scoped.net)
        : isCarrier ? communityTotal : money.net;
    const grossShown = scoped ? scoped.gross : money.gross;
    const viewsShown = scoped ? scoped.views : views.total;
    const soldShown = scoped ? scoped.sold : stats.sold;
    const weeklyShown = scoped ? scoped.weekly ?? [] : weekly;

    const soldWindow = recentWindows(weeklyShown, "sold");
    const viewWindow = recentWindows(weeklyShown, "views");

    const cash = (n: number) => formatMoney(n, money.currency, locale);

    const heroLabel = !role
        ? t("overviewNetEarnings")
        : isCarrier ? t("overviewYourCommunityEarned")
            : role === "community-leader" ? t("overviewCommunityKeeps")
                : role === "co-owner" ? t("overviewOwnerKeeps")
                    : t("overviewYouKeep");

    /* Held is not spendable and paid is already gone: the split, not one figure. */
    const moneyLines = !scoped && !isCarrier ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-zinc-200/70 bg-white p-3.5 text-[13px] text-zinc-600">
            {money.held > 0 && (
                <span>
                    {t("overviewHeld", { amount: cash(money.held) })}
                    {money.nextPayoutAt && (
                        <> {t("overviewDueOn", {
                            date: new Date(money.nextPayoutAt).toLocaleDateString(locale, { day: "numeric", month: "short" }),
                        })}</>
                    )}
                </span>
            )}
            {money.due > 0 && <span>{t("overviewDue", { amount: cash(money.due) })}</span>}
            {money.paid > 0 && <span>{t("overviewPaid", { amount: cash(money.paid) })}</span>}
            {money.net === 0 && <span>{t("overviewNoEarningsYet")}</span>}
        </div>
    ) : null;

    const viewsDelta = <Delta pct={delta(viewWindow.current, viewWindow.previous)} t={t} />;
    const unitLabel = itemType === "course" ? t("overviewStudents") : isEvent ? t("overviewAttending") : t("overviewSales");

    /*
     * An event shows TWO figures, because they are two questions and they
     * routinely disagree: Attending counts everyone in the room (paid, free,
     * added by hand, the hosts), Tickets sold counts tickets that produced
     * money. A five-host event with one buyer is 6 and 1, and both are true.
     * A product has no attendance and keeps the single figure, with its stock
     * position when the variants are capped.
     */
    const cells = [
        { label: t("overviewTotalViews"), value: formatCount(viewsShown, locale), sub: viewsDelta },
        ...(isEvent && extras?.going !== undefined
            ? [
                {
                    label: t("overviewAttending"),
                    value: formatCount(extras.going, locale),
                    sub: extras.capacity ? t("overviewOfCapacity", { capacity: extras.capacity }) : t("overviewAttendingSub"),
                },
                { label: t("overviewTicketsSold"), value: formatCount(soldShown, locale), sub: t("overviewInLastWeeks", { count: soldWindow.current }) },
            ]
            : [{
                label: unitLabel,
                value: formatCount(soldShown, locale),
                sub: extras?.capacity
                    ? t(isEvent ? "overviewOfCapacity" : "overviewOfStock", { capacity: extras.capacity })
                    : t("overviewInLastWeeks", { count: soldWindow.current }),
            }]),
        { label: t("overviewGrossEarnings"), value: cash(grossShown), sub: t("overviewGrossSub") },
    ];

    return (
        <div className="space-y-5">
            {/*
              * NOT SELLABLE leads, because it makes every number below it moot.
              * Zeroes across a dashboard read as "no sales"; the truth is that
              * there is nowhere to buy it, and those are different problems with
              * different fixes. See NextStep for the three reasons and why the
              * listing request is not offered here.
              */}
            {!sellable && <NextStep stats={stats} isEvent={isEvent} t={t} onSelfList={onSelfList} onPublish={onPublish} />}

            <OverviewHero
                label={heroLabel}
                value={cash(heroValue)}
                sub={role ? (isCarrier ? t("overviewHeroSubCommunity", { count: soldShown }) : t("overviewHeroSub", { amount: cash(grossShown) })) : undefined}
                details={moneyLines}
                weekly={weeklyShown}
                currency={money.currency}
                locale={locale}
                t={t}
            />

            <StatsStrip cells={cells} />

            {!scoped && <ByCommunityChart listings={listings} range="11" t={t} />}

            <div>
                {listings.length === 0 ? (
                    /*
                      * A DIFFERENT sentence from the next-step card above, which
                      * has already said nobody can buy it. Repeating that line
                      * here says the same thing twice on one screen; this says
                      * what the section itself is for.
                      */
                    <EmptyState
                        icon={<ShelfIcon />}
                        title={t("overviewNoListingsTitle")}
                        body={t("overviewNoListingsHere")}
                    />
                ) : (
                    <ListingsTable
                        listings={listings}
                        viewerRole={role}
                        scopeId={scopeId}
                        onScope={setScopeId}
                        listingHref={listingHref}
                        t={t}
                        locale={locale}
                        cash={cash}
                    />
                )}

                {/*
                  * WHERE ELSE IT CAN BE LISTED, AND THE PAGE SAYS SO EITHER WAY.
                  *
                  * A control that promises what the rule forbids is worse than no
                  * control at all, because the refusal arrives after the click. So
                  * the offer follows the server's rule: nothing carrying it, or a
                  * Premium member's item (`mayCarryMany`) not yet carried HERE:
                  * one button for THIS community. Carried and not allowed more:
                  * the limit, stated, with nothing to press against it. There is
                  * one such button, not one per missing community.
                  */}
                {requestOn && (listings.length === 0 || offerAlsoHere) ? (
                    <div className="mt-4 rounded-xl border border-zinc-200/70 bg-white p-4">
                        <p className="text-[14px] font-semibold text-zinc-900">
                            {listings.length === 0
                                ? t("overviewNotCarriedTitle")
                                : t("overviewAlsoHereTitle", { community: requestOn.name })}
                        </p>
                        <p className="mt-0.5 text-[13px] text-zinc-500">
                            {listings.length === 0
                                ? t("overviewNotCarriedBody", { community: requestOn.name })
                                : t("overviewAlsoHereBody", { community: requestOn.name })}
                        </p>
                        <button
                            type="button"
                            disabled={requestOn.pending}
                            onClick={requestOn.onRequest}
                            className="mt-3 cursor-pointer rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            {requestOn.pending
                                ? t("overviewRequesting")
                                : t("overviewListItHere", { community: requestOn.name })}
                        </button>
                    </div>
                ) : listings.length > 0 && !stats.mayCarryMany ? (
                    <p className="mt-4 text-[12.5px] text-zinc-500">{t("overviewOneCommunityOnly")}</p>
                ) : null}
            </div>

            {/*
              * WHERE THE MONEY GOES. The whole item's split, so it steps aside
              * for a single-community view, and for a carrier, who is not party
              * to the seller's own fees and payout. Renders itself only when the
              * backend sends the split, so an older payload shows the rest as
              * before.
              */}
            {!scoped && !isCarrier && (
                <PayoutsAndFees
                    money={money}
                    ownership={stats.ownership}
                    rates={stats.rates}
                    destination={stats.destination}
                    t={t}
                    cash={cash}
                    locale={locale}
                    owner={stats.owner ? { kind: stats.owner.kind, name: stats.owner.name, imageUrl: stats.owner.imageUrl } : null}
                    broker={brokerOf(listings)}
                    connectStripeHref={stripeHref}
                />
            )}

            {footer}
        </div>
    );
}
