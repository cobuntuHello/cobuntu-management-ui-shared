import type { PersonSearchResult } from './searchPeople';

/**
 * Somebody you are about to do something to.
 *
 * ── Why this is not just PersonSearchResult ─────────────────────────
 *
 * An invitation has to reach people who have no account — that is most of what
 * inviting is for — so a recipient is EITHER a user with an id OR a bare email
 * address. Modelling it as "a user, optionally without an id" was the shape the
 * events modals already used, and it is right: the two are the same act with
 * different amounts known about the target.
 *
 * ── The key is identity, not position ───────────────────────────────
 *
 * `recipientKey` is what stops the same person being staged twice when they
 * arrive from two places at once — picked from the roster AND pasted in a CSV,
 * which is exactly what happens when somebody imports a list they have already
 * half worked through.
 *
 * It prefers the USER ID when there is one. Deduping on email alone is the bug
 * the events "Recently invited" row still shows: one person invited under two
 * addresses renders as two chips with the same name.
 */

export interface Recipient {
    /** Present when they are a real user. Absent for an address with no account. */
    id?: string;
    /** Present for an address that was typed or imported, and for members too. */
    email?: string;
    name?: string | null;
    usertag?: string | null;
    profileImage?: string | null;
    /** Their own note, when the surface offers per-recipient personalisation. */
    note?: string;
    /**
     * Which tier's capacity this person consumes.
     *
     * Set on surfaces that ADD somebody — a seat belongs to a ticket tier, not
     * to the event. Absent when inviting: an invitation is to the item itself
     * and the invitee picks a tier at checkout.
     */
    tierId?: string;
}

/** Stable identity. User id wins; an address is the fallback. */
export function recipientKey(r: Recipient): string {
    if (r.id) return `u:${r.id}`;
    return `e:${String(r.email ?? '').trim().toLowerCase()}`;
}

export function fromPerson(p: PersonSearchResult): Recipient {
    return { id: p.id, name: p.name, usertag: p.usertag, profileImage: p.profileImage };
}

/**
 * Deliberately permissive.
 *
 * This decides whether to OFFER an address as a recipient, not whether it can
 * receive mail — the server does that, and it is the only thing that can. A
 * strict regex here rejects valid addresses (plus-tags, long TLDs, unicode
 * locals) and the person simply cannot invite their colleague.
 */
export function looksLikeEmail(value: string): boolean {
    const v = value.trim();
    return v.length >= 3 && v.includes('@') && !v.startsWith('@') && !v.endsWith('@') && !/\s/.test(v);
}

/**
 * Addresses out of a pasted or uploaded CSV.
 *
 * FIRST COLUMN ONLY, matching what the events modal already did: exports from every
 * mailing tool put the address first, and guessing which of six columns is the
 * email is how you silently import a column of first names.
 *
 * A header row is skipped when its first cell is not itself an address, so
 * "email,name" does not become a recipient called "email".
 */
