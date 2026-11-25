/**
 * How the listing page v2 talks to the backend, given to it by its host.
 *
 * ── Why a transport and not a base URL ─────────────────────────────────────
 *
 * The page lives in three homes (docs/features/listing-page-v2.md):
 *   - Cobuntu's admin (the community's seat), Bearer token, core REST;
 *   - Cobuntu's community app (the seller's seat), session cookie, core REST;
 *   - a venue's own site (tejahouse.com, the seller's seat), where the browser
 *     never talks to Cobuntu: every call goes through the site's server, over
 *     v1, with the site's key.
 * The old panel fetched `${apiBaseUrl}/api/...` directly, which only the first
 * two can do. The event wizard solved the same problem with a transport
 * (EventCreateWizardTransport); this is the same idea. `restTransport` below
 * covers both Cobuntu apps; a venue site writes its own against its relay.
 *
 * Booking methods are optional: a listing with no venue booking never calls
 * them, and a host that cannot offer an action leaves it out (the page then
 * does not draw the button).
 */
import type {
    BookingAddons, BookingView, ListingDetail, ListingKind, ListingMoney, Package, Proposal, Seat, Topic,
} from "./types";

export interface DateOptions {
    room: { id: string; name: string };
    durations: number[];
    minimumHours: number;
    slots: Array<{ at: number; label: string; blocked: string | null }>;
}

export interface DateQuote {
    room: { id: string; name: string };
    member: boolean;
    totalCents: number;
    vatCents: number;
    paidCents: number;
    secondPaymentCents: number;
    secondChargeDueAt: string | null;
    slot: { start: string; end: string };
}

export interface ListingTransport {
    // ── reads ──
    listing(): Promise<ListingDetail>;
    proposals(): Promise<Proposal[]>;
    topics(): Promise<Topic[]>;
    /**
     * The money from this seat. `packageId` previews that package's split
     * before anyone agrees it (the package sheet); a host that cannot answer
     * it returns the listing's own terms, and `previewPackage` says which.
     */
    money(opts?: { packageId?: string; rate?: number }): Promise<ListingMoney | null>;
    packages(): Promise<Package[]>;

    // ── the listing ──
    setStatus(to: "ACTIVE" | "PAUSED" | "CANCELLED" | "REVOKED", reason?: string): Promise<void>;
    /** The community takes a live listing off its shelf without ending it. */
    setHidden?(hidden: boolean): Promise<void>;
    /** A package, or (the community only) a typed rate for this one listing (T-414). */
    propose(input: { packageId?: string; commissionRate?: number; message?: string }): Promise<void>;
    respond(proposalId: string, response: "ACCEPTED" | "REJECTED"): Promise<void>;
    /**
     * The seller moves their own listing onto another package their tier is
     * offered (T-415). A live listing goes back to the community's review;
     * `status` is where it lands. Optional: a host without it shows no
     * Change package.
     */
    switchPackage?(packageId: string): Promise<{ status: string; sentBackToReview: boolean } | null>;

    // ── the talk ──
    openTopic(input: { subject: string; body: string }): Promise<void>;
    comment(topicId: string, body: string): Promise<void>;
    setTopicDone(topicId: string, done: boolean): Promise<void>;

    // ── a venue booking (events only; each optional) ──
    booking?(eventId: string): Promise<BookingView | null>;
    addons?(eventId: string): Promise<BookingAddons | null>;
    /** Community: accept or decline (and refund) the booking. */
    decideBooking?(eventId: string, decision: "ACCEPT" | "DECLINE", reason?: string): Promise<void>;
    /** Community: answer an add-on request. */
    decideAddon?(eventId: string, selectionId: string, input: { decision: "APPROVE" | "DECLINE" | "PROPOSE_PRICE"; priceCents?: number; reason?: string }): Promise<void>;
    /** Seller: accept the community's price for an add-on. */
    confirmAddonPrice?(eventId: string, selectionId: string): Promise<void>;
    /** Seller: drop an add-on request. */
    cancelAddon?(eventId: string, selectionId: string): Promise<void>;
    setGuests?(eventId: string, guestCount: number): Promise<void>;
    setDetails?(eventId: string, details: { logistics?: Record<string, unknown>; marketing?: Record<string, unknown> }): Promise<void>;
    dateOptions?(eventId: string, date: string, hours: number): Promise<DateOptions>;
    dateQuote?(eventId: string, input: { date: string; start: number; hours: number }): Promise<DateQuote>;
    changeDate?(eventId: string, input: { date: string; start: number; hours: number }): Promise<void>;
    /**
     * Seller: a new card. With `embedded` the answer is Stripe's form for a sheet
     * (`clientSecret`); otherwise Stripe's own page (`checkoutUrl`).
     */
    startCardChange?(eventId: string, input: { returnUrl: string; embedded: boolean }): Promise<{ clientSecret?: string; checkoutUrl?: string }>;
}

/** A refusal the page can show: the server's own sentence and its stable code. */
export class TransportError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
}

export interface RestTransportConfig {
    kind: ListingKind;
    listingId: string;
    seat: Seat;
    /** Absolute API origin; empty for same-origin (the community app). */
    apiBaseUrl?: string;
    /** Merged into every request (Bearer for the admin). */
    authHeaders?: Record<string, string>;
    /** The community's tag, for the community's booking routes. */
    communityTag?: string;
}

