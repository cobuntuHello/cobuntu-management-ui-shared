"use client";

/**
 * THE LISTING PAGE: three sections and a decision
 * (cobuntu-backend-monorepo docs/features/listing-page-redesign.md; the design
 * canvas approved 24 Nov 2026, which replaced v2's four steps).
 *
 * A listing is where a seller and a community meet over one item. The page has
 * three places to look and one thing to do:
 *
 *   Overview      the item as it was sent (the manage page's Details card)
 *   Earnings      the agreed terms and how one sale splits, on every price
 *   Negotiation   the conversation, with the offers in it
 *   the bar       where it stands and the moves open now (decision.ts)
 *
 * The decision is never a section: it is the bar along the bottom, the same
 * for both seats. Every move confirms first and says exactly what it does;
 * picking or accepting a package opens the package sheet, which shows the
 * split before anything is sent.
 *
 * The same component runs in the admin (the community's seat), the community
 * app and a venue's own site (the seller's seat); it reaches the backend only
 * through the `transport` it is given (transport.ts) and draws only the moves
 * that transport offers and the backend's state machine allows.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { makeSay, type ListingPageCopy } from "./copy";
import { clockOf, money, percent, shortDate, toRate } from "./format";
import { Result, Upfront, type Parties } from "./MoneyStep";
import { CardSheet, PriceSheet, RequestSheet } from "./sheets";
import { LISTING_PAGE_CSS, themeVars, type ListingTheme } from "./styles";
import type { ListingTransport } from "./transport";
import type { BookingAddons, BookingView, ListingDetail, ListingMoney, ListingStatus, Package, Proposal, Seat, Topic, UpfrontAddon } from "./types";
import { derive } from "./derive";
import { decisionOf, termsLabel, type MoveId } from "./decision";
import { DecisionBar, EarningsSection, NegotiationSection, OverviewSection, PackageSheet, SectionTiles, chatItems, type SectionId, type TileState } from "./sections";
import { Avatar, Confirm, type ConfirmSpec } from "./ui";
import { AcceptDialog, AskCard, AskCompare, ChangeTermsSheet, PremiumCard, PremiumSheet, cheapestSale, type PremiumCheckout } from "./terms";
import { PackageSwitchSheet, packagePoints } from "./packageSwitch";
import { DrawerDecision, DrawerDetails, DrawerFooter, DrawerHead, DrawerMoney, DrawerTerms, FOOTER_MOVES, TERMS_MOVES } from "./drawer";
import { imagesOf, pricesOf, cheapestPaid } from "./sections";
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
    /**
     * Sell Cobuntu Premium from this page (T-414): the seller's Premium card on
     * their own item, and "Go Premium, then live" in the accept dialog. Only
     * the seller's host passes it; without it neither shows.
     */
    premiumCheckout?: PremiumCheckout;
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
    /**
     * "drawer": the listing beside its chat in /conversations (T-417): one
     * narrow column (head, decision, money, terms, details, footer) instead of
     * the page's trail, tiles and sections. Same loads, moves and dialogs.
     */
    layout?: "page" | "drawer";
    /** Drawer: "Reply" focuses the chat's composer. */
    onReply?: () => void;
    /** Drawer: the close button. */
    onClose?: () => void;
    /**
     * The listing's chat in /conversations (T-417). With it, the third tile is
     * "Chat" and opens that chat, and "Reply" goes there too: the talk lives in
     * the chat, not on this page. Without it, the page keeps its own thread.
     */
    chatHref?: string;
}

interface Loaded {
    listing: ListingDetail;
    proposals: Proposal[];
    topics: Topic[];
    money: ListingMoney | null;
    booking: BookingView | null;
    addons: BookingAddons | null;
}