export function parseCsvEmails(text: string): string[] {
    const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const cells = rows
        .map((r) => (r.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const cell of cells) {
        if (!looksLikeEmail(cell)) continue;   // drops the header, and junk rows
        const key = cell.toLowerCase();
        if (seen.has(key)) continue;           // a list pasted twice is one invite
        seen.add(key);
        out.push(cell);
    }
    return out;
}

/**
 * Add without creating a duplicate.
 *
 * Returns a NEW array — callers hold this in React state, and mutating it in
 * place is a render that does not happen.
 */
export function addRecipients(current: Recipient[], incoming: Recipient[]): Recipient[] {
    const have = new Set(current.map(recipientKey));
    const out = [...current];
    for (const r of incoming) {
        const key = recipientKey(r);
        if (have.has(key)) continue;
        have.add(key);
        out.push(r);
    }
    return out;
}

/**
 * The two halves a send endpoint wants.
 *
 * Every invite API in this codebase takes users and addresses as SEPARATE
 * arrays, because they are looked up differently server-side. Splitting at the
 * call site is three lines of filter-and-map that each caller gets subtly
 * wrong — the product one shipped `usertag` into a field that read `userId`.
 */
export function userIdsOf(recipients: Recipient[]): string[] {
    return recipients.map((r) => r.id).filter((id): id is string => Boolean(id));
}

/** Addresses for the people who have no account. Never a member's own address:
    they are already identified by id, and sending both invites them twice. */
export function emailsOf(recipients: Recipient[]): string[] {
    return recipients
        .filter((r) => !r.id)
        .map((r) => (r.email ?? '').trim())
        .filter(Boolean);
}

/**
 * The same two halves, for the endpoints keyed by HANDLE rather than id.
 *
 * `POST /events/:id/add-attendees`, `POST /events/:id/invitations` and
 * `POST /products/:id/invitations` all take `usertags` and `emails`. Splitting
 * on the user id there puts a member in `emails`, where they are treated as
 * somebody with no account.
 *
 * Order matters as much as it does above: a member whose address we happen to
 * know goes in `usertags` ONLY. In both arrays they are one person, two
 * invitation rows and two emails.
 */
export function recipientsToApi(recipients: Recipient[]): {
    usertags: string[];
    emails: string[];
} {
    const usertags: string[] = [];
    const emails: string[] = [];
    for (const r of recipients) {
        if (r.usertag) usertags.push(r.usertag);
        else if (r.email?.trim()) emails.push(r.email.trim());
        /* Neither: an account with no handle and no address. Nothing the
           endpoint could look them up by, so they are dropped rather than sent
           as an empty string the server would 400 the whole batch on. */
    }
    return { usertags, emails };
}

/**
 * The per-recipient overrides, in the shape the invite services read.
 *
 * The server picks the override when one is present and falls back to the
 * shared `customMessage` otherwise, so only people who actually wrote their own
 * note belong here. Sending an empty override REPLACES their shared note with
 * nothing.
 */
export function perRecipientMessages(
    recipients: Recipient[],
): Array<{ usertag?: string; email?: string; message: string }> {
    const out: Array<{ usertag?: string; email?: string; message: string }> = [];
    for (const r of recipients) {
        const message = r.note?.trim();
        if (!message) continue;
        if (r.usertag) out.push({ usertag: r.usertag, message });
        else if (r.email?.trim()) out.push({ email: r.email.trim(), message });
    }
    return out;
}

/**
 * Suggestion rows, minus whoever is already staged.
 *
 * Deduped ACROSS rows as well as within them: somebody can be both "recently
 * invited" and a "frequent attendee", and offering them twice on one screen is
 * how you get the four identical chips that the events invite modal shows
 * today.
 */
export function visibleSuggestions(
    rows: Array<{ label: string; people: PersonSearchResult[] }>,
    staged: Recipient[],
): Array<{ label: string; people: PersonSearchResult[] }> {
    const taken = new Set(staged.map(recipientKey));
    const out: Array<{ label: string; people: PersonSearchResult[] }> = [];
    for (const row of rows) {
        const people: PersonSearchResult[] = [];
        for (const p of row.people) {
            const key = recipientKey(fromPerson(p));
            if (taken.has(key)) continue;
            taken.add(key);
            people.push(p);
        }
        if (people.length > 0) out.push({ label: row.label, people });
    }
    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tiers: which shelf each person comes off.
 *
 * Adding somebody consumes a specific tier's capacity, so adding takes a tier.
 * Inviting does not — an invitation is to the event or product itself, and the
 * invitee picks a tier at checkout.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TierOption {
    id: string;
    name: string;
    /** null = uncapped. */
    remaining: number | null;
    soldOut: boolean;
}

/** Why a row cannot be imported as written. */
export type ImportProblem =
    /** The CSV named a tier that does not exist on this item. */
    | 'unknown-tier'
    /** No tier named, and no default chosen. */
    | 'no-tier'
    /** The named tier has no room left for this row. */
    | 'tier-full';

export interface ImportPlanRow {
    email: string;
    tierId: string | null;
    tierName: string | null;
    problem: ImportProblem | null;
}

export interface ImportPlan {
    rows: ImportPlanRow[];
    ok: ImportPlanRow[];
    problems: ImportPlanRow[];
    /** What this import does to each tier, so the preview can show the damage. */
    perTier: Array<{
        tierId: string;
        name: string;
        adding: number;
        remaining: number | null;
        /** How many more than there is room for. 0 when it fits. */
        overBy: number;
    }>;
}

/**
 * Rows out of a CSV that names a tier per person.
 *
 * Column one is the address, column two the tier name. First column only was
 * the old rule and it stays the rule for the address, because exports from
 * every mailing tool put it first and guessing which of six columns holds the
 * email is how you import a column of first names.
 *
 * A header row is skipped when its first cell is not an address, so
 * "email,tier" does not become a recipient called "email".
 */
export function parseCsvRecipientRows(text: string): Array<{ email: string; tierName: string | null }> {
    const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '');
    const out: Array<{ email: string; tierName: string | null }> = [];
    const seen = new Set<string>();

    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const cells = line.split(',');
        const email = clean(cells[0]);
        if (!looksLikeEmail(email)) continue;   // drops the header, and junk
        const key = email.toLowerCase();
        if (seen.has(key)) continue;            // a list pasted twice is one add
        seen.add(key);
        out.push({ email, tierName: clean(cells[1]) || null });
    }
    return out;
}

