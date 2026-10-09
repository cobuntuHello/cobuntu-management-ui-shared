"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { defaultTranslate } from "./copy";
import { DealSpine } from "./ui/DealSpine";
import { NextAction } from "./ui/NextAction";
import { Topics, type Topic } from "./ui/Topics";
import { listingTokenStyle, LISTING_MOTION } from "./ui/tokens";
import {
  isClosedState,
  normalizeListingState,
  toRate,
  type ListingState,
} from "./manageListingRows";
import { isAwaitingReview, ownerListingActions, reviewerListingActions } from "./listingTransitions";

/**
 * One listing, in full: its terms, its thread, and the levers its owner holds.
 *
 * ── Why a page and not the drawer that already existed ─────────────────────
 *
 * The drawer showed views, sales and a Hide toggle. That is a report on a
 * listing, not the listing itself. What a seller actually needs to see is the
 * ARRANGEMENT — which package, at what rate, agreed with whom, and everything
 * either side has said about it since. That does not fit beside a page, and it
 * is addressable: a review notification can link straight here.
 *
 * ── Pause is not Hide ──────────────────────────────────────────────────────
 *
 * The old control set said "Hide", which read as a display preference. PAUSED
 * is a state the backend guards as owner-only: off the shelf, still approved,
 * and yours to undo without asking anybody. A leader cannot pause your listing;
 * they can revoke it, which is a different word for a different act. The
 * buttons say what the states are.
 *
 * ── Where the buttons come from ────────────────────────────────────────────
 *
 * Not from this file. `ownerListingActions` asks the mirrored state machine
 * what the server would accept from this state, and the panel renders that
 * answer. Writing the conditions here instead is how the control set and the
 * guard drift apart; see components/listings/listingTransitions.ts.
 */

/**
 * How this panel talks to the API, and in whose name.
 *
 * The community app is same-origin with a session cookie, so it passes
 * nothing. The admin is a different origin with a Bearer token, so it passes
 * both. Same shape the event and product packages already use.
 */
export interface ListingDetailConfig {
  /** Absolute API origin. Empty means same-origin, which is the default. */
  apiBaseUrl?: string;
  /** Merged into every request. Bearer for the admin; nothing for the app. */
  authHeaders?: Record<string, string>;
  /**
   * Which seat this is being viewed from.
   *
   * The transition table is one machine seen from two chairs. An owner may
   * pause, resume and withdraw; a leader may approve and revoke — and CANNOT
   * withdraw, because CANCELLED is owner-only. Recording a leader's decision
   * as the seller's withdrawal would put the wrong name on it forever.
   *
   * Defaults to "owner", so the community app that has always mounted this
   * needs no change and cannot accidentally acquire a leader's powers.
   */
  viewer?: "owner" | "leader";
  /**
   * The host's brand colour, for the one thing that commits.
   *
   * Community app: the community's own. Admin: omitted, deliberately — a
   * leader works across communities, and repainting the page per community
   * would turn "whose shelf am I on" into a colour-matching exercise.
   */
  brand?: string;
  /**
   * Translate, next-intl's signature exactly.
   *
   * A host with its own translations passes its `t` straight down and keeps
   * every locale it already had. Omitted, the package uses its own English —
   * which is what lets the admin mount this with no message file at all.
   */
  t?: (key: string, vars?: Record<string, unknown>) => string;
}

const STATE_LABEL_KEY: Record<ListingState, string> = {
  ACTIVE: "stateActive",
  PENDING: "statePending",
  PAUSED: "statePaused",
  CANCELLED: "stateWithdrawn",
  REVOKED: "stateRevoked",
};

const STATE_TONE: Record<ListingState, string> = {
  ACTIVE: "text-emerald-700 bg-emerald-50",
  PENDING: "text-amber-700 bg-amber-50",
  PAUSED: "text-zinc-600 bg-zinc-100",
  CANCELLED: "text-zinc-500 bg-zinc-100",
  REVOKED: "text-zinc-500 bg-zinc-100",
};

interface Proposal {
  id: string;
  commissionRate: unknown;
  message?: string | null;
  status?: string | null;
  createdAt?: string | null;
  package?: { id: string; name: string } | null;
  proposedBy?: { id?: string; name?: string | null } | null;
  proposedByUser?: { id?: string; name?: string | null } | null;
}

export interface ManagedListingDetailProps {
  kind: "product" | "event";
  listingId: string;
  /** Back to the Listings tab this row was opened from. */
  backHref: string;
  /** Name of the thing being listed, for the breadcrumb. */
  itemName?: string | null;
  /**
   * The trail to this page, innermost LAST. The final crumb renders as plain
   * text; every earlier one links.
   *
   * Passed in rather than built here because the two apps arrive by different
   * routes and should say so. A member gets here through their own product
   * (Marketplace / Chair / Cobuntu) and wants the middle crumb to take them
   * back to managing it; a leader gets here from a review queue (Product
   * listing requests / Chair) and has no manage page to return to. The panel
   * knows neither app's routing, and the version that guessed said "Listings"
   * to both of them.
   *
   * Omitted, it falls back to that old two-crumb shape, so a host that has not
   * been updated keeps working.
   */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /**
   * Close the trail with the community's name.
   *
   * The community is the one crumb the HOST cannot supply: it arrives with the
   * listing, which this panel loads. A callback handing it back up would work
   * and would also invite a render loop for one string, so the host declares
   * that it wants the crumb and the panel fills it in.
   *
   * The community app wants it — a member is choosing between several
   * communities carrying the same product. The admin does not: it is already
   * scoped to one community, and the name would repeat the page it is on.
   */
  appendCommunityCrumb?: boolean;
  /**
   * Close the trail with the LISTED ITEM's name.
   *
   * The twin of `appendCommunityCrumb`, and for the same reason: a reviewer
   * arrives from a queue of many products and the useful last crumb is which
   * one they opened. The admin has no product fetch of its own, and adding one
   * to name a breadcrumb would be a second request for a string the panel is
   * already holding.
   *
   * Falls back to `itemName` when the loaded listing has no name on it, so a
   * host that already passes the name keeps working either way.
   */
  appendItemCrumb?: boolean;
  /**
   * The signed-in user, so the topics composer shows their real photo instead
   * of a bare initial. Each app passes its own session user (community-app from
   * its auth context, admin from /me). Optional — falls back to the initial.
   */
  currentUser?: { name?: string | null; avatarUrl?: string | null };
}