export function ListingPageV2(props: ListingPageV2Props) {
    const { transport, seat, kind, theme, copy, t } = props;
    const say = useMemo(() => makeSay(copy, t), [copy, t]);
    const [data, setData] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);
    const [focus, setFocus] = useState<SectionId | null>(null);
    const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
    const [sheet, setSheet] = useState<null | "card" | "request" | "terms" | "accept" | "premium" | "package" | { pkg: string | null } | { price: UpfrontAddon }>(null);
    /** The packages the seller's tier is offered, while the listing is on one (T-415: Change package). */
    const [myPackages, setMyPackages] = useState<Package[] | null>(null);
    /** The split at the rate the community asks (T-414), for the seller's Earnings and the accept dialog. */
    const [askMoney, setAskMoney] = useState<ListingMoney | null>(null);
    /** The seller said "Not now" to Premium on this listing (kept in this browser only). */
    const [premiumDismissed, setPremiumDismissed] = useState(false);
    const [toast, setToast] = useState("");

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

    /*
     * THE COMMUNITY'S CUSTOM ASK (T-414): a pending offer with no package from
     * the community's side. The seller reads its split (Earnings, the accept
     * dialog), so it is fetched as soon as the offer is there.
     */
    const pendingAsk = useMemo(() => {
        if (seat !== "seller" || !data) return null;
        const sid = data.listing.requestedBy?.id ?? (data.listing as any).requestedByUserId ?? null;
        return data.proposals.find((p) => p.status === "PENDING" && !p.package?.id
            && (p.proposedByUserId ?? p.proposedByUser?.id ?? p.proposedBy?.id ?? null) !== sid) ?? null;
    }, [seat, data]);
    useEffect(() => {
        if (!pendingAsk) { setAskMoney(null); return; }
        let live = true;
        transport.money({ rate: Number(pendingAsk.commissionRate ?? 0) })
            .then((mm) => { if (live) setAskMoney(mm ?? null); })
            .catch(() => { if (live) setAskMoney(null); });
        return () => { live = false; };
    }, [pendingAsk, transport]);

    /*
     * CHANGE PACKAGE (T-415). The seller's own listing on a package: read what
     * their tier is offered, so the bar and Earnings offer the switch only when
     * there is another package to switch to.
     */
    const onPackageId: string | null = data && seat === "seller"
        ? ((data.listing as any).package?.id ?? (data.listing as any).packageId ?? null)
        : null;
    useEffect(() => {
        if (!onPackageId || !transport.switchPackage) { setMyPackages(null); return; }
        let live = true;
        transport.packages()
            .then((ps) => { if (live) setMyPackages(ps); })
            .catch(() => { if (live) setMyPackages(null); });
        return () => { live = false; };
    }, [onPackageId, transport]);

    // "Not now" on the Premium card holds for this listing, in this browser.
    const listingKey = data?.listing.id ?? null;
    useEffect(() => {
        if (!listingKey) return;
        try { setPremiumDismissed(window.localStorage.getItem(`cbtl-prem-later:${listingKey}`) === "1"); } catch { /* storage blocked: show it */ }
    }, [listingKey]);
    const dismissPremium = () => {
        setPremiumDismissed(true);
        try { if (listingKey) window.localStorage.setItem(`cbtl-prem-later:${listingKey}`, "1"); } catch { /* fine */ }
    };

    /*
     * BACK FROM PREMIUM CHECKOUT ("Go Premium, then live"): the return carries
     * ?premium=welcome&accept=<proposal>. Accept it now, which puts the listing
     * live, and drop the markers. A cancelled checkout comes back without
     * premium=welcome and accepts nothing.
     */
    useEffect(() => {
        if (typeof window === "undefined" || !data || seat !== "seller") return;
        const url = new URL(window.location.href);
        const acceptId = url.searchParams.get("accept");
        if (!acceptId) return;
        const welcome = url.searchParams.get("premium") === "welcome";
        url.searchParams.delete("accept");
        url.searchParams.delete("premium");
        window.history.replaceState(null, "", url.toString());
        if (!welcome || !data.proposals.some((p) => p.id === acceptId && p.status === "PENDING")) return;
        const community = data.listing.community?.name ?? data.listing.communities?.name ?? "";
        void transport.respond(acceptId, "ACCEPTED")
            .then(() => after(say("premWelcomeLive", { community })))
            .catch(() => setToast(say("failed")));
    }, [data, seat, transport, after, say]);

    const rootStyle = { ...themeVars(theme) } as CSSProperties;
    if (failed && !data) {
        return (
            <div className={props.layout === "drawer" ? "cbtl cbtl-drw" : "cbtl"} style={rootStyle}><style>{LISTING_PAGE_CSS}</style>
                <div className="cbtl-inner"><p className="cbtl-empty">{say("notFound")} <a href={props.backHref}>{say("back")}</a></p></div>
            </div>
        );
    }
    if (!data) {
        return <div className={props.layout === "drawer" ? "cbtl cbtl-drw" : "cbtl"} style={rootStyle}><style>{LISTING_PAGE_CSS}</style><div className="cbtl-inner"><p className="cbtl-empty">{say("loading")}</p></div></div>;
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
        seller: {
            name: listing.requestedBy?.name ?? item?.owner?.name ?? "",
            image: listing.requestedBy?.profileImage ?? null,
            id: listing.requestedBy?.id ?? (listing as any).requestedByUserId ?? null,
            usertag: listing.requestedBy?.usertag ?? null,
        },
    };
    const names = { community: parties.community.name, seller: parties.seller.name };
    const rate = toRate(listing.commissionRate ?? (listing as any).ticketListing?.commissionRate);
    const paid = kind === "event" ? listing.isPaid !== false && !!(listing.listingPrice?.amount) : true;
    const sellerId: string | null = listing.requestedBy?.id ?? (listing as any).requestedByUserId ?? null;
    const d = derive({
        seat, kind, status, isHidden: !!listing.isHidden, rate, paid, proposals, sellerUserId: sellerId,
        booking, money: m, topics, approvedAt: listing.approvedAt ?? null,
        capacity: item?.capacity ?? item?.maxAttendees ?? null, names,
    }, say);
    const itemName: string = item?.name ?? "";
    const tz: string | undefined = item?.timezone ?? undefined;
    const other = seat === "seller" ? names.community : names.seller;
    const otherImage = seat === "seller" ? parties.community.icon : parties.seller.image;
    /*
     * WHOSE ITEM IT IS. A community's own event or product carries its
     * community; a member's carries none (core ListingMoneyService.memberSale
     * reads the same field). The seller's header then says "from <community>"
     * rather than "with", and Overview names the owner, never the collaborator
     * who happened to send the request (both seen live, 24 Nov 2026).
     */
    const ownerCommunityId: string | null = item?.communityId ?? null;
    const ownedByCommunity = !!ownerCommunityId;
    const ownerCommunity = ownedByCommunity
        ? {
            name: item?.community?.name ?? item?.communities?.name ?? (ownerCommunityId === comm?.id ? comm?.name : null) ?? names.community,
            icon: item?.community?.iconUrl ?? item?.communities?.iconUrl ?? (ownerCommunityId === comm?.id ? comm?.iconUrl : null) ?? null,
        }
        : null;
    // The money lines need the owner too: "you" is the owning community, and it pays itself no commission.
    parties.owner = ownerCommunity;
    parties.listedOnOwner = ownedByCommunity && !!comm?.id && ownerCommunityId === comm.id;
    const owner = ownerCommunity
        ? { community: true, name: ownerCommunity.name, image: ownerCommunity.icon }
        : {
            community: false,
            name: item?.owner?.name ?? listing.requestedBy?.name ?? "",
            id: item?.owner?.id ?? listing.requestedBy?.id ?? null,
            usertag: item?.owner?.usertag ?? listing.requestedBy?.usertag ?? null,
            image: item?.owner?.profileImage ?? listing.requestedBy?.profileImage ?? null,
        };
    /** The seller's @usertag, beside their name in the community's header. */
    const sellerTag: string | null = listing.requestedBy?.usertag ?? null;
    const toolsNode = typeof props.tools === "function"
        ? props.tools({ id: item?.id, slug: item?.slug, name: itemName, live: status === "ACTIVE" })
        : props.tools ?? null;

    // ── the agreed terms, and the offer on the table ──
    const accepted = proposals
        .filter((p) => p.status === "ACCEPTED")
        .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
    const packageName: string | null = accepted?.package?.name ?? (listing as any).package?.name ?? null;
    const agreedAt: string | null = (accepted as any)?.respondedAt ?? accepted?.createdAt ?? listing.approvedAt ?? null;
    const theirOffer = d.offer && d.offer.by !== seat ? d.offer.proposal : null;
    const terms = termsLabel(say, rate, packageName, kind);
    const one = m?.oneSale ?? null;
    const shownRate = rate ?? (one && one.rateSource !== "none" ? one.commissionRate : null);
    const termsSub = rate != null
        ? (agreedAt ? say("earnAgreedWith", { who: other, date: shortDate(agreedAt) }) : say("earnAgreed"))
        : one?.rateSource === "proposed" ? say("earnProposed")
            : one?.rateSource === "matrix" ? say("earnStandard", { community: names.community }) : "";

    // The seller's own (not a community's) listing on a package, with another package to move to.
    const switchPackage = seat === "seller" && !ownedByCommunity && !!onPackageId && !!transport.switchPackage
        && (myPackages?.length ?? 0) > 1 && (status === "PENDING" || status === "ACTIVE" || status === "PAUSED");
    const myPackage = myPackages?.find((p) => p.id === onPackageId) ?? null;

    const decision = decisionOf({
        seat, kind, status, isHidden: !!listing.isHidden, rate, packageName, agreedAt,
        approvedAt: listing.approvedAt ?? null, createdAt: listing.createdAt ?? null,
        sold: m?.soldSoFar?.count ?? 0, names, room: m?.upfront?.room ?? null,
        rejectionReason: listing.rejectionReason ?? null, d,
        can: { decideBooking: !!(transport.decideBooking && eventId), setHidden: !!transport.setHidden, respond: true, propose: true, setStatus: true, switchPackage },
        reviewer: reviewerListingActions(status), owner: ownerListingActions(status),
    }, say);

    /** The listing's chat in /conversations, when the host gives one (T-417). */
    const openChat = () => {
        if (!props.chatHref) return;
        if (props.navigate) props.navigate(props.chatHref);
        else window.location.assign(props.chatHref);
    };

    /** One move: confirm what it does, run, reload, say it worked. */
    const lever = (spec: Omit<ConfirmSpec, "run"> & { act: (note?: string) => Promise<void> }) =>
        setConfirm({ ...spec, run: async (note) => { await spec.act(note); await after(say("saved")); } });

    const onMove = (id: MoveId) => {
        const community = names.community;
        const seller = names.seller;
        switch (id) {
            case "pickPackage":
                setSheet({ pkg: theirOffer?.package?.id ?? null });
                return;
            case "changeTerms":
                setSheet("terms");
                return;
            case "changePackage":
                setSheet("package");
                return;
            case "reply":
                if (props.layout === "drawer") { props.onReply?.(); return; }
                if (props.chatHref) { openChat(); return; }
                setFocus("negotiation");
                return;
            case "acceptOffer": {
                if (!theirOffer) return;
                // The community's custom ask: what going live means in money, and Premium once (T-414).
                if (seat === "seller" && !theirOffer.package?.id && status === "PENDING") { setSheet("accept"); return; }
                // With its package on offer, accepting shows the split first (the package sheet).
                if (theirOffer.package?.id) { setSheet({ pkg: theirOffer.package.id }); return; }
                const t = termsLabel(say, Number(theirOffer.commissionRate ?? 0), null, kind);
                lever({
                    title: say("confirmAcceptOfferTitle", { terms: t }),
                    body: seat === "seller" ? say("confirmAcceptOfferBodySeller", { terms: t, community }) : say("confirmAcceptOfferBodyCommunity", { terms: t, community }),
                    confirm: say("acceptOffer", { rate: percent(Number(theirOffer.commissionRate ?? 0)) }),
                    act: () => transport.respond(theirOffer.id, "ACCEPTED"),
                });
                return;
            }
            case "declineOffer":
                if (!theirOffer) return;
                lever({ title: say("confirmDeclineOfferTitle"), body: say("confirmDeclineOfferBody", { who: other }), confirm: say("declineOffer"), danger: true, act: () => transport.respond(theirOffer.id, "REJECTED") });
                return;
            case "approve":
                lever({
                    title: say("confirmApproveTitle"),
                    body: terms ? say("confirmApproveBodyTerms", { community, terms, seller }) : say("confirmApproveBody", { community, seller }),
                    confirm: say("approvePublish"), act: () => transport.setStatus("ACTIVE"),
                });
                return;
            case "decline":
                lever({ title: say("confirmDeclineListingTitle"), body: say("confirmDeclineListingBody", { seller }), confirm: say("decline"), danger: true, note: { label: say("declineReason", { seller }) }, act: (note) => transport.setStatus("REVOKED", note) });
                return;
            case "remove":
                lever({ title: say("confirmRemoveTitle", { community }), body: say("confirmRemoveBody", { community, seller }), confirm: say("barRemove"), danger: true, act: () => transport.setStatus("REVOKED") });
                return;
            case "pause":
                if (seat === "community") lever({ title: say("confirmPauseCommunityTitle", { community }), body: say("confirmPauseCommunityBody", { community }), confirm: say("barPause"), act: () => transport.setHidden!(true) });
                else lever({ title: say("confirmPauseSellerTitle", { community }), body: say("confirmPauseSellerBody", { community }), confirm: say("barPause"), act: () => transport.setStatus("PAUSED") });
                return;
            case "resume":
                if (seat === "community") lever({ title: say("confirmResumeCommunityTitle", { community }), body: say("confirmResumeCommunityBody", { community }), confirm: say("barResume"), act: () => transport.setHidden!(false) });
                else lever({ title: say("confirmResumeSellerTitle", { community }), body: say("confirmResumeSellerBody", { community }), confirm: say("barResume"), act: () => transport.setStatus("ACTIVE") });
                return;
            case "withdraw":
                if (status === "PENDING") lever({ title: say("confirmWithdrawTitle"), body: say("confirmWithdrawBody"), confirm: say("withdrawRequest"), danger: true, act: () => transport.setStatus("CANCELLED") });
                else lever({ title: say("confirmWithdrawLiveTitle", { community }), body: say("confirmWithdrawLiveBody", { community }), confirm: say("withdraw"), danger: true, act: () => transport.setStatus("CANCELLED") });
                return;
            case "acceptBooking":
                if (eventId && transport.decideBooking) lever({ title: say("confirmAcceptTitle"), body: say("confirmAcceptBody", { seller }), confirm: say("acceptBooking"), act: () => transport.decideBooking!(eventId, "ACCEPT") });
                return;
            case "declineBooking":
                if (eventId && transport.decideBooking) lever({ title: say("confirmDeclineTitle"), body: say("confirmDeclineBody", { seller, community }), confirm: say("declineAndRefund"), danger: true, note: { label: say("declineReason", { seller }) }, act: (note) => transport.decideBooking!(eventId, "DECLINE", note) });
                return;
        }
    };

    // ── the three tiles ──
    const msgs = chatItems(say, { seat, kind, topics, proposals: [], sellerId, meId: props.currentUser?.id ?? null, names, other: { name: other, image: otherImage }, me: props.currentUser ?? undefined })
        .filter((x) => x.type === "msg") as Array<{ type: "msg"; at: number | null; mine: boolean; name: string }>;
    const lastMsg = msgs[msgs.length - 1] ?? null;
    const timeOf = (at: number | null) => {
        if (!at) return "";
        const iso = new Date(at).toISOString();
        return shortDate(iso) === shortDate(new Date().toISOString()) ? clockOf(iso) : shortDate(iso);
    };
    const tiles: Record<SectionId, TileState> = {
        overview: { sub: kind === "event" && item?.startDate ? shortDate(item.startDate, tz) : say("secSent", { date: shortDate(listing.createdAt) }) },
        earnings: {
            sub: m?.live && m.soldSoFar ? say("subSold", { count: m.soldSoFar.count })
                : !paid || (m && !m.oneSale && !(m.prices ?? []).some((p) => !p.free)) ? say("free")
                    : rate != null ? say("secAgreed", { terms })
                        : d.offer ? say("secProposed", { terms: termsLabel(say, Number(d.offer.proposal.commissionRate ?? 0), d.offer.proposal.package?.name ?? null, kind) })
                            : one?.rateSource === "matrix" ? say("secAgreed", { terms: termsLabel(say, one.commissionRate, null, kind) })
                                : say("secNoPackage"),
            dot: !!theirOffer,
            badge: d.myAddons.length || undefined,
        },
        negotiation: props.chatHref
            ? { sub: say("secChatSub", { who: other }) }
            : {
                sub: lastMsg ? (lastMsg.mine ? say("secYouWrote", { time: timeOf(lastMsg.at) }) : say("secWrote", { who: lastMsg.name, time: timeOf(lastMsg.at) })).trim() : say("secNoMessages"),
                dot: !!lastMsg && !lastMsg.mine,
            },
    };
    const active: SectionId = focus ?? "overview";

    // ── each section ──
    // ── T-414: the community's custom ask, and Cobuntu Premium for the seller ──
    const asking = !!pendingAsk && status === "PENDING";
    const viewSale = cheapestSale(asking ? askMoney : m);
    const viewFee = viewSale?.lines.find((l) => l.key === "cobuntu")?.amount ?? 0;
    const viewFeePct = (asking ? askMoney : m)?.rates?.sellerFeePct ?? 0;
    /*
     * Premium is offered to the SELLER, on an item they own (not a community's),
     * while they still pay Cobuntu's platform fee, and only where the host can
     * sell it. The community never sees it.
     */
    const premiumOffer = seat === "seller" && !parties.owner && !!props.premiumCheckout && viewFee > 0 && viewFeePct > 0;
    const premiumCard = premiumOffer && !premiumDismissed && viewSale
        ? <PremiumCard say={say} fee={viewFee} feePct={viewFeePct} cur={(asking ? askMoney : m)?.currency ?? "EUR"} onGet={() => setSheet("premium")} onDismiss={dismissPremium} />
        : null;
    /** This listing page, for Premium checkout to come back to (with the offer to accept, if any). */
    const returnPathFor = (acceptId: string | null) =>
        (typeof window === "undefined" ? "" : window.location.pathname) + (acceptId ? `?accept=${encodeURIComponent(acceptId)}` : "");

    let section: ReactNode = null;
    if (active === "overview") {
        const log = booking?.details?.logistics ?? {};
        const mkt = booking?.details?.marketing ?? {};
        const facts = booking?.details ? [
            { title: seat === "community" ? say("whatTheyToldYou", { seller: names.seller }) : say("whatYouTold", { community: names.community }), rows: [[say("sheetPlan"), mkt.plan], [say("sheetMore"), mkt.more]] as Array<[string, unknown]> },
            { title: say("logistics"), rows: [[say("sheetFormat"), log.format === "Other" ? log.formatOther : log.format], [say("sheetSchedule"), log.schedule], [say("sheetOutside"), log.outside], [say("sheetAccessSetup"), log.accessSetup], [say("sheetPrevious"), log.previous]] as Array<[string, unknown]> },
            { title: say("marketing"), rows: [[say("sheetShare"), mkt.share], [say("sheetContact"), mkt.contact]] as Array<[string, unknown]> },
        ] : [];
        const canChange = seat === "seller" && booking && d.bookingLive && eventId && (transport.setGuests || transport.setDetails || transport.dateOptions);
        section = (
            <OverviewSection say={say} kind={kind} item={item} m={m} listingPrice={listing.listingPrice ?? null}
                owner={owner.name ? owner : null} createdAt={listing.createdAt ?? null} tz={tz}
                booking={booking} room={m?.upfront?.room ?? null} facts={facts}
                onChangeRequest={canChange ? () => setSheet("request") : undefined} />
        );
    }
    if (active === "earnings") {
        const cur = m?.currency ?? "EUR";
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
        const stepProps = { say, seat, kind, money: m, parties, premium: props.premium, ...handlers };
        section = (
            <>
                {asking && pendingAsk && <AskCard say={say} names={names} parties={parties} offer={pendingAsk} now={rate ?? 0} />}
                <EarningsSection say={say} seat={seat} kind={kind} m={asking ? (askMoney ?? m) : m} parties={parties}
                    terms={asking ? { name: null, rate: null, sub: "" } : { name: packageName, rate: shownRate, sub: termsSub }}
                    onPickPackage={status === "PENDING" && !asking ? () => setSheet({ pkg: null }) : undefined}
                    onChangePackage={switchPackage && !asking ? () => setSheet("package") : undefined}
                    points={seat === "seller" && myPackage ? packagePoints(myPackage.description) : undefined}
                    links={props.links}>
                    {asking && pendingAsk && (
                        <AskCompare say={say} names={names} now={rate ?? 0} ask={Number(pendingAsk.commissionRate ?? 0)}
                            base={cheapestSale(m)} at={cheapestSale(askMoney)} cur={m?.currency ?? "EUR"} />
                    )}
                    {premiumCard}
                    {m?.upfront && <Upfront {...stepProps} m={m} />}
                    {m && <Result {...stepProps} m={m} />}
                    {seat === "seller" && m?.live && props.premium}
                </EarningsSection>
            </>
        );
    }
    if (active === "negotiation") {
        section = (
            <NegotiationSection say={say} seat={seat} kind={kind} topics={topics} proposals={proposals} sellerId={sellerId}
                me={props.currentUser} other={{ name: other, image: otherImage }} names={names} transport={transport} after={after} />
        );
    }

    const returnUrl = typeof window !== "undefined" ? (() => { const u = new URL(window.location.href); u.searchParams.set("card", "done"); return u.toString(); })() : "";

    /** The listing beside its chat (T-417): one column, the same moves and dialogs as the page. */
    function drawerView() {
        const community = names.community;
        const askRate = asking && pendingAsk ? Number(pendingAsk.commissionRate ?? 0) : null;
        const hiddenLive = status === "ACTIVE" && !!listing.isHidden;
        const shownStatus: ListingStatus | null = hiddenLive ? "PAUSED" : status;
        const statusLabel = shownStatus === "ACTIVE" ? say("stateLive")
            : shownStatus === "PAUSED" ? say("statePaused")
                : shownStatus === "PENDING" ? (seat === "community" ? say("drwYourReview") : say("drwPending"))
                    : status === "REVOKED" ? say("stateClosedRevoked") : say("stateClosedWithdrawn");

        // Ending or pausing it: the footer. Text-styled terms moves: the terms card. The rest: the decision card.
        const footer = decision.moves.filter((mv) => FOOTER_MOVES.includes(mv.id) && !mv.primary);
        const termsMoves = decision.moves.filter((mv) => TERMS_MOVES.includes(mv.id) && mv.text);
        const main = decision.moves
            .filter((mv) => !footer.includes(mv) && !termsMoves.includes(mv))
            .sort((a, b) => Number(a.id === "reply") - Number(b.id === "reply"));
        const open = status === "PENDING" || status === "ACTIVE" || status === "PAUSED";
        if (open && props.onReply && !main.some((mv) => mv.id === "reply")) main.push({ id: "reply", label: say("askReply") });

        const liveUrl = props.links?.live ?? null;
        const share = async () => {
            if (!liveUrl) return;
            try { await navigator.clipboard.writeText(liveUrl); setToast(say("linkCopied")); } catch { setToast(liveUrl); }
        };
        const extra = status === "ACTIVE" && !hiddenLive && liveUrl ? (
            <>
                <a className="cbtl-dd-s" href={liveUrl} target="_blank" rel="noreferrer">{say("drwViewOn", { community })}</a>
                <button type="button" className="cbtl-dd-s" onClick={() => void share()}>{say("drwShare")}</button>
            </>
        ) : null;

        const cur = m?.currency ?? "EUR";
        const paidPrices = pricesOf(m).filter((x) => !x.free);
        const cheapest = paidPrices.length ? paidPrices[cheapestPaid(paidPrices)] : null;
        const priceText = !m ? "" : cheapest
            ? (paidPrices.length > 1 ? say("ovPrices", { count: paidPrices.length, price: money(cheapest.gross, cur) }) : money(cheapest.gross, cur))
            : say("free");
        const kindKey = kind === "event" ? null
            : item?.productType === "PHYSICAL" ? "drwKindPhysical"
                : item?.productType === "COURSE" ? "drwKindCourse" : "drwKindDigital";

        return (
            <div className="cbtl cbtl-drw" style={rootStyle} data-seat={seat}>
                <style>{LISTING_PAGE_CSS}</style>
                <DrawerHead say={say} image={imagesOf(item)[0] ?? null} name={itemName} parties={parties}
                    status={shownStatus} statusLabel={statusLabel} terms={asking ? termsLabel(say, rate ?? 0, packageName, kind) : terms}
                    onClose={props.onClose} />
                <div className="cbtl-db">
                    <DrawerDecision decision={decision} moves={main} extra={extra} onMove={onMove} />
                    <DrawerMoney say={say} seat={seat} kind={kind} parties={parties}
                        m={asking ? (askMoney ?? m) : m} base={asking ? m : null} baseRate={rate ?? 0}
                        rate={asking ? askRate : (rate ?? shownRate)} />
                    <DrawerTerms say={say} now={asking ? termsLabel(say, rate ?? 0, packageName, kind) : terms} nowSub={asking ? "" : termsSub}
                        ask={askRate != null ? percent(askRate) : null} askWho={community} actions={termsMoves} onMove={onMove} />
                    <DrawerDetails say={say} items={[
                        { label: say("ovPrice"), value: priceText },
                        kind === "event"
                            ? { label: say("drwDate"), value: item?.startDate ? shortDate(item.startDate, tz) : "" }
                            : { label: say("drwKind"), value: kindKey ? say(kindKey) : "" },
                        { label: say("drwSent"), value: listing.createdAt ? shortDate(listing.createdAt) : "" },
                        seat === "community"
                            ? { label: say("drwSeller"), value: owner.name }
                            : { label: say("drwCommunity"), value: community },
                    ]} />
                </div>
                <DrawerFooter moves={footer} onMove={onMove} />
                {overlays}
                {toast && <div className="cbtl-toast" role="status">{toast}</div>}
            </div>
        );
    }

    const overlays = (
        <>
            {confirm && <Confirm spec={confirm} onClose={() => setConfirm(null)} cancel={say("cancel")} failed={say("failed")} />}
            {sheet === "package" && (
                <PackageSwitchSheet say={say} transport={transport} names={names} parties={parties} currentId={onPackageId}
                    live={status === "ACTIVE" || status === "PAUSED"}
                    onClose={() => setSheet(null)} onDone={(msg) => { setSheet(null); void after(msg); }} />
            )}
            {sheet === "terms" && (
                <ChangeTermsSheet say={say} kind={kind} transport={transport} names={names} parties={parties} now={rate} base={m}
                    onClose={() => setSheet(null)} onDone={(msg) => { setSheet(null); void after(msg); }} />
            )}
            {sheet === "accept" && theirOffer && (
                <AcceptDialog say={say} item={itemName} names={names} parties={parties} offer={theirOffer} ask={askMoney} now={rate ?? 0}
                    premium={premiumOffer ? props.premiumCheckout : undefined} returnPath={returnPathFor(theirOffer.id)}
                    onClose={() => setSheet(null)}
                    onAccept={async () => { await transport.respond(theirOffer.id, "ACCEPTED"); setSheet(null); await after(say("saved")); }} />
            )}
            {sheet === "premium" && props.premiumCheckout && (
                <PremiumSheet say={say} premium={props.premiumCheckout} returnPath={returnPathFor(null)} onClose={() => setSheet(null)} />
            )}
            {sheet === "card" && eventId && (
                <CardSheet say={say} transport={transport} eventId={eventId} publishableKey={props.stripePublishableKey} returnUrl={returnUrl} navigate={props.navigate} onClose={() => setSheet(null)} />
            )}
            {sheet === "request" && eventId && booking && (
                <RequestSheet say={say} transport={transport} eventId={eventId} booking={booking} guestCount={addons?.guestCount ?? booking.guestCount} locked={!!addons?.locked}
                    community={names.community} currency={booking.currency} onClose={() => { setSheet(null); void after(); }} onSaved={(msg) => { setToast(msg); void load(); }} />
            )}
            {sheet && typeof sheet === "object" && "pkg" in sheet && (
                <PackageSheet say={say} seat={seat} kind={kind} transport={transport} names={names} parties={parties}
                    offer={theirOffer} initialId={sheet.pkg}
                    onClose={() => setSheet(null)} onDone={(msg) => { setSheet(null); setFocus("earnings"); void after(msg); }} />
            )}
            {sheet && typeof sheet === "object" && "price" in sheet && eventId && transport.decideAddon && (
                <PriceSheet say={say} name={sheet.price.name} currency={m?.currency ?? "EUR"} onClose={() => setSheet(null)}
                    onSend={async (cents) => { await transport.decideAddon!(eventId, sheet.price.id, { decision: "PROPOSE_PRICE", priceCents: cents }); await after(say("saved")); }} />
            )}
        </>
    );

    if (props.layout === "drawer") {
        return drawerView();
    }

    const crumbs = props.breadcrumbs ?? [{ label: seat === "seller" ? say("crumbYours") : say("crumbRequests"), href: props.backHref }];
    const sectionName = { overview: say("secOverview"), earnings: say("secEarnings"), negotiation: say("secNegotiation") }[active];

    return (
        <div className="cbtl" style={rootStyle} data-seat={seat}>
            <style>{LISTING_PAGE_CSS}</style>
            <div className="cbtl-inner">
                {/*
                  The trail, drawn like the community app's own Breadcrumb
                  (components/layout/Breadcrumb.tsx; redone 24 Nov 2026, the
                  old one set its chevrons below the text): a round back
                  button, the way there in muted text, faint "/" between, and
                  where you are in full weight, all on one line.
                */}
                <nav className="cbtl-crumb" aria-label="Breadcrumb">
                    {crumbs[0]?.href && (
                        <a href={crumbs[0].href} className="cbtl-crumb-back" aria-label={`${say("back")}: ${crumbs[0].label}`}>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                        </a>
                    )}
                    {[
                        ...crumbs.map((c) => ({ label: c.label, href: c.href })),
                        { label: itemName, href: props.endWithCommunity && names.community ? props.itemHref : undefined },
                        ...(props.endWithCommunity && names.community ? [{ label: names.community, href: undefined }] : []),
                    ].map((c, i, all) => {
                        const last = i === all.length - 1;
                        return (
                            <span className="cbtl-crumb-step" key={i}>
                                {i > 0 && <span className="cbtl-crumb-sep" aria-hidden="true">/</span>}
                                {last
                                    ? <span className="cbtl-crumb-cur" aria-current="page">{c.label}</span>
                                    : c.href ? <a href={c.href} className="cbtl-crumb-link">{c.label}</a> : <span className="cbtl-crumb-link">{c.label}</span>}
                            </span>
                        );
                    })}
                </nav>

                {/*
                  The header (option A, 2026-11-24): the item's name, who is on
                  the other side, and the host's buttons, nothing else. The
                  other side is the seller for the community (photo, name,
                  @usertag) and the community for the seller (its icon,
                  "with <community>"). The buttons are the host's (`tools`),
                  drawn with .cbtl-hbtn so both apps' buttons match.
                */}
                <header className="cbtl-head">
                    <span style={{ flex: "1 1 0", minWidth: 0 }}>
                        <h1 className="cbtl-title">{itemName}</h1>
                        <span className="cbtl-sub">
                            {/* The seller is a person (their library avatar when they have no photo); the community shows its icon. */}
                            <Avatar image={otherImage} name={other} size={24} person={seat === "community" ? { id: parties.seller.id, usertag: parties.seller.usertag } : undefined} />
                            {seat === "seller"
                                ? <span>{ownerCommunity ? say("fromCommunity", { community: ownerCommunity.name }) : say("withCommunity", { community: names.community })}</span>
                                : <>
                                    <span className="cbtl-sub-name">{names.seller}</span>
                                    {sellerTag && <span className="cbtl-sub-tag">@{sellerTag}</span>}
                                </>}
                        </span>
                    </span>
                    {toolsNode && <span className="cbtl-tools">{toolsNode}</span>}
                </header>

                <SectionTiles say={say} active={active} states={tiles}
                    labels={props.chatHref ? { negotiation: say("secChat") } : undefined}
                    onPick={(id) => { if (id === "negotiation" && props.chatHref) openChat(); else setFocus(id); }} />

                <section className="cbtl-section" aria-label={sectionName}>{section}</section>

                <DecisionBar decision={decision} onMove={onMove} />
            </div>

            {overlays}
            {toast && <div className="cbtl-toast" role="status">{toast}</div>}
        </div>
    );
}