/** A tier by name, case- and space-insensitively. Exact match only. */
export function matchTier(name: string | null, tiers: TierOption[]): TierOption | null {
    if (!name) return null;
    const want = name.trim().toLowerCase();
    // Deliberately not fuzzy. Guessing that "VIP " meant "VIP Plus" would
    // seat somebody on the wrong shelf, and this is the one place where being
    // wrong is silent — the row looks imported either way.
    return tiers.find((t) => t.name.trim().toLowerCase() === want) ?? null;
}

/**
 * What this import would actually do, before it does it.
 *
 * ── Why a plan instead of just importing ────────────────────────────────────
 *
 * Adding consumes capacity, so a half-finished import leaves the host
 * reconciling two lists: who got in, who did not, and how much room is left.
 * The plan lets them see the whole outcome — including which tiers would fill
 * and which rows name a tier that does not exist — and decide once.
 *
 * ── Overflow is per row, not per file ───────────────────────────────────────
 *
 * A tier with three seats left and five rows for it fits three. The first
 * three are marked ok and the last two are marked full, in file order, rather
 * than failing all five. The host can then raise that tier's cap and re-run,
 * or drop the extras.
 */
export function planImport(
    rows: Array<{ email: string; tierName: string | null }>,
    tiers: TierOption[],
    defaultTierId: string | null,
): ImportPlan {
    const byId = new Map(tiers.map((t) => [t.id, t]));
    /* Seats consumed by earlier rows of THIS file, so row four is judged
       against what rows one to three already took. */
    const takenHere = new Map<string, number>();

    const planned: ImportPlanRow[] = rows.map((r) => {
        const named = r.tierName ? matchTier(r.tierName, tiers) : null;
        if (r.tierName && !named) {
            return { email: r.email, tierId: null, tierName: r.tierName, problem: 'unknown-tier' };
        }

        const tier = named ?? (defaultTierId ? byId.get(defaultTierId) ?? null : null);
        if (!tier) {
            return { email: r.email, tierId: null, tierName: r.tierName, problem: 'no-tier' };
        }

        const used = takenHere.get(tier.id) ?? 0;
        const room = tier.remaining;
        const fits = room === null || used < room;
        takenHere.set(tier.id, used + 1);

        return {
            email: r.email,
            tierId: tier.id,
            tierName: tier.name,
            problem: fits ? null : 'tier-full',
        };
    });

    const perTier = [...takenHere.entries()].map(([tierId, adding]) => {
        const t = byId.get(tierId)!;
        const room = t.remaining;
        return {
            tierId, name: t.name, adding, remaining: room,
            overBy: room === null ? 0 : Math.max(0, adding - room),
        };
    });

    return {
        rows: planned,
        ok: planned.filter((r) => r.problem === null),
        problems: planned.filter((r) => r.problem !== null),
        perTier,
    };
}

/** The importable half of a plan, as staged recipients. */
export function recipientsFromPlan(plan: ImportPlan): Recipient[] {
    return plan.ok.map((r) => ({ email: r.email, tierId: r.tierId ?? undefined }));
}

/**
 * Where the currently staged people would land, per tier.
 *
 * The tier step's summary. A recipient who already carries a tier (imported
 * from a CSV that named one) keeps it; everyone else falls to the tier chosen
 * for the batch. That is the same rule the import planner uses, applied to the
 * staged list rather than to a file.
 */
export function tierPlanFor(
    recipients: Recipient[],
    tiers: TierOption[],
    defaultTierId: string | null,
): ImportPlan['perTier'] {
    const byId = new Map(tiers.map((t) => [t.id, t]));
    const counts = new Map<string, number>();

    for (const r of recipients) {
        const id = r.tierId ?? defaultTierId;
        if (!id || !byId.has(id)) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return [...counts.entries()].map(([tierId, adding]) => {
        const t = byId.get(tierId)!;
        return {
            tierId, name: t.name, adding, remaining: t.remaining,
            overBy: t.remaining === null ? 0 : Math.max(0, adding - t.remaining),
        };
    });
}

/**
 * Stamp the chosen tier onto everyone who does not already have one.
 *
 * Called once on confirm, never as people are picked: doing it per pick would
 * overwrite a tier that arrived with an imported row the moment the host
 * changed the batch default.
 */
export function applyDefaultTier(recipients: Recipient[], defaultTierId: string | null): Recipient[] {
    if (!defaultTierId) return recipients;
    return recipients.map((r) => (r.tierId ? r : { ...r, tierId: defaultTierId }));
}

/** Everyone staged already knows which tier they are going into. */
export function allHaveTiers(recipients: Recipient[], defaultTierId: string | null): boolean {
    if (defaultTierId) return true;
    return recipients.every((r) => Boolean(r.tierId));
}
