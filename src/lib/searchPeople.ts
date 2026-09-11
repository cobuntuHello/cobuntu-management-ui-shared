/**
 * Find people to grant something to: a host on an event, a co-seller on a
 * product.
 *
 * ── Two sources, because a listing is not always owned by a community ──
 *
 * COMMUNITY-owned (`communityTag` set) — `GET /communities/:tag/members/search`.
 * The server filters non-members and honours `excludeUserIds`, so the caller
 * never has to reason about who is already on the list. Accepts a 1-char query.
 *
 * PERSONAL (`communityTag` null) — `GET /discovery/users?search=`. There is no
 * community to scope to, the endpoint has no exclude parameter, and it wants
 * 2 characters. Exclusions are applied here instead.
 *
 * `minQueryLength` reports which of those two floors applies, so the caller can
 * word its "start typing" hint honestly rather than promising results at one
 * character that the backend will refuse.
 *
 * ── Failure yields an empty list ──────────────────────────────────────
 *
 * The picker shows "no matches" and the operator retypes. Surfacing a network
 * error inside a type-ahead means a red message flashing on every keystroke
 * that outruns the debounce, which reads as "this is broken" for what is
 * usually one dropped request.
 */

export interface PersonSearchResult {
    id: string;
    name: string | null;
    usertag: string | null;
    profileImage: string | null;
}

export interface SearchPeopleOptions {
    apiBaseUrl: string;
    /** Truthy → community member search. Null → global user search. */
    communityTag: string | null;
    query: string;
    /** Already on the list. Server-side for members, client-side for global. */
    excludeUserIds?: string[];
    /** The signed-in user, excluded from GLOBAL results (you cannot add yourself). */
    currentUserId?: string | null;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

/** The shortest query each source will actually answer. */
export function minQueryLength(communityTag: string | null): number {
    return communityTag ? 1 : 2;
}

function normalise(raw: any): PersonSearchResult | null {
    if (!raw || !raw.id) return null;
    return {
        id: raw.id,
        name: raw.name ?? null,
        usertag: raw.usertag ?? null,
        profileImage: raw.profileImage ?? null,
    };
}

export async function searchPeople({
    apiBaseUrl,
    communityTag,
    query,
    excludeUserIds = [],
    currentUserId,
    headers,
    signal,
}: SearchPeopleOptions): Promise<PersonSearchResult[]> {
    const q = query.trim();
    if (q.length < minQueryLength(communityTag)) return [];

    try {
        if (communityTag) {
            const params = new URLSearchParams({ q });
            if (excludeUserIds.length > 0) {
                params.set("excludeUserIds", excludeUserIds.join(","));
            }
            const res = await fetch(
                `${apiBaseUrl}/api/communities/${encodeURIComponent(communityTag)}/members/search?${params.toString()}`,
                { headers: headers ?? {}, signal },
            );
            if (!res.ok) return [];
            const data = await res.json();
            const list = Array.isArray(data?.members) ? data.members : [];
            return list.map(normalise).filter(Boolean) as PersonSearchResult[];
        }

        const params = new URLSearchParams({ search: q });
        const res = await fetch(
            `${apiBaseUrl}/api/discovery/users?${params.toString()}`,
            { headers: headers ?? {}, signal },
        );
        if (!res.ok) return [];
        const data = await res.json();
        /*
         * Tolerate `{ data: [...] }` (canonical), `{ users: [...] }` and a bare
         * array. The community app already hedged this way against its own
         * client; keeping the hedge here means one place decides what the
         * endpoint is allowed to return.
         */
        const raw: any[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.users)
                    ? data.users
                    : [];
        const excluded = new Set<string>(excludeUserIds);
        if (currentUserId) excluded.add(currentUserId);
        return raw
            .map(normalise)
            .filter((p): p is PersonSearchResult => !!p && !excluded.has(p.id));
    } catch {
        return [];
    }
}
