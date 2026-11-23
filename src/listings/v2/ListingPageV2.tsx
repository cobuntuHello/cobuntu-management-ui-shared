"use client";

/**
 * THE LISTING PAGE, v2: one page, four steps, three homes
 * (cobuntu-backend-monorepo docs/features/listing-page-v2.md; the approved
 * canvas' "The full listing page", 22 to 23 Nov 2026).
 *
 * A listing is where a seller and a community meet over one item. Every
 * listing, in every community, has the same four steps:
 *
 *   1 The request   the item (and, at a venue, the booking)
 *   2 The money     where one sale goes, what sold, what is paid upfront
 *   3 The talk      everything either side raised
 *   4 Go live       what is left, then publish (and, once live, the levers)
 *
 * A track shows all four at once (green done, amber your turn with a count,
 * blue their turn, dashed not yet, dark live); one card is open below it,
 * the first one waiting on the viewer. Communities only change what fills
 * the steps, never the layout.
 *
 * The same component runs in the admin (the community's seat), the community
 * app and a venue's own site (the seller's seat); it reaches the backend only
 * through the `transport` it is given (transport.ts) and draws only the
 * actions that transport offers.
 *
 * Every feature of the old panel (ManagedListingDetail) lives on here: the
 * status levers with their confirmations, the offers and packages, the
 * topics, the history, the breadcrumbs and the header slot.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { makeSay, type ListingPageCopy } from "./copy";
import { clockOf, dateTile, money, percent, shortDate, toRate } from "./format";
import { MoneyRing, MoneyStep, type Parties } from "./MoneyStep";
import { CardSheet, PriceSheet, RequestSheet } from "./sheets";
import { LISTING_PAGE_CSS, themeVars, type ListingTheme } from "./styles";
import type { ListingTransport } from "./transport";
import type { BookingAddons, BookingView, ListingDetail, ListingMoney, ListingStatus, Package, Proposal, Seat, Topic, UpfrontAddon } from "./types";
import { derive, firstStep, saidDone, type StepId, type Tone } from "./derive";
import { Avatar, Confirm, ICON, Icon, Sheet, type ConfirmSpec } from "./ui";
import { normalizeListingState } from "../manageListingRows";
import { ownerListingActions, reviewerListingActions } from "../listingTransitions";

export interface ListingPageV2Props {
    transport: ListingTransport;
    seat: Seat;
    kind: "event" | "product";
    /** The way back (the requests queue, or the seller's listings). */
    backHref: string;
    /** The trail, innermost last; the item's name is appended. */
    breadcrumbs?: Array<{ label: string; href?: string }>;
    /** Makes the item's crumb a link (the seller's manage page for it). */
    itemHref?: string;
    /**
     * Close the trail with the community's name: a seller may list one item in
     * several communities and the last crumb says which request this is.
     */
    endWithCommunity?: boolean;
    /** Buttons beside the title; a function gets the listed item (links need its slug). */
    tools?: ReactNode | ((item: { id?: string; slug?: string; name?: string | null; live: boolean }) => ReactNode);
    /** The signed-in user, for their avatar on the talk. */
    currentUser?: { id?: string | null; name?: string | null; avatarUrl?: string | null };
    /** The seller's Premium card (community app only), shown on a live listing's money. */
    premium?: ReactNode;
    /** Where "See payouts", "Open the ledger" and "View live" go, when the host has them. */
    links?: { payouts?: string; ledger?: string; live?: string };
    /** Stripe's publishable key: opens the card form in a sheet; without it, Stripe's page. */
    stripePublishableKey?: string;
    theme?: ListingTheme;
    copy?: ListingPageCopy;
    t?: (key: string, vars?: Record<string, unknown>) => string;
    /** Called after anything changed, so a host can refresh what it shows around the page. */
    onChange?: () => void;
    /** Leaving the page (Stripe's card page): the browser's own navigation unless the host routes it. */
    navigate?: (url: string) => void;
}

interface Loaded {
    listing: ListingDetail;
    proposals: Proposal[];
    topics: Topic[];
    money: ListingMoney | null;
    booking: BookingView | null;
    addons: BookingAddons | null;
}

