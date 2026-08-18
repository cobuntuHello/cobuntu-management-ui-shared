"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { defaultTranslate } from "./copy";
import { DealSpine } from "./ui/DealSpine";
import { NextAction } from "./ui/NextAction";
import { Topics, type Topic } from "./ui/Topics";
import { listingTokenStyle } from "./ui/tokens";
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
}

export function ManagedListingDetail({
  kind, listingId, backHref, itemName, breadcrumbs, appendCommunityCrumb,
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
    <div style={listingTokenStyle(brand ? { "--commit": brand } : undefined)} className="text-[var(--ink)]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-400 mb-4">
        {((breadcrumbs
          ? [...breadcrumbs, ...(appendCommunityCrumb ? [{ label: community?.name || t("community") }] : [])]
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

      <div className="flex items-center gap-3 mb-6">
        {community?.iconUrl ? (
          <img src={community.iconUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-[15px] font-semibold text-zinc-500 shrink-0">
            {community?.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 truncate">{community?.name || t("community")}</h1>
          {itemName && <p className="text-[13px] text-zinc-500 truncate">{itemName}</p>}
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
        * ── Two columns on a wide screen, one on a narrow one ───────────────
        *
        * MOBILE FIRST: the default is a single stack, and the split only
        * appears at lg. That order matters — written the other way round, the
        * phone gets a desktop grid squeezed into 380px, which is how the terms
        * end up three words wide.
        *
        * The terms go LEFT and stick, because they are what the conversation
        * on the right is about: scrolling a long thread should not take the
        * number being argued over off the screen. The MVP's own proportions —
        * a fixed 360px column beside a flexible one — because the terms are a
        * known size and the feed is not.
        */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[88px]">
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
      </div>

        </div>

        <div className="min-w-0">
      {/* Thread */}
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

        {/*
          * Countering lives INSIDE the thread, at the end of it.
          *
          * It is the next entry in a conversation, not a separate settings
          * panel — and putting it here means the offer someone is replying to
          * is still on screen while they choose.
          *
          * Only while the listing is open to it: there is nothing to negotiate
          * on a cancelled or revoked one, and an accepted arrangement is
          * changed by asking again rather than by editing history.
          */}
        {/*
          * The picker, opened FROM THE SPINE and not from here.
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
      </div>

      {/*
        * ── Topics, under the rate thread ──────────────────────────────────
        *
        * Two feeds rather than one, and the order is the argument: the rate is
        * a single number with an Accept, so it stays a compact list at the top;
        * everything else is a conversation and gets the room a conversation
        * needs.
        *
        * Merging them was considered and rejected. A proposal and a topic close
        * differently — one is accepted by the other side, the other only when
        * BOTH agree — and interleaving them would put two different meanings of
        * "done" in one column.
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
          busy={busy}
          onOpen={openTopic}
          onComment={commentOnTopic}
          onToggleDone={toggleTopicDone}
          t={t}
        />
      </div>

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
              return (
                <button key={action} type="button" onClick={() => move("ACTIVE")} disabled={busy}
                  className="px-4 py-2.5 text-[13px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-40">
                  {t("approve")}
                </button>
              );
            }
            return (
              <button key={action} type="button" onClick={() => move("REVOKED")} disabled={busy}
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
                <button key={action} type="button" onClick={() => move("PAUSED")} disabled={busy}
                  className="px-4 py-2.5 text-[13px] font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 cursor-pointer disabled:opacity-40">
                  {t("pause")}
                </button>
              );
            }
            if (action === "resume") {
              return (
                <button key={action} type="button" onClick={() => move("ACTIVE")} disabled={busy}
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
      </div>

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