export function ManagedListingDetail({
  kind, listingId, backHref, itemName, breadcrumbs, appendCommunityCrumb, appendItemCrumb, currentUser,
  apiBaseUrl = "", authHeaders, t: translate, viewer = "owner", brand,
}: ManagedListingDetailProps & ListingDetailConfig) {
  const t = translate ?? defaultTranslate;
  const API = apiBaseUrl;
  /*
   * Spread into every request. `headers: {}` was fine when the only caller was
   * same-origin with a cookie; the admin needs its Bearer on the same calls.
   */
  const authed = { headers: { ...(authHeaders ?? {}) } };

  const [listing, setListing] = useState<any>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  /*
   * Topics — everything about this listing that is not the rate. Loaded
   * alongside the thread rather than lazily: unlike the packages below, this is
   * what most visits to this page are FOR once a negotiation is under way, and
   * a feed that appears a beat after the page does reads as a glitch.
   */
  const [topics, setTopics] = useState<Topic[]>([]);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  /*
   * EVERY LEVER CONFIRMS FIRST.
   *
   * All of these are public and most are hard to undo: taking a live listing
   * off the shelf stops sales immediately, approving puts an item in front of a
   * community, and revoking ends the arrangement rather than pausing it. Only
   * withdrawal used to ask, which meant the two acts that a leader performs on
   * someone else's listing were the unguarded ones.
   *
   * The modal states what happens rather than asking "are you sure" -- a
   * confirmation that only repeats the button teaches people to click through
   * it, and the next one that matters gets the same reflex.
   */
  const [pending, setPending] = useState<null | {
    to: "ACTIVE" | "PAUSED" | "REVOKED";
    title: string;
    body: string;
    confirm: string;
    danger?: boolean;
  }>(null);
  /*
   * TWO TABS, and the split is by how long you stay.
   *
   * "Terms" is what you came for: the rate, the agreement, and the points
   * either side has raised, which is the live conversation you act on. History
   * is the record of every rate formally put forward -- read once, argued over
   * rarely, and empty on the common listing that was accepted as asked. It had
   * been a full card holding one grey sentence in the middle of the page.
   */
  /*
   * The OTHER deductions, from the endpoint that publishes them.
   *
   * Not a copy of the rates kept here: feeConstants.ts is the single
   * definition, /api/config/fees is its published form, and it honours a
   * community's negotiated platform rate which a hardcoded 8% would not. Null
   * while it loads and if it fails -- the bar then shows only what was agreed,
   * which is less than the whole truth and better than an invented one.
   */
  const [fees, setFees] = useState<{ platformRate: number; memberSellerRate: number; memberSellerFixed: number } | null>(null);
  /*
   * Countering, from the SELLER's side.
   *
   * The backend has always allowed it — `createProposal` authorises the product
   * owner as well as a leader, and takes a message — but this panel only ever
   * READ the thread. So the seller's options were wait, or withdraw the whole
   * request and start again, even when all they wanted was a different package.
   *
   * `offered` is loaded lazily, when they open the form: most visits to this
   * page are someone checking whether they have been answered, and the packages
   * are only needed by the one who is about to change their mind.
   */
  const [composing, setComposing] = useState(false);
  const [offered, setOffered] = useState<{ id: string; name: string; description: string | null; rate: number }[]>([]);
  const [pickedPackage, setPickedPackage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState("");

  const base = kind === "event" ? `${API}/api/event-listings` : `${API}/api/listings`;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const load = useCallback(async () => {
    if (!listingId) return;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(listingId)}`, authed);
      if (!res.ok) { setFailed(true); return; }
      const data = await res.json();
      setListing(data);
      /*
       * The thread arrives two different ways and both are read.
       *
       * The product read hydrates `proposals` onto the listing itself; the
       * event read does not, and has a sibling endpoint that answers
       * `{ proposals }`. Preferring whatever the listing already carried keeps
       * the product side to one request.
       */
      if (Array.isArray(data?.proposals)) {
        setProposals(data.proposals);
      } else {
        const pr = await fetch(`${base}/${encodeURIComponent(listingId)}/proposals`, authed);
        if (pr.ok) {
          const body = await pr.json();
          setProposals(Array.isArray(body) ? body : (body?.proposals ?? []));
        }
      }
      /*
       * Topics are their own read on both sides — unlike proposals, neither
       * listing endpoint hydrates them. A failure here is deliberately not
       * `setFailed`: the terms and the thread are still worth showing if the
       * feed alone did not answer.
       */
      try {
        const tr = await fetch(`${base}/${encodeURIComponent(listingId)}/topics`, authed);
        if (tr.ok) {
          const body = await tr.json();
          setTopics(Array.isArray(body) ? body : (body?.topics ?? []));
        }
      } catch { /* leave the feed empty rather than losing the page */ }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [base, listingId]);

  useEffect(() => { void load(); }, [load]);

  /*
   * ABOVE THE EARLY RETURN, like every other hook here.
   *
   * This sat below `const community = ...`, which is below `if (loading)
   * return`. React then saw a different number of hooks between the loading
   * render and the loaded one and threw -- the panel rendered as an empty div,
   * every test lost its DOM, and nothing in the stack said "hook". It reads the
   * raw listing instead so it can live up here.
   */
  useEffect(() => {
    let cancelled = false;
    const c = (listing as any)?.community ?? (listing as any)?.communities ?? null;
    const tag = c?.tagLower || c?.communityTag;
    fetch(`${API}/api/config/fees${tag ? `?communityTag=${encodeURIComponent(tag)}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setFees(d); })
      .catch(() => { /* the bar falls back to the agreement alone */ });
    return () => { cancelled = true; };
  }, [listing]);

  /*
   * The package's NAME, which the listing read does not carry.
   *
   * Both listing endpoints return `packageId` and the snapshotted rate but not
   * the package relation, so the name has to come from the packages endpoint,
   * which answers `{ packages, selectedPackageId }` for exactly this listing.
   * Best-effort by design: a package retired since the deal was struck is no
   * longer offered and so will not be in the list, and the terms then read as
   * the rate alone rather than as a wrong name.
   */
  useEffect(() => {
    if (!listing?.packageId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/${encodeURIComponent(listingId)}/packages`, authed);
        if (!res.ok) return;
        const body = await res.json();
        const chosen = (body?.packages ?? []).find((p: any) => p?.id === listing.packageId);
        if (!cancelled && chosen?.name) setPackageName(chosen.name);
      } catch { /* the rate still tells the truth on its own */ }
    })();
    return () => { cancelled = true; };
  }, [base, listingId, listing?.packageId]);

  async function move(to: ListingState) {
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(listingId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify({ status: to }),
      });
      if (res.ok) {
        showToast(to === "PAUSED" ? t("paused") : to === "ACTIVE" ? t("resumed") : t("withdrawn"));
        await load();
        return;
      }
      // The transition machine refuses in words ("Only the seller can take
      // their own listing off the shelf"), and those words are the answer.
      const err = await res.json().catch(() => ({}));
      showToast(err?.error || t("actionFailed"));
    } catch {
      showToast(t("actionFailed"));
    } finally {
      setBusy(false);
      setConfirmWithdraw(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-zinc-100" />
        <div className="h-40 rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  if (failed || !listing) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-zinc-500">{t("notFound")}</p>
        <Link href={backHref} className="mt-3 inline-block text-[13px] font-medium text-zinc-900 hover:underline cursor-pointer">
          {t("backToListings")}
        </Link>
      </div>
    );
  }

  const state = normalizeListingState(listing.status);
  const rate = toRate(listing.commissionRate ?? listing.ticketListing?.commissionRate);
  const community = listing.community ?? listing.communities ?? null;


  /*
   * What is being listed, from the listing itself. The product side nests it as
   * `products` (the Prisma relation) and the event side as `events`; both have
   * been seen singular too, over this endpoint's life. `itemName` last, for a
   * host that fetched the name itself.
   */
  const listedItemName: string | null =
    listing.products?.name ?? listing.product?.name
    ?? listing.events?.name ?? listing.event?.name
    ?? itemName ?? null;

  /*
   * The hero leads with the ITEM under review, not the community. A leader is
   * already inside one community and a member sees it close the breadcrumb, so
   * the headline is spent on the thing being judged and the facts that decide
   * it: when it runs, what it costs, and who asked. Everything here is
   * best-effort -- a field the payload does not carry simply does not render,
   * never a wrong value. The event read carries a full event DTO (`event`); the
   * product read nests `products`.
   */
  const heroItem: any =
    kind === "event" ? (listing.event ?? listing.events ?? null) : (listing.products ?? listing.product ?? null);
  const heroImage: string | null =
    (kind === "event"
      ? heroItem?.bannerUrl ?? heroItem?.coverImage ?? heroItem?.imageUrl
      : heroItem?.imageUrl ?? heroItem?.coverImage ?? heroItem?.image) ?? null;
  /* Date for events only; a product has no single date to lead with. */
  const heroDate: string | null =
    kind === "event" && heroItem?.startDate ? formatDate(heroItem.startDate) : null;
  /*
   * Free or paid comes from the server's `isPaid` flag, NOT `event.price`.
   *
   * The detail read's `event.price` is derived from transformEvent's
   * publish-gated tiers: for a non-host viewer (every leader reviewing a
   * request) a draft tier is hidden, so a PAID event comes back with
   * `price: null` and the hero read "Free" on a €5 event -- the 2026-06-03 PBN
   * "Free" incident, resurfaced by this page. `isPaid` is computed off the
   * products and survives that gate, and `listingPrice` ({ amount, currency },
   * major units) is the matching amount. Until the backend that adds
   * listingPrice is live it is absent, so a paid event shows no amount rather
   * than a wrong "Free"; once it lands, the price appears.
   */
  const heroIsFree = kind === "event" && listing.isPaid === false;
  const heroListingPrice = kind === "event" ? (listing.listingPrice ?? null) : null;
  const heroPrice: string | null =
    kind === "event"
      ? (heroIsFree
          ? t("free")
          : (heroListingPrice && Number(heroListingPrice.amount) > 0
              ? formatMoney(Number(heroListingPrice.amount), heroListingPrice.currency)
              : null))
      : null;
  const requesterName: string | null = listing.requestedBy?.name ?? null;

  const closed = isClosedState(state);
  const waiting = isAwaitingReview(state);
  /*
   * Whether there is anything left to negotiate.
   *
   * PENDING and ACTIVE are both open to it: a request under review can be
   * corrected, and a live listing can be retraded. A closed one cannot —
   * proposing against a cancelled request would file terms for a shelf nobody
   * is on.
   */
  const canCounter = state === "PENDING" || state === "ACTIVE";

  async function openCompose(): Promise<{ id: string; name: string; description: string | null; rate: number }[]> {
    setComposing(true);
    if (offered.length > 0) return offered;
    try {
      const res = await fetch(`${base}/${encodeURIComponent(listingId)}/packages`, authed);
      // An unreadable list is an EMPTY one: the picker then says the
      // community publishes none, which is the honest reading of "we could
      // not find any" from the seller's side.
      if (!res.ok) return [];
      const body = await res.json().catch(() => null);
      const list = Array.isArray(body?.packages) ? body.packages : [];
      setOffered(list);
      return list;
    } catch {
      /* The form still opens; without packages there is nothing to pick and the
         note alone is not a proposal, so Send stays disabled. */
    }
    return [];
  }

  /**
   * The spine offers a RATE; the endpoint takes a PACKAGE.
   *
   * A counter moves the listing between arrangements the community has
   * PUBLISHED — a rate that is not one of theirs is a private deal, and the
   * backend refuses it outright. So the number is resolved back to the package
   * that charges it, and an unmatched number opens the picker instead of
   * silently posting something that will 400.
   */
  async function counterToRate(target: number) {
    /*
     * LOAD FIRST, then match. Reading `offered` straight off state meant the
     * very first counter always fell through to the picker, because the
     * packages are fetched lazily and had not arrived yet — the seller typed a
     * rate the community publishes and was asked to pick it again.
     */
    const list = offered.length > 0 ? offered : await openCompose();
    const match = list.find((p) => Number(p.rate) === Number(target));
    if (!match) { setComposing(true); return; }
    setComposing(false);
    setPickedPackage(match.id);
    await postProposal(match.id, note.trim() || undefined);
  }

  /*
   * ── Topics: the half of the negotiation that is not money ─────────────────
   *
   * All three re-read the feed rather than patching state locally, for one
   * reason: `status` is DERIVED server-side from two close flags, so the
   * response to "I am done" may or may not close the topic depending on what
   * the other side did — possibly seconds ago, in another tab. Guessing here
   * would show a topic as settled that the server still has open.
   *
   * The topic-scoped base mirrors the listing one: the same swap between
   * product and event, one segment along.
   */
  const topicBase = kind === "event" ? `${API}/api/event-listing-topics` : `${API}/api/listing-topics`;

  async function reloadTopics() {
    const res = await fetch(`${base}/${encodeURIComponent(listingId)}/topics`, authed);
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    setTopics(Array.isArray(body) ? body : (body?.topics ?? []));
  }

  async function openTopic(subject: string, body: string) {
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(listingId)}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        credentials: "include",
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await reloadTopics();
    } catch {
      showToast(t("topicsFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function commentOnTopic(topicId: string, body: string) {
    setBusy(true);
    try {
      const res = await fetch(`${topicBase}/${encodeURIComponent(topicId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await reloadTopics();
    } catch {
      showToast(t("topicsFailed"));
    } finally {
      setBusy(false);
    }
  }

  /*
   * Sends the viewer's OWN flag and nothing else. There is deliberately no way
   * from here to write `status` or the other side's flag — the server ignores
   * both, and this is where that contract is honoured rather than tested.
   */
  async function toggleTopicDone(topicId: string, done: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`${topicBase}/${encodeURIComponent(topicId)}/done`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        credentials: "include",
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await reloadTopics();
    } catch {
      showToast(t("topicsFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendProposal() {
    if (!pickedPackage) return;
    await postProposal(pickedPackage, note.trim() || undefined);
  }

  async function postProposal(packageId: string, message?: string) {
    setPosting(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(listingId)}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
        credentials: "include",
        body: JSON.stringify({ packageId, message }),
      });
      if (!res.ok) throw new Error(String(res.status));
      /*
       * Re-read rather than append. The server SUPERSEDES whatever was pending
       * when a new proposal lands, so the thread's other rows change state too
       * — appending locally would show two live offers at once.
       */
      const pr = await fetch(`${base}/${encodeURIComponent(listingId)}/proposals`, authed);
      if (pr.ok) {
        const body = await pr.json().catch(() => null);
        setProposals(Array.isArray(body) ? body : (body?.proposals ?? []));
      }
      setComposing(false);
      setNote("");
      setPickedPackage(null);
    } catch {
      /* Left open with the text intact, so nothing they typed is lost. */
    } finally {
      setPosting(false);
    }
  }
  /*
   * Asked from the seat the viewer is in. Same table, different `who` — which
   * is what stops the two sides being two screens that have to be kept in
   * agreement by hand.
   */
  const actions = viewer === "leader" ? [] : ownerListingActions(state);
  const reviewActions = viewer === "leader" ? reviewerListingActions(state) : [];

  return (
    /*
     * The palette is applied HERE and nowhere else.
     *
     * Inline custom properties on the panel's own root: they cascade to every
     * child, need no build config in either host, and cannot leak out and
     * restyle the app around them — which a stylesheet on :root would.
     */
    /*
     * `brand` lets a host tint the one action colour.
     *
     * The community app is community-BRANDED and passes its colour through;
     * the admin is plain by design, because a leader works across communities
     * and a page that repaints itself per community would make "whose shelf am
     * I on" a colour-matching exercise. Only --commit moves: the paper, the ink
     * and the money bands stay, or the split stops being readable.
     */
    <div
      data-cbt-panel=""
      style={listingTokenStyle(brand ? { "--commit": brand } : undefined)}
      className="text-[var(--ink)]"
    >
      {/*
        * The one stylesheet this panel needs, for the one thing inline styles
        * cannot express: keyframes. Scoped by [data-cbt-panel] and prefixed
        * `cbt-`, and it carries the reduced-motion guard for everything inside
        * so no individual animation has to remember it.
        */}
      <style>{LISTING_MOTION}</style>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-400 mb-4">
        {((breadcrumbs
          ? [
              ...breadcrumbs,
              ...(appendItemCrumb && listedItemName ? [{ label: listedItemName }] : []),
              ...(appendCommunityCrumb ? [{ label: community?.name || t("community") }] : []),
            ]
          : [
              { label: t("listings"), href: backHref },
              { label: community?.name || t("community") },
            ]) as Array<{ label: string; href?: string }>
        ).map((crumb, i, all) => (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-2 min-w-0">
            {i > 0 && <span aria-hidden>/</span>}
            {crumb.href && i < all.length - 1 ? (
              <Link href={crumb.href} className="hover:text-zinc-600 cursor-pointer truncate">{crumb.label}</Link>
            ) : (
              <span className="text-zinc-600 truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/*
        * The item under review leads the page.
        *
        * This used to headline the COMMUNITY -- its icon and name in 18px, the
        * item relegated to a grey subtitle -- which told a leader the one thing
        * they already knew (which community they are in) and buried the thing
        * they opened the page to judge. The community is the breadcrumb above
        * now; the headline is the event or product, with the facts that decide
        * the call beside it: when it runs, what it costs, and who asked.
        */}
      <div className="flex items-start gap-3.5 mb-6">
        {heroImage ? (
          <img src={heroImage} alt="" className="w-20 h-[60px] sm:w-24 sm:h-[72px] rounded-xl object-cover shrink-0 bg-zinc-100" />
        ) : (
          <div className="w-20 h-[60px] sm:w-24 sm:h-[72px] rounded-xl bg-zinc-100 flex items-center justify-center text-[18px] font-semibold text-zinc-400 shrink-0">
            {(listedItemName || community?.name || "?").trim()[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {heroDate && (
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-zinc-400">{heroDate}</p>
          )}
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 leading-tight break-words">
            {listedItemName || community?.name || t("community")}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-zinc-500">
            {heroPrice && (
              <span className={`font-medium ${heroIsFree ? "text-emerald-700" : "text-zinc-700"}`}>{heroPrice}</span>
            )}
            {requesterName && <span>{t("requestedByWho", { who: requesterName })}</span>}
            {listing.createdAt && <span className="text-zinc-400">· {formatDate(listing.createdAt)}</span>}
          </div>
        </div>
        {state && (
          <span className={`shrink-0 px-2.5 py-1 rounded-md text-[12px] font-medium ${STATE_TONE[state]}`}>
            {t(STATE_LABEL_KEY[state])}
          </span>
        )}
      </div>

      {/*
        In review, said plainly, because this is where "Follow the review"
        lands.

        Someone arriving from the Done step pressed a button that promised to
        show them what is happening with their request, and a chip reading "In
        review" beside a commission rate does not answer it. The one thing they
        need to know is that nothing is required of them: it is with the
        community, and the thread below is where the answer will appear.
      */}
      {/*
        * Whose turn, in words, from the reader's seat.
        *
        * Replaces a banner that only ever addressed the seller — a leader was
        * told "there is nothing for you to do until they answer", about
        * themselves, above an Approve button.
        */}
      <NextAction
        state={state}
        viewer={viewer}
        communityName={community?.name || t("community")}
        sellerName={listing.requestedBy?.name ?? null}
        /*
         * Counted here rather than inside the banner, so there is ONE list of
         * topics on this page and the banner cannot disagree with the feed
         * below it about how many are open.
         */
        openTopics={topics.filter((tp) => tp.status === "OPEN").length}
        totalTopics={topics.length}
        lastProposalFrom={
          proposals.length === 0
            ? null
            : (proposals[0]?.proposedBy?.id && listing.requestedBy?.id &&
               proposals[0].proposedBy.id === listing.requestedBy.id)
              ? "owner"
              : "leader"
        }
        t={t}
      />

      {/*
        * ── ONE COLUMN ─────────────────────────────────────────────────────
        *
        * This was a fixed 360px rail beside a flexible feed, and the rail held
        * one card and then three hundred pixels of air while the conversation
        * -- the part with the length -- was squeezed into the remaining 60%.
        * The split was buying stickiness: the terms stayed on screen while you
        * scrolled the thread.
        *
        * That is worth less than it sounds. The terms are four short facts and
        * a rate; they read in a second at the top and do not need to follow you
        * down the page. What does need the width is the thread, which is the
        * only thing here that grows.
        */}
      {/*
        * No tab strip: the cut, the negotiation history and the topics all live
        * on the one page now, top to bottom — the history thread sits under the
        * cut, with the topics conversation below it (topics under the thread, as
        * the section was always meant to read). History was never a task, so a
        * tab for it only hid a record one scroll would have shown.
        */}
      <div>
        <>
        <div>
      {/*
        * The commission, drawn as a cut of every sale rather than listed as a
        * row in a table. A number in a definition list is a fact; the spine
        * shows what it is a share OF, which is the thing being agreed.
        *
        * The package name and the request date sit under it — they describe
        * the deal, they are not the deal.
        */}
      <div className="mb-6">
        <DealSpine
          rate={rate}
          platformShare={fees ? Math.round(fees.platformRate * 100) : undefined}
          sellerFee={fees ? { rate: fees.memberSellerRate, fixed: fees.memberSellerFixed } : null}
          communityName={community?.name || t("community")}
          locked={state === "ACTIVE"}
          onCounter={canCounter ? (r) => void counterToRate(r) : undefined}
          counterLabel={t("counterOpen")}
          t={t}
        />
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 px-1">
          <Meta label={t("package")} value={packageName ?? (listing.packageId ? t("packageUnnamed") : t("packageNone"))} />
          {listing.createdAt && <Meta label={t("requested")} value={formatDate(listing.createdAt)} />}
          {listing.rejectionReason && <Meta label={t("communityNote")} value={listing.rejectionReason} />}
        </dl>
        {/*
          * A free event still asks for a cut, which reads as a contradiction
          * until you know the cut is for LATER: a rate set now applies to any
          * paid tickets added to this event down the line. Said here, next to
          * the rate, so nobody has to guess why a price of zero has a commission.
          */}
        {heroIsFree && (
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-[var(--ink-3)]">{t("cutFreeNote")}</p>
        )}
      </div>

        </div>

        {/*
          * The picker lives WHERE IT IS OPENED FROM.
          *
          * It used to sit inside the thread card. When the thread moved behind
          * the History tab it went with it, so typing an unpublished rate on
          * Terms opened a form rendered on a tab you were not looking at --
          * the counter silently did nothing. A control and the thing that
          * summons it belong on the same screen.
          *
          * Opened FROM THE SPINE and not from the thread.
          *
          * Both offered "Propose different terms" for a moment, which is the
          * same act twice on one page — and the spine is where the money is,
          * so it is the honest entry point. This is the form that opens when
          * the number typed there is not one of the community's published
          * rates.
          */}
        {canCounter && composing && (
          <div className="px-6 py-4 border-t border-zinc-100">
            {(
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">{t("counterTitle")}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{t("counterSubtitle")}</p>

                {offered.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {offered.map((pkg) => (
                      <label
                        key={pkg.id}
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          pickedPackage === pkg.id
                            ? "border-zinc-400 bg-zinc-50"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="counter-package"
                          className="mt-0.5 cursor-pointer"
                          checked={pickedPackage === pkg.id}
                          onChange={() => setPickedPackage(pkg.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-medium text-zinc-900">{pkg.name}</span>
                            <span className="shrink-0 text-[13px] font-semibold text-zinc-900 tabular-nums">{pkg.rate}%</span>
                          </span>
                          {pkg.description && (
                            <span className="mt-0.5 block text-[12px] text-zinc-500">{pkg.description}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  /* No packages to pick means nothing to propose: the rate is
                     the community's to set, and a note alone is not an offer. */
                  <p className="mt-3 text-[12.5px] text-zinc-500">{t("counterNoPackages")}</p>
                )}

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={t("counterNotePlaceholder")}
                  className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={sendProposal}
                    disabled={!pickedPackage || posting}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
                  >
                    {posting ? t("counterSending") : t("counterSend")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    className="px-3 py-2 text-[13px] text-zinc-500 hover:text-zinc-800 cursor-pointer"
                  >
                    {t("counterCancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </>

        <div className="min-w-0">

      {/*
        * ── Topics come first, History second ──────────────────────────────
        *
        * Topics are the live conversation -- the part of the review someone acts
        * on, raises, and works through. History is the change log: every rate
        * either side formally put forward, read once and argued over rarely, and
        * empty on the common listing that was accepted as asked. So the thing
        * with the work in it leads, and the record sits beneath it.
        *
        * Two feeds rather than one. A proposal and a topic close differently --
        * one is accepted by the other side, the other only when BOTH agree --
        * and interleaving them would put two different meanings of "done" in one
        * column.
        */}
      <div className="mb-6">
        <div className="mb-3 px-1">
          <h2 className="text-[14px] font-semibold text-[var(--ink)]">{t("topicsTitle")}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{t("topicsSubtitle")}</p>
        </div>
        <Topics
          topics={topics}
          viewer={viewer}
          otherPartyName={viewer === "owner" ? (community?.name || t("community")) : (listing.requestedBy?.name || t("someone"))}
          currentUser={currentUser}
          busy={busy}
          onOpen={openTopic}
          onComment={commentOnTopic}
          onToggleDone={toggleTopicDone}
          t={t}
        />
      </div>

      {/*
        * HISTORY: the change log, under the conversation.
        *
        * A record, not a task. Read once, argued over rarely, and empty on the
        * common listing that was accepted as asked -- where it had been a full
        * card holding one grey sentence in the middle of the page. The counter
        * form that writes new entries into it is opened from the cut spine above,
        * next to the money, not from here.
        */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-[14px] font-semibold text-zinc-900">{t("threadTitle")}</h2>
          <p className="text-[12px] text-zinc-500 mt-0.5">{t("threadSubtitle")}</p>
        </div>
        {proposals.length > 0 ? (
          <ul>
            {proposals.map((p) => {
              const who = p.proposedBy?.name || p.proposedByUser?.name || t("someone");
              const pRate = toRate(p.commissionRate);
              return (
                <li key={p.id} className="px-6 py-4 border-b border-zinc-100 last:border-none">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-medium text-zinc-900">
                      {p.package?.name
                        ? t("proposedPackage", { who, name: p.package.name, rate: pRate ?? 0 })
                        : t("proposedRate", { who, rate: pRate ?? 0 })}
                    </p>
                    {p.createdAt && <span className="shrink-0 text-[11px] text-zinc-400">{formatDate(p.createdAt)}</span>}
                  </div>
                  {p.message && <p className="text-[13px] text-zinc-600 mt-1 whitespace-pre-wrap">{p.message}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          /*
            An empty thread means two different things and the difference is the
            whole point of the page while in review. "Nothing proposed yet" on a
            listing awaiting an answer reads as if the request never left; what
            is true is that it landed and nobody has replied.
          */
          <p className="px-6 py-8 text-center text-[13px] text-zinc-400">
            {waiting ? t("threadEmptyWaiting") : t("threadEmpty")}
          </p>
        )}
      </div>

        </div>
      </div>

      {/*
        * THE ACTIONS, PINNED TO THE BOTTOM.
        *
        * They used to sit at the end of the document, which on a listing with a
        * long thread meant scrolling past everything to reach the one control
        * you opened the page for. Sticky keeps them in reach from either tab,
        * and they belong to the LISTING rather than to a tab -- taking it down
        * is the same act whichever half you are reading.
        *
        * It renders nothing at all when there is nothing to do: a closed
        * listing yields an empty action list, and an empty sticky bar is a
        * permanent grey stripe advertising a capability this listing lacks.
        */}
      {(actions.length > 0 || reviewActions.length > 0) && (
        <>
        {/*
          * FIXED, NOT STICKY, and this is the third attempt at it.
          *
          * Sticky is bounded by its PARENT's box. This bar is the last child of
          * the panel, so its parent ends where it does and there is nothing to
          * stick within -- it sat at the end of the document, scrolled away
          * with the content, and left the page's own bottom padding showing
          * underneath. Negative margins only pulled it out by the PANEL's
          * padding, never the page's, so it was never full width either.
          *
          * Fixed to the viewport removes both. The one thing fixed cannot know
          * is where the content area starts, because the host owns the sidebar
          * -- so the host says, through --manage-actions-left, and a page with
          * no sidebar gets the 0px default and full width for free.
          */}
        <div
          className="fixed right-0 z-30 flex flex-col-reverse gap-2 border-t border-[var(--line)] bg-[var(--card)] px-4 pb-3 pt-3 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6"
          /*
            * BOTH insets come from the host, because fixed positioning cannot
            * discover either. Left clears a sidebar; bottom clears a mobile
            * nav bar, which the community app pins at the same edge -- without
            * it the two stack and the primary action lands under the tab bar.
            * Defaults of 0 mean a host with neither gets a full-width bar
            * flush to the window and does not have to know this exists.
            */
          style={{
            left: "var(--manage-actions-left, 0px)",
            bottom: "var(--manage-actions-bottom, 0px)",
            paddingBottom: "max(0.75rem, var(--manage-actions-safe, env(safe-area-inset-bottom)))",
          }}
        >
        {/*
        The levers, straight from the machine.

        A closed listing yields an empty list and so renders no row at all:
        there is nothing to pause and nothing to withdraw, and the way back is a
        fresh request from the Listings tab, which is where that control already
        lives. A disabled row of levers would only advertise a capability this
        listing cannot have.
      */}
      {/*
        A leader's controls. Approve puts it on the shelf; decline and revoke
        both land on REVOKED, which is a DIFFERENT state from the seller's
        withdrawal on purpose — one is "we said no", the other is "I took it
        back", and a row that confuses them lies about who decided.
      */}
      {reviewActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reviewActions.map((action) => {
            if (action === "approve") {
              /*
               * The button names the number it commits to. "Approve & publish"
               * said nothing about the cut being agreed, so the leader confirmed
               * a rate that lived only in the spine above; "Approve at 10%" puts
               * the decision in the control that makes it. Falls back to the
               * plain label when no rate is set yet (a free event, or terms not
               * agreed) -- there is no number to name.
               */
              const approveLabel = rate != null ? t("approveAtRate", { rate }) : t("approve");
              return (
                <button key={action} type="button" onClick={() => setPending({
                    to: "ACTIVE",
                    title: t("confirmApproveTitle"),
                    body: t("confirmApproveBody", { community: community?.name || t("community") }),
                    confirm: approveLabel,
                  })} disabled={busy}
                  className="px-4 py-2.5 text-[13px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-40">
                  {approveLabel}
                </button>
              );
            }
            return (
              <button key={action} type="button" onClick={() => setPending({
                  to: "REVOKED",
                  title: t("confirmRevokeTitle"),
                  body: t("confirmRevokeBody"),
                  confirm: t("revoke"),
                  danger: true,
                })} disabled={busy}
                className="px-4 py-2.5 text-[13px] font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer disabled:opacity-40">
                {action === "decline" ? t("decline") : t("revoke")}
              </button>
            );
          })}
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            if (action === "pause") {
              return (
                <button key={action} type="button" onClick={() => setPending({
                    to: "PAUSED",
                    title: t("confirmPauseTitle"),
                    body: t("confirmPauseBody"),
                    confirm: t("pause"),
                  })} disabled={busy}
                  className="px-4 py-2.5 text-[13px] font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 cursor-pointer disabled:opacity-40">
                  {t("pause")}
                </button>
              );
            }
            if (action === "resume") {
              return (
                <button key={action} type="button" onClick={() => setPending({
                    to: "ACTIVE",
                    title: t("confirmResumeTitle"),
                    body: t("confirmResumeBody"),
                    confirm: t("resume"),
                  })} disabled={busy}
                  className="px-4 py-2.5 text-[13px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-40">
                  {t("resume")}
                </button>
              );
            }
            return (
              <button key={action} type="button" onClick={() => setConfirmWithdraw(true)} disabled={busy}
                className="px-4 py-2.5 text-[13px] font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer disabled:opacity-40">
                {/* In review there is no shelf yet, so what is withdrawn is the ASK. */}
                {waiting ? t("withdrawRequest") : t("withdraw")}
              </button>
            );
          })}
        </div>
      )}
        </div>
        {/* Fixed elements take no space in the flow; this is the space. */}
        <div aria-hidden="true" className="h-24" />
        </>
      )}

      {/*
        A closed listing says who closed it and where asking again starts.

        Without this the page just loses its buttons, which reads as broken
        rather than final. The link is the Listings tab because "Request a
        listing" lives there; it is a real destination, not a disabled control.
      */}
      {closed && (
        <div className="rounded-2xl bg-zinc-50 px-6 py-5">
          <p className="text-[13px] text-zinc-600">
            {state === "REVOKED"
              ? t("closedRevoked", { community: community?.name || t("community") })
              : t("closedWithdrawn", { community: community?.name || t("community") })}
          </p>
          <Link href={backHref} className="mt-2 inline-block text-[13px] font-medium text-zinc-900 hover:underline cursor-pointer">
            {t("askAgain")}
          </Link>
        </div>
      )}


      {pending && (
        <ConfirmAction
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirm}
          danger={pending.danger}
          busy={busy}
          onConfirm={async () => { const to = pending.to; setPending(null); await move(to); }}
          onClose={() => setPending(null)}
          t={t}
        />
      )}

      {confirmWithdraw && (
        <ConfirmWithdraw
          pending={state === "PENDING"}
          community={community?.name || t("community")}
          busy={busy}
          onConfirm={() => move("CANCELLED")}
          onClose={() => setConfirmWithdraw(false)}
          t={t}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="text-[13px] text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-[13px] text-zinc-900 text-right">{value}</dd>
    </div>
  );
}

function ConfirmWithdraw({
  pending,
  community,
  busy,
  onConfirm,
  onClose,
  t,
}: {
  pending: boolean;
  community: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /* Passed down rather than resolved here: one `t` per render tree, so the
     sheet cannot end up speaking a different language from the page. */
  t: (key: string, vars?: Record<string, unknown>) => string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] md:w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-[15px] font-semibold text-zinc-900">
            {pending ? t("confirmWithdrawRequestTitle") : t("confirmWithdrawTitle")}
          </h3>
          <p className="text-[13px] text-zinc-500 mt-2">
            {pending ? t("confirmWithdrawRequestBody", { community }) : t("confirmWithdrawBody", { community })}
          </p>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 space-y-2">
          <button type="button" onClick={onConfirm} disabled={busy}
            className="w-full px-4 py-2.5 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer disabled:opacity-40">
            {pending ? t("withdrawRequest") : t("withdraw")}
          </button>
          {/* Close at the bottom, under the action it steps away from. */}
          <button type="button" onClick={onClose} disabled={busy}
            className="w-full px-4 py-2.5 text-[13px] font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 cursor-pointer disabled:opacity-40">
            {t("close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The hero price, for an event whose DTO carries a MAJOR-unit `price`.
 *
 * Only the event read is passed here; a product's price is in cents and is left
 * off the hero rather than shown in the wrong unit. Falls back to a plain
 * "CUR amount" string if the runtime cannot format the currency, so a bad or
 * missing currency code never throws the whole page.
 */
function formatMoney(amount: number, currency?: string | null): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(amount);
  } catch {
    return `${currency || "EUR"} ${amount}`;
  }
}


/**
 * One fact ABOUT the deal, beside the others.
 *
 * The package name and the request date used to be rows in a table alongside
 * the commission, which gave all three the same weight. The commission is the
 * thing being agreed; these describe it. Same information, correct hierarchy.
 */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--ink-3)]">{label}</dt>
      <dd className="m-0 text-[13px] text-[var(--ink-2)]">{value}</dd>
    </div>
  );
}

/**
 * One confirmation, for every act that is hard to take back.
 *
 * It states WHAT HAPPENS rather than asking whether you are sure. A dialog that
 * only repeats its button teaches people to click through it, and then the one
 * that actually matters gets the same reflex.
 */
function ConfirmAction({
  title, body, confirmLabel, danger, busy, onConfirm, onClose, t,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/*
        * Bottom sheet on a phone, centred card above it. A centred dialog on a
        * small screen puts the confirm button under the thumb's reach and the
        * cancel above it, which is the wrong way round for the one that undoes.
        */}
      <div
        className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:w-[420px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{body}</p>
        </div>
        <div className="space-y-2 border-t border-zinc-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`w-full cursor-pointer rounded-lg px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40 ${
              danger ? "bg-red-600 text-white hover:bg-red-700" : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {confirmLabel}
          </button>
          {/*
            * Close at the BOTTOM, and muted. The way out should not compete
            * with the act you came to perform.
            */}
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-lg bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-200"
          >
            {t("counterCancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