/** Cobuntu's own REST API, for the admin and the community app. */
export function restTransport(cfg: RestTransportConfig): ListingTransport {
    const api = cfg.apiBaseUrl ?? "";
    const base = cfg.kind === "event" ? `${api}/api/event-listings` : `${api}/api/listings`;
    const topicBase = cfg.kind === "event" ? `${api}/api/event-listing-topics` : `${api}/api/listing-topics`;
    const id = encodeURIComponent(cfg.listingId);
    const tag = () => encodeURIComponent(cfg.communityTag ?? "");
    const mine = (eventId: string) => `${api}/api/me/events/${encodeURIComponent(eventId)}/booking`;
    const team = (eventId: string) => `${api}/api/communities/${tag()}/events/${encodeURIComponent(eventId)}/booking`;

    async function call<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
        const res = await fetch(url, {
            method: init.method ?? "GET",
            credentials: "include",
            headers: { ...(cfg.authHeaders ?? {}), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const text = await res.text().catch(() => "");
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        if (!res.ok) throw new TransportError(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`, res.status, data?.code);
        return data as T;
    }
    const maybe = async <T>(p: Promise<T>): Promise<T | null> => {
        try { return await p; } catch (e) { if (e instanceof TransportError && e.status === 404) return null; throw e; }
    };

    return {
        listing: () => call(`${base}/${id}`),
        proposals: async () => {
            const d = await call<any>(`${base}/${id}/proposals`);
            return Array.isArray(d) ? d : d?.proposals ?? [];
        },
        topics: async () => (await call<{ topics?: Topic[] }>(`${base}/${id}/topics`))?.topics ?? [],
        money: (opts) => maybe(call<ListingMoney>(`${base}/${id}/money?seat=${cfg.seat}${opts?.packageId ? `&packageId=${encodeURIComponent(opts.packageId)}` : ""}${opts?.rate != null ? `&rate=${encodeURIComponent(String(opts.rate))}` : ""}`)),
        packages: async () => (await call<{ packages?: Package[] }>(`${base}/${id}/packages`))?.packages ?? [],

        setStatus: async (to, reason) => { await call(`${base}/${id}/status`, { method: "PATCH", body: reason ? { status: to, reason } : { status: to } }); },
        setHidden: async (hidden) => { await call(`${base}/${id}/visibility`, { method: "PATCH", body: { isHidden: hidden } }); },
        propose: async (input) => { await call(`${base}/${id}/proposals`, { method: "POST", body: input }); },
        switchPackage: (packageId) => call<{ status: string; sentBackToReview: boolean }>(`${base}/${id}/package`, { method: "POST", body: { packageId } }),
        respond: async (proposalId, response) => { await call(`${base}/proposals/${encodeURIComponent(proposalId)}/respond`, { method: "POST", body: { response } }); },

        openTopic: async (input) => { await call(`${base}/${id}/topics`, { method: "POST", body: input }); },
        comment: async (topicId, body) => { await call(`${topicBase}/${encodeURIComponent(topicId)}/comments`, { method: "POST", body: { body } }); },
        setTopicDone: async (topicId, done) => { await call(`${topicBase}/${encodeURIComponent(topicId)}/done`, { method: "PUT", body: { done } }); },

        ...(cfg.kind === "event" && cfg.seat === "seller"
            ? {
                booking: async (eventId: string) => (await maybe(call<{ booking: BookingView }>(mine(eventId))))?.booking ?? null,
                addons: (eventId: string) => maybe(call<BookingAddons>(`${mine(eventId)}/addons`)),
                confirmAddonPrice: async (eventId: string, sel: string) => { await call(`${mine(eventId)}/addons/${encodeURIComponent(sel)}/confirm-price`, { method: "POST", body: {} }); },
                cancelAddon: async (eventId: string, sel: string) => { await call(`${mine(eventId)}/addons/${encodeURIComponent(sel)}/cancel`, { method: "POST", body: {} }); },
                setGuests: async (eventId: string, guestCount: number) => { await call(`${mine(eventId)}/guests`, { method: "PUT", body: { guestCount } }); },
                setDetails: async (eventId: string, details: any) => { await call(`${mine(eventId)}/details`, { method: "PUT", body: details }); },
                dateOptions: (eventId: string, date: string, hours: number) =>
                    call<DateOptions>(`${mine(eventId)}/date/options?date=${encodeURIComponent(date)}&hours=${encodeURIComponent(String(hours))}`),
                dateQuote: (eventId: string, input: { date: string; start: number; hours: number }) => call<DateQuote>(`${mine(eventId)}/date/quote`, { method: "POST", body: input }),
                changeDate: async (eventId: string, input: { date: string; start: number; hours: number }) => { await call(`${mine(eventId)}/date`, { method: "POST", body: input }); },
                startCardChange: (eventId: string, input: { returnUrl: string; embedded: boolean }) =>
                    call<{ clientSecret?: string; checkoutUrl?: string }>(`${mine(eventId)}/card`, {
                        method: "POST",
                        body: input.embedded ? { uiMode: "embedded", returnUrl: input.returnUrl } : { successUrl: input.returnUrl, cancelUrl: input.returnUrl },
                    }),
            }
            : {}),
        ...(cfg.kind === "event" && cfg.seat === "community" && cfg.communityTag
            ? {
                booking: async (eventId: string) => (await maybe(call<{ booking: BookingView }>(team(eventId))))?.booking ?? null,
                addons: (eventId: string) => maybe(call<BookingAddons>(`${team(eventId)}/addons`)),
                decideBooking: async (eventId: string, decision: "ACCEPT" | "DECLINE", reason?: string) => { await call(`${team(eventId)}/decision`, { method: "POST", body: { decision, reason } }); },
                decideAddon: async (eventId: string, sel: string, input: any) => { await call(`${team(eventId)}/addons/${encodeURIComponent(sel)}/decision`, { method: "POST", body: input }); },
            }
            : {}),
    };
}