const ORDER: StepId[] = ["request", "money", "talk", "live"];
const STEP_ICON: Record<StepId, string> = { request: ICON.request, money: ICON.money, talk: ICON.talk, live: ICON.live };
const PILL: Record<Tone, "ok" | "wait" | "them" | "off"> = { done: "ok", you: "wait", them: "them", live: "ok", locked: "off" };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function ListingPageV2(props: ListingPageV2Props) {
    const { transport, seat, kind, theme, copy, t } = props;
    const say = useMemo(() => makeSay(copy, t), [copy, t]);
    const [data, setData] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);
    const [focus, setFocus] = useState<StepId | null>(null);
    const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
    const [sheet, setSheet] = useState<null | "card" | "request" | "compose" | "history" | { price: UpfrontAddon }>(null);
    const [drawer, setDrawer] = useState<string | null>(null);
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [listing, proposals, topics, money] = await Promise.all([
                transport.listing(),
                transport.proposals().catch(() => [] as Proposal[]),
                transport.topics().catch(() => [] as Topic[]),
                transport.money().catch(() => null),
            ]);
            const item = kind === "event" ? (listing.event ?? listing.events) : (listing.products ?? listing.product);
            const eventId: string | null = kind === "event" ? (item?.id ?? (listing as any).eventId ?? null) : null;
            const booking = eventId && transport.booking ? await transport.booking(eventId).catch(() => null) : null;
            const addons = eventId && booking && transport.addons ? await transport.addons(eventId).catch(() => null) : null;
            setData({ listing, proposals: proposals ?? [], topics: topics ?? [], money, booking, addons });
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, [kind, transport]);

    useEffect(() => { void load(); }, [load]);

    // Back from Stripe's card page or form: say so once, and drop the marker.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (url.searchParams.get("card") === "done") {
            setToast(say("sheetCardDone"));
            url.searchParams.delete("card");
            window.history.replaceState(null, "", url.toString());
        }
    }, [say]);

    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(""), 2600);
        return () => clearTimeout(id);
    }, [toast]);

    const after = useCallback(async (message?: string) => {
        await load();
        props.onChange?.();
        if (message) setToast(message);
    }, [load, props]);

    const rootStyle = { ...themeVars(theme) } as CSSProperties;
    if (failed && !data) {
        return (
            <div className="cbtl" style={rootStyle}><style>{LISTING_PAGE_CSS}</style>
                <div className="cbtl-inner"><p className="cbtl-empty">{say("notFound")} <a href={props.backHref}>{say("back")}</a></p></div>
            </div>
        );
    }
    if (!data) {
        return <div className="cbtl" style={rootStyle}><style>{LISTING_PAGE_CSS}</style><div className="cbtl-inner"><p className="cbtl-empty">{say("loading")}</p></div></div>;
    }

    // ── what the page knows ──
    const { listing, proposals, topics, booking, addons } = data;
    const m = data.money;
    const status = normalizeListingState(listing.status) as ListingStatus | null;
    const item: any = kind === "event" ? (listing.event ?? listing.events) : (listing.products ?? listing.product);
    const eventId: string | null = kind === "event" ? (item?.id ?? null) : null;
    const comm = listing.community ?? listing.communities ?? null;
    const parties: Parties = {
        community: { name: comm?.name ?? "", icon: comm?.iconUrl ?? null },
        seller: { name: listing.requestedBy?.name ?? item?.owner?.name ?? "", image: listing.requestedBy?.profileImage ?? null },
    };
    const names = { community: parties.community.name, seller: parties.seller.name };
    const rate = toRate(listing.commissionRate ?? (listing as any).ticketListing?.commissionRate);
    const paid = kind === "event" ? listing.isPaid !== false && !!(listing.listingPrice?.amount) : true;
    const d = derive({
        seat, kind, status, isHidden: !!listing.isHidden, rate, paid, proposals,
        sellerUserId: listing.requestedBy?.id ?? (listing as any).requestedByUserId ?? null,
        booking, money: m, topics, approvedAt: listing.approvedAt ?? null,
        capacity: item?.capacity ?? item?.maxAttendees ?? null, names,
    }, say);
    const active = focus ?? firstStep(d);
    const n = ORDER.indexOf(active) + 1;
    const live = status === "ACTIVE" || status === "PAUSED";
    const itemName: string = item?.name ?? "";
    const image: string | null = item?.bannerUrl ?? item?.coverImage ?? item?.imageUrl ?? item?.image ?? item?.images?.[0] ?? null;
    const tz: string | undefined = item?.timezone ?? undefined;
    const cur = m?.currency ?? listing.listingPrice?.currency ?? "EUR";
    const other = seat === "seller" ? names.community : names.seller;
    const otherImage = seat === "seller" ? parties.community.icon : parties.seller.image;
    const toolsNode = typeof props.tools === "function"
        ? props.tools({ id: item?.id, slug: item?.slug, name: itemName, live: status === "ACTIVE" })
        : props.tools ?? null;

    /** One lever: confirm, run, reload, say it worked. */
    const lever = (spec: Omit<ConfirmSpec, "run"> & { act: (note?: string) => Promise<void> }) =>
        setConfirm({ ...spec, run: async (note) => { await spec.act(note); await after(say("saved")); } });
    const quick = async (fn: () => Promise<void>) => {
        setBusy(true);
        try { await fn(); await after(say("saved")); } catch (e: any) { setToast(e?.message || say("failed")); } finally { setBusy(false); }
    };

    // ── each step's card ──
    type Action = { label: string; kind?: "go" | "no"; onClick?: () => void; href?: string; disabled?: boolean; title?: string };
    let left: ReactNode = null;
    let right: ReactNode = null;
    let hint = "";
    let actions: Action[] = [];
    let more: Array<{ key: string; label: string; body: ReactNode }> = [];

    if (active === "request") {
        const tile = kind === "event" ? dateTile(item?.startDate, tz) : null;
        left = image
            ? <span className="cbtl-photo"><img src={image} alt={itemName} />{m?.upfront?.room && <span>{m.upfront.room}</span>}</span>
            : <span className="cbtl-pic"><Icon d={ICON.request} size={48} stroke={1.4} /><b>{itemName}</b></span>;
        const stats: Array<{ big: string; small: string }> = [];
        if (booking?.guestCount) stats.push({ big: String(booking.guestCount), small: say("guests") });
        if (booking) stats.push({ big: money(booking.totalAmountCents, booking.currency), small: say("roomWithVat") });
        const price = m?.oneSale?.gross ?? (listing.listingPrice ? Math.round(listing.listingPrice.amount * (cur.toUpperCase() === "JPY" ? 1 : 100)) : null);
        stats.push({ big: price ? money(price, cur) : say("free"), small: kind === "event" ? say("aTicket") : say("price") });
        right = (
            <>
                {tile && (
                    <span style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="cbtl-day"><b>{tile.mon}</b><span>{tile.day}</span><small>{tile.dow}</small></span>
                        <span className="cbtl-times">
                            <span className="cbtl-time" data-main=""><b>{clockOf(item?.startDate, tz)}{item?.endDate ? ` to ${clockOf(item.endDate, tz)}` : ""}</b></span>
                        </span>
                    </span>
                )}
                <span className="cbtl-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                    {stats.map((s) => <span className="cbtl-stat" key={s.small}><b>{s.big}</b><small>{s.small}</small></span>)}
                </span>
                {!booking && kind === "event" && <span className="cbtl-small">{say("noBooking")}</span>}
                {typeof booking?.details?.logistics?.schedule === "string" && (
                    <span className="cbtl-fact"><small>{say("sheetSchedule")}</small><span>{String(booking.details.logistics.schedule)}</span></span>
                )}
            </>
        );
        if (booking && d.bookingAwaitsCommunity) {
            hint = seat === "community"
                ? say("requestHintCommunityPaid", { seller: names.seller })
                : say("requestHintSellerWaiting", { date: shortDate(booking.firstPaidAt), community: names.community });
            if (seat === "community" && transport.decideBooking && eventId) {
                actions = [
                    { label: say("acceptBooking"), kind: "go", onClick: () => lever({ title: say("confirmAcceptTitle"), body: say("confirmAcceptBody", { seller: names.seller }), confirm: say("acceptBooking"), act: () => transport.decideBooking!(eventId, "ACCEPT") }) },
                    { label: say("declineAndRefund"), kind: "no", onClick: () => lever({ title: say("confirmDeclineTitle"), body: say("confirmDeclineBody", { seller: names.seller, community: names.community }), confirm: say("declineAndRefund"), danger: true, note: { label: say("declineReason", { seller: names.seller }) }, act: (note) => transport.decideBooking!(eventId, "DECLINE", note) }) },
                ];
            }
        } else if (booking && d.bookingLive) {
            hint = seat === "seller"
                ? say("requestHintConfirmed", { community: names.community, date: shortDate(booking.decidedAt) })
                : say("requestHintConfirmedCommunity", { date: shortDate(booking.decidedAt), day: shortDate(item?.startDate, tz) });
        } else {
            hint = say("requestHintPlain", { date: shortDate(listing.createdAt) });
        }
        if (seat === "seller" && booking && d.bookingLive && eventId && (transport.setGuests || transport.setDetails || transport.dateOptions)) {
            actions.push({ label: say("changeRequest"), onClick: () => setSheet("request") });
        }
        if (booking?.details) {
            const log = booking.details.logistics ?? {};
            const mkt = booking.details.marketing ?? {};
            const facts = (rows: Array<[string, unknown]>) => (
                <div className="cbtl-facts">{rows.filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => (
                    <span className="cbtl-fact" key={k}><small>{k}</small><span>{Array.isArray(v) ? v.join(", ") : String(v)}</span></span>
                ))}</div>
            );
            more = [
                { key: "told", label: seat === "community" ? say("whatTheyToldYou", { seller: names.seller }) : say("whatYouTold", { community: names.community }), body: facts([[say("sheetPlan"), mkt.plan], [say("sheetMore"), mkt.more]]) },
                { key: "log", label: say("logistics"), body: facts([[say("sheetFormat"), log.format === "Other" ? log.formatOther : log.format], [say("sheetSchedule"), log.schedule], [say("sheetOutside"), log.outside], [say("sheetAccessSetup"), log.accessSetup], [say("sheetPrevious"), log.previous]]) },
                { key: "mkt", label: say("marketing"), body: facts([[say("sheetShare"), mkt.share], [say("sheetContact"), mkt.contact]]) },
            ];
        }
    }

    if (active === "money") {
        const handlers = eventId ? {
            onAcceptAddonPrice: seat === "seller" && transport.confirmAddonPrice ? (a: UpfrontAddon) => lever({
                title: a.name, body: say("upAccept", { amount: money(a.proposedCents ?? a.listedCents, cur) }) + ". " + say("upNoteSeller"), confirm: say("upAccept", { amount: money(a.proposedCents ?? a.listedCents, cur) }),
                act: () => transport.confirmAddonPrice!(eventId, a.id),
            }) : undefined,
            onCancelAddon: seat === "seller" && transport.cancelAddon ? (a: UpfrontAddon) => lever({
                title: say("upDecline", { name: a.name }), body: say("upDecline", { name: a.name }), confirm: say("upDecline", { name: a.name }), danger: true,
                act: () => transport.cancelAddon!(eventId, a.id),
            }) : undefined,
            onApproveAddon: seat === "community" && transport.decideAddon ? (a: UpfrontAddon) => lever({
                title: say("upApprove", { name: a.name }), body: say("upFrom", { amount: money(a.listedCents, cur) }), confirm: say("upApprove", { name: a.name }),
                act: () => transport.decideAddon!(eventId, a.id, { decision: "APPROVE" }),
            }) : undefined,
            onProposeAddonPrice: seat === "community" && transport.decideAddon ? (a: UpfrontAddon) => setSheet({ price: a }) : undefined,
            onDeclineAddon: seat === "community" && transport.decideAddon ? (a: UpfrontAddon) => lever({
                title: say("upDecline", { name: a.name }), body: say("upDecline", { name: a.name }), confirm: say("upDecline", { name: a.name }), danger: true,
                note: { label: say("declineReason", { seller: names.seller }) },
                act: (note) => transport.decideAddon!(eventId, a.id, { decision: "DECLINE", reason: note }),
            }) : undefined,
            onChangeCard: seat === "seller" && transport.startCardChange && d.bookingLive ? () => setSheet("card") : undefined,
        } : {};
        const agreed = proposals.find((p) => p.status === "ACCEPTED");
        left = <MoneyRing say={say} seat={seat} kind={kind} money={m} parties={parties} agreedOn={(agreed as any)?.respondedAt ?? agreed?.createdAt ?? listing.approvedAt} />;
        right = <MoneyStep say={say} seat={seat} kind={kind} money={m} parties={parties} premium={props.premium} busy={busy} {...handlers} />;
        const commission = m?.oneSale?.lines.find((l) => l.key === "commission")?.amount;
        if (live) hint = seat === "seller" ? say("moneyHintLiveSeller", { community: names.community }) : say("moneyHintLiveCommunity", { community: names.community, seller: names.seller });
        else if (d.offer && d.offer.by !== seat) hint = say("moneyHintOffer", { who: other, rate: percent(toRate(d.offer.proposal.commissionRate) ?? 0) });
        else if (rate == null && paid) hint = say("moneyHintNoTerms");
        else hint = [commission === 0 && kind === "event" ? say("moneyHintNoCommission") : "", d.myAddons.length ? say("moneyHintAddons") : ""].filter(Boolean).join(" ");
        if (d.offer && d.offer.by !== seat && status === "PENDING") {
            const r = percent(toRate(d.offer.proposal.commissionRate) ?? 0);
            actions.push(
                { label: say("acceptOffer", { rate: r }), kind: "go", onClick: () => lever({ title: say("acceptOffer", { rate: r }), body: say("moneyHintOffer", { who: other, rate: r }), confirm: say("acceptOffer", { rate: r }), act: () => transport.respond(d.offer!.proposal.id, "ACCEPTED") }) },
                { label: say("declineOffer"), kind: "no", onClick: () => lever({ title: say("declineOffer"), body: say("moneyHintOffer", { who: other, rate: r }), confirm: say("declineOffer"), danger: true, act: () => transport.respond(d.offer!.proposal.id, "REJECTED") }) },
            );
        }
        if (status === "PENDING") actions.push({ label: say("proposeTerms"), onClick: () => setSheet("compose") });
        if (live && seat === "seller" && props.links?.payouts) actions.push({ label: say("seePayouts"), href: props.links.payouts });
        if (live && seat === "community" && props.links?.ledger) actions.push({ label: say("openLedger"), href: props.links.ledger });
        more = [{ key: "history", label: say("moreHistory"), body: <History say={say} proposals={proposals} sellerId={listing.requestedBy?.id ?? null} names={names} /> }];
    }

    if (active === "talk") {
        const open = topics.filter((x) => x.status === "OPEN");
        const settled = topics.filter((x) => x.status !== "OPEN");
        left = <span className="cbtl-pic"><Icon d={ICON.talk} size={48} stroke={1.4} /><b>{open.length ? (open.length === 1 ? say("stateOpenTopic") : say("stateOpenTopics", { count: open.length })) : say("stateSettled")}</b><small>{say("settledCount", { count: settled.length })}</small></span>;
        right = <Talk say={say} seat={seat} topics={open} me={props.currentUser} other={{ name: other, image: otherImage }} transport={transport} after={after} />;
        hint = open.length ? say("talkHint") : say("talkHintSettled");
        if (settled.length) more = [{ key: "settled", label: say("settledCount", { count: settled.length }), body: <Talk say={say} seat={seat} topics={settled} me={props.currentUser} other={{ name: other, image: otherImage }} transport={transport} after={after} readOnly /> }];
    }

    if (active === "live") {
        left = (
            <span className="cbtl-pic" data-live={status === "ACTIVE" && !listing.isHidden ? "" : undefined}>
                <Icon d={ICON.live} size={48} stroke={1.4} />
                <b>{status === "ACTIVE" ? (listing.isHidden ? say("statePaused") : say("stateLive")) : cap(d.steps.live.sub)}</b>
                {live && m?.soldSoFar && <small>{say("subSold", { count: m.soldSoFar.count })}</small>}
            </span>
        );
        right = (
            <>
                <span className="cbtl-checks">
                    {d.checks.map((c) => (
                        <button type="button" key={c.text} className="cbtl-check" data-ok={c.ok ? "" : undefined} data-step={c.step && !c.ok ? "" : undefined}
                            onClick={c.step && !c.ok ? () => setFocus(ORDER[c.step! - 1]) : undefined}>
                            <i>{c.ok ? "✓" : "!"}</i><span>{c.text}</span>{c.step && !c.ok && <small>{say("stepRef", { n: c.step })}</small>}
                        </button>
                    ))}
                </span>
                {d.approveNeedsTerms && seat === "community" && <span className="cbtl-hint">{say("approveNeedsTerms")}</span>}
            </>
        );
        const closed = status === "CANCELLED" || status === "REVOKED";
        hint = closed ? say("liveHintClosed")
            : status === "PAUSED" ? say("liveHintPaused")
                : status === "ACTIVE" ? (seat === "seller" ? say("liveHintSeller") : say("liveHintCommunity"))
                    : seat === "seller" ? say("liveHintWaitingSeller", { community: names.community }) : say("liveHintWaitingCommunity", { community: names.community });
        if (seat === "community") {
            for (const a of reviewerListingActions(status)) {
                if (a === "approve") actions.push({
                    label: say("approvePublish"), kind: "go", disabled: d.blockers.length > 0, title: d.blockers.map((b) => b.text).join(". ") || undefined,
                    onClick: () => lever({ title: say("confirmApproveTitle"), body: say("confirmApproveBody", { community: names.community, seller: names.seller }), confirm: say("approvePublish"), act: () => transport.setStatus("ACTIVE") }),
                });
                if (a === "decline") actions.push({
                    label: say("decline"), kind: "no",
                    onClick: () => lever({ title: say("confirmDeclineListingTitle"), body: say("confirmDeclineListingBody", { seller: names.seller }), confirm: say("decline"), danger: true, note: { label: say("declineReason", { seller: names.seller }) }, act: (note) => transport.setStatus("REVOKED", note) }),
                });
                if (a === "revoke") actions.push({
                    label: say("takeDown"), kind: "no",
                    onClick: () => lever({ title: say("confirmTakeDownTitle"), body: say("confirmTakeDownBody", { community: names.community }), confirm: say("takeDown"), danger: true, act: () => transport.setStatus("REVOKED") }),
                });
            }
            if (status === "ACTIVE" && transport.setHidden) {
                actions.unshift(listing.isHidden
                    ? { label: say("putBack"), onClick: () => quick(() => transport.setHidden!(false)) }
                    : { label: say("takeOffShelf"), onClick: () => lever({ title: say("confirmHideTitle"), body: say("confirmHideBody", { community: names.community }), confirm: say("takeOffShelf"), act: () => transport.setHidden!(true) }) });
            }
        } else {
            if (status === "ACTIVE") {
                if (props.links?.live) actions.push({ label: say("viewLive"), href: props.links.live });
                if (props.links?.live) actions.push({ label: say("shareLink"), onClick: () => { void navigator.clipboard?.writeText(new URL(props.links!.live!, window.location.href).toString()); setToast(say("linkCopied")); } });
            }
            for (const a of ownerListingActions(status)) {
                if (a === "pause") actions.push({ label: say("takeOffShelf"), onClick: () => lever({ title: say("confirmPauseTitle"), body: say("confirmPauseBody"), confirm: say("takeOffShelf"), act: () => transport.setStatus("PAUSED") }) });
                if (a === "resume") actions.push({ label: say("putBack"), kind: "go", onClick: () => lever({ title: say("confirmResumeTitle"), body: say("confirmResumeBody"), confirm: say("putBack"), act: () => transport.setStatus("ACTIVE") }) });
                if (a === "withdraw") actions.push({
                    label: status === "PENDING" ? say("withdrawRequest") : say("withdraw"), kind: "no",
                    onClick: () => lever({ title: say("confirmWithdrawTitle"), body: say("confirmWithdrawBody"), confirm: status === "PENDING" ? say("withdrawRequest") : say("withdraw"), danger: true, act: () => transport.setStatus("CANCELLED") }),
                });
            }
        }
    }

    const step = d.steps[active];
    const you = step.tone === "done" || step.tone === "live" ? "ok" : step.tone === "you" ? "wait" : step.tone === "them" ? "ok" : "off";
    const them = step.tone === "done" || step.tone === "live" ? "ok" : step.tone === "them" ? "wait" : step.tone === "you" ? "ok" : "off";
    const pillText = active === "money" && live && m?.soldSoFar ? say("stateSelling", { count: m.soldSoFar.count }) : cap(step.sub);
    const crumbs = props.breadcrumbs ?? [{ label: seat === "seller" ? say("crumbYours") : say("crumbRequests"), href: props.backHref }];
    const returnUrl = typeof window !== "undefined" ? (() => { const u = new URL(window.location.href); u.searchParams.set("card", "done"); return u.toString(); })() : "";

    return (
        <div className="cbtl" style={rootStyle} data-seat={seat}>
            <style>{LISTING_PAGE_CSS}</style>
            <div className="cbtl-inner">
                <nav className="cbtl-crumb" aria-label="Breadcrumb">
                    {crumbs.map((c, i) => (
                        <span key={i}>{c.href ? <a href={c.href}>{c.label}</a> : <b>{c.label}</b>} <span aria-hidden="true">›</span></span>
                    ))}
                    {props.itemHref ? <a href={props.itemHref}>{itemName}</a> : <b>{itemName}</b>}
                    {props.endWithCommunity && names.community && <><span aria-hidden="true">›</span><b>{names.community}</b></>}
                </nav>

                <header className="cbtl-head">
                    {image ? <img className="cbtl-head-img" src={image} alt="" /> : <span className="cbtl-head-img">{(itemName || "?")[0]}</span>}
                    <span style={{ flex: "1 1 0", minWidth: 0 }}>
                        <h1 className="cbtl-title">{itemName}</h1>
                        <span className="cbtl-sub">
                            <Avatar image={otherImage} name={other} size={24} />
                            <span>{seat === "seller" ? say("withCommunity", { community: names.community }) : names.seller}</span>
                            {listing.createdAt && <><span aria-hidden="true">·</span><span>{say("sentOn", { date: shortDate(listing.createdAt) })}</span></>}
                        </span>
                    </span>
                    <span className="cbtl-tools">
                        <button type="button" className="cbtl-tool" onClick={() => setSheet("history")}><Icon d={ICON.history} /><span>{say("toolHistory")}</span></button>
                        {toolsNode}
                    </span>
                </header>

                <section className="cbtl-card cbtl-track" aria-label="Steps">
                    {ORDER.map((id, i) => {
                        const s = d.steps[id];
                        const prevDone = i > 0 && ["done", "live"].includes(d.steps[ORDER[i - 1]].tone);
                        const label = [say("stepRequest"), say("stepMoney"), say("stepTalk"), say("stepLive")][i];
                        const short = [say("stepRequestShort"), say("stepMoneyShort"), say("stepTalkShort"), say("stepLiveShort")][i];
                        return (
                            <span className="cbtl-node" key={id}>
                                {i > 0 && <span className="cbtl-node-line" data-done={prevDone ? "" : undefined} />}
                                <button type="button" className="cbtl-node-btn" data-tone={s.tone} aria-pressed={id === active} aria-label={`${say("stepOf", { n: i + 1 })}, ${label}: ${s.sub}`} onClick={() => { setFocus(id); setDrawer(null); }}>
                                    <Icon d={STEP_ICON[id]} size={24} />
                                    {s.badge !== undefined && <span className="cbtl-badge" data-done={s.badge === "done" ? "" : undefined}>{s.badge === "done" ? "✓" : s.badge}</span>}
                                </button>
                                {/* The full label, or a short one when the page is narrow (the canvas' phone boards). */}
                                <span className="cbtl-node-label" data-on={id === active ? "" : undefined}>
                                    <span className="cbtl-l-long">{`${i + 1}. ${label}`}</span><span className="cbtl-l-short">{short}</span>
                                </span>
                                <span className="cbtl-node-sub" data-tone={s.tone}>{s.sub}</span>
                            </span>
                        );
                    })}
                </section>

                <section className="cbtl-card cbtl-pane" aria-label={[say("stepRequest"), say("stepMoney"), say("stepTalk"), say("stepLive")][n - 1]}>
                    <div className="cbtl-pane-head">
                        <span>
                            <span className="cbtl-kicker">{say("stepOf", { n })}</span>
                            <h2 className="cbtl-pane-title">{[say("stepRequest"), say("stepMoney"), say("stepTalk"), say("stepLive")][n - 1]}</h2>
                        </span>
                        <span className="cbtl-sides">
                            <span style={{ display: "flex", alignItems: "center" }}>
                                <Avatar image={props.currentUser?.avatarUrl} name={say("you")} />
                                <span className="cbtl-tick" data-tone={you}>{you === "ok" ? "✓" : you === "wait" ? "!" : "·"}</span>
                                <span style={{ marginLeft: 8, display: "inline-flex" }}><Avatar image={otherImage} name={other} /></span>
                                <span className="cbtl-tick" data-tone={them}>{them === "ok" ? "✓" : them === "wait" ? "!" : "·"}</span>
                            </span>
                            <span className="cbtl-pill" data-tone={PILL[step.tone]}>{pillText}</span>
                        </span>
                    </div>
                    <div className="cbtl-body">
                        <div className="cbtl-col cbtl-col-left">{left}</div>
                        <div className="cbtl-col">{right}</div>
                    </div>
                    {(hint || actions.length > 0) && (
                        <div className="cbtl-bar">
                            <span className="cbtl-hint">{hint}</span>
                            {actions.length > 0 && (
                                <span className="cbtl-actions">
                                    {actions.map((a) => a.href
                                        ? <a key={a.label} className="cbtl-btn" data-kind={a.kind} href={a.href}>{a.label}</a>
                                        : <button key={a.label} type="button" className="cbtl-btn" data-kind={a.kind} disabled={a.disabled || busy} title={a.title} onClick={a.onClick}>{a.label}</button>)}
                                </span>
                            )}
                        </div>
                    )}
                    {more.length > 0 && (
                        <>
                            <div className="cbtl-more">
                                {more.map((x) => (
                                    <button type="button" key={x.key} className="cbtl-chip" aria-expanded={drawer === x.key} onClick={() => setDrawer(drawer === x.key ? null : x.key)}>
                                        <span>{x.label}</span><span aria-hidden="true" style={{ color: "var(--cbtl-faint)" }}>⌄</span>
                                    </button>
                                ))}
                            </div>
                            {drawer && <div className="cbtl-drawer">{more.find((x) => x.key === drawer)?.body}</div>}
                        </>
                    )}
                </section>
            </div>

            {confirm && <Confirm spec={confirm} onClose={() => setConfirm(null)} cancel={say("cancel")} failed={say("failed")} />}
            {sheet === "card" && eventId && (
                <CardSheet say={say} transport={transport} eventId={eventId} publishableKey={props.stripePublishableKey} returnUrl={returnUrl} navigate={props.navigate} onClose={() => setSheet(null)} />
            )}
            {sheet === "request" && eventId && booking && (
                <RequestSheet say={say} transport={transport} eventId={eventId} booking={booking} guestCount={addons?.guestCount ?? booking.guestCount} locked={!!addons?.locked}
                    community={names.community} currency={booking.currency} onClose={() => { setSheet(null); void after(); }} onSaved={(msg) => { setToast(msg); void load(); }} />
            )}
            {sheet === "compose" && (
                <Compose say={say} transport={transport} community={names.community} onClose={() => setSheet(null)} onSent={() => { setSheet(null); void after(say("saved")); }} />
            )}
            {sheet === "history" && (
                <Sheet title={say("moreHistory")} onClose={() => setSheet(null)}>
                    <History say={say} proposals={proposals} sellerId={listing.requestedBy?.id ?? null} names={names} />
                    <div className="cbtl-sheet-foot"><button type="button" className="cbtl-btn" onClick={() => setSheet(null)}>{say("done")}</button></div>
                </Sheet>
            )}
            {sheet && typeof sheet === "object" && "price" in sheet && eventId && transport.decideAddon && (
                <PriceSheet say={say} name={sheet.price.name} currency={cur} onClose={() => setSheet(null)}
                    onSend={async (cents) => { await transport.decideAddon!(eventId, sheet.price.id, { decision: "PROPOSE_PRICE", priceCents: cents }); await after(say("saved")); }} />
            )}
            {toast && <div className="cbtl-toast" role="status">{toast}</div>}
        </div>
    );
}

