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