/** Every offer either side made, newest first, with how it ended. */
function History({ say, proposals, sellerId, names }: { say: ReturnType<typeof makeSay>; proposals: Proposal[]; sellerId: string | null; names: { community: string; seller: string } }) {
    if (proposals.length === 0) return <p className="cbtl-hint">{say("historyEmpty")}</p>;
    const sorted = [...proposals].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    return (
        <div className="cbtl-facts">
            {sorted.map((p) => {
                const by = p.proposedByUserId ?? p.proposedByUser?.id ?? p.proposedBy?.id ?? null;
                const who = by && sellerId && by === sellerId ? names.seller : names.community;
                const st = p.status === "ACCEPTED" ? say("historyStatusAccepted") : p.status === "REJECTED" ? say("historyStatusRejected") : say("historyStatusPending");
                return (
                    <span className="cbtl-fact" key={p.id}>
                        <small>{shortDate(p.createdAt)} · {st}</small>
                        <span>{say("historyLine", { who, rate: percent(toRate(p.commissionRate) ?? 0), package: p.package?.name ? ` (${p.package.name})` : "" })}</span>
                        {p.message && <span className="cbtl-small">{p.message}</span>}
                    </span>
                );
            })}
        </div>
    );
}

/** Propose different terms: one of the community's packages, and a note. */
function Compose({ say, transport, community, onClose, onSent }: { say: ReturnType<typeof makeSay>; transport: ListingTransport; community: string; onClose: () => void; onSent: () => void }) {
    const [packages, setPackages] = useState<Package[] | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { transport.packages().then(setPackages).catch(() => setPackages([])); }, [transport]);
    return (
        <Sheet title={say("composeTitle")} onClose={onClose} busy={busy}>
            {packages === null ? <p>{say("loading")}</p> : packages.length === 0 ? <p>{say("composeNoPackages", { community })}</p> : (
                <div className="cbtl-field">
                    <span className="cbtl-label">{say("composePackage")}</span>
                    <div className="cbtl-choices" role="radiogroup" aria-label={say("composePackage")}>
                        {packages.map((p) => (
                            <button key={p.id} type="button" role="radio" aria-checked={picked === p.id} className="cbtl-choice" onClick={() => setPicked(p.id)}>
                                {p.name} · {percent(Number(p.rate))}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <label className="cbtl-field">
                <span className="cbtl-label">{say("composeNote")}</span>
                <textarea className="cbtl-textarea" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <span className="cbtl-error" role="alert">{error}</span>}
            <div className="cbtl-sheet-foot">
                <button type="button" className="cbtl-btn" onClick={onClose} disabled={busy}>{say("cancel")}</button>
                <button type="button" className="cbtl-btn" data-kind="go" disabled={busy || !picked} onClick={async () => {
                    setBusy(true); setError("");
                    try { await transport.propose({ packageId: picked!, message: note.trim() || undefined }); onSent(); } catch (e: any) { setError(e?.message || say("failed")); setBusy(false); }
                }}>{say("composeSend")}</button>
            </div>
        </Sheet>
    );
}

/** The talk: each topic as a chat, "It is done" per side, a reply box, and raising something new. */
function Talk({ say, seat, topics, me, other, transport, after, readOnly }: {
    say: ReturnType<typeof makeSay>; seat: Seat; topics: Topic[]; me?: { id?: string | null; name?: string | null; avatarUrl?: string | null };
    other: { name: string; image?: string | null }; transport: ListingTransport; after: (m?: string) => Promise<void>; readOnly?: boolean;
}) {
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [raising, setRaising] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        try { await fn(); await after(); } finally { setBusy(false); }
    };
    return (
        <div className="cbtl-msgs">
            {topics.length === 0 && !raising && <p className="cbtl-hint">{say("talkEmpty")}</p>}
            {topics.map((tp) => {
                const mineDone = saidDone(tp, seat);
                const theirsDone = saidDone(tp, seat === "seller" ? "community" : "seller");
                return (
                    <div className="cbtl-topic" key={tp.id}>
                        <div className="cbtl-topic-head">
                            <b>{tp.subject}</b>
                            <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                {tp.changedSince && <span className="cbtl-pill" data-tone="them">{say("changedSince")}</span>}
                                {tp.status !== "OPEN" ? <span className="cbtl-pill" data-tone="ok">{say("bothDone")}</span>
                                    : theirsDone ? <span className="cbtl-pill" data-tone="wait">{say("theySaidDone", { who: other.name })}</span>
                                        : mineDone ? <span className="cbtl-pill">{say("youSaidDone")}</span> : null}
                                {!readOnly && tp.status === "OPEN" && (
                                    <button type="button" className="cbtl-btn" data-size="s" disabled={busy} onClick={() => run(() => transport.setTopicDone(tp.id, !mineDone))}>{mineDone ? say("undoDone") : `✓ ${say("itIsDone")}`}</button>
                                )}
                            </span>
                        </div>
                        {tp.comments.map((c) => {
                            const mine = !!me?.id && c.authorUserId === me.id;
                            return (
                                <div className="cbtl-msg" data-mine={mine ? "" : undefined} key={c.id}>
                                    <Avatar image={mine ? me?.avatarUrl : c.author?.profileImage ?? null} name={mine ? me?.name : c.author?.name ?? other.name} />
                                    <span className="cbtl-bubble">{c.body}</span>
                                </div>
                            );
                        })}
                        {!readOnly && tp.status === "OPEN" && (
                            <input className="cbtl-input" placeholder={say("reply")} aria-label={say("reply")} maxLength={4000} value={drafts[tp.id] ?? ""} disabled={busy}
                                onChange={(e) => setDrafts({ ...drafts, [tp.id]: e.target.value })}
                                onKeyDown={(e) => {
                                    const text = (drafts[tp.id] ?? "").trim();
                                    if (e.key === "Enter" && text) { e.preventDefault(); void run(async () => { await transport.comment(tp.id, text); setDrafts({ ...drafts, [tp.id]: "" }); }); }
                                }} />
                        )}
                    </div>
                );
            })}
            {!readOnly && (raising ? (
                <div className="cbtl-topic">
                    <input className="cbtl-input" placeholder={say("talkSubject")} aria-label={say("talkSubject")} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} />
                    <textarea className="cbtl-textarea" placeholder={say("talkBody")} aria-label={say("talkBody")} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
                    <span className="cbtl-actions">
                        <button type="button" className="cbtl-btn" data-size="s" onClick={() => setRaising(false)} disabled={busy}>{say("cancel")}</button>
                        <button type="button" className="cbtl-btn" data-kind="go" data-size="s" disabled={busy || !subject.trim() || !body.trim()}
                            onClick={() => run(async () => { await transport.openTopic({ subject: subject.trim(), body: body.trim() }); setSubject(""); setBody(""); setRaising(false); })}>{say("talkPost")}</button>
                    </span>
                </div>
            ) : (
                <span><button type="button" className="cbtl-btn" data-size="s" onClick={() => setRaising(true)}>{say("raiseSomething")}</button></span>
            ))}
        </div>
    );
}
