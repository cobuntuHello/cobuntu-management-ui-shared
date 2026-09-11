import type { PersonSearchResult } from './searchPeople';

/**
 * The community's members, grouped by role, for browsing rather than searching.
 *
 * ── Why not members/search ──────────────────────────────────────────
 *
 * That endpoint requires a query (`q.length < 1` returns an empty list) and
 * hard-caps at 10 results. It is an autocomplete, and it is right to be one.
 * Asking it to list a community is asking it to be a different endpoint.
 *
 * `GET /:tag/memberships` is what the members directory already renders. It
 * runs the same MEMBERS-page visibility resolver, so a community that keeps its
 * roster private stays private here too — this adds no new exposure.
 *
 * ── Grouping is the filter ──────────────────────────────────────────
 *
 * Members carry `roleGroups: [{ name, color, isSystem }]`. Grouping by them,
 * with role groups first and plain members last, puts leaders at the top of the
 * list without a filter control existing at all — which was the actual request:
 * "view the list and invite the leaders", not "give me a way to filter".
 *
 * Someone in two groups appears under the FIRST of them. A person listed twice
 * is a person you can tick twice, and the count would then lie.
 */

export interface RosterPerson extends PersonSearchResult {
    /** The group this person is filed under, for the heading above them. */
    group: string;
}

export interface RosterGroup {
    /** Heading text. Already resolved — the caller does not re-label it. */
    name: string;
    people: RosterPerson[];
}

/** Members with no role group at all. Callers pass a translated label. */
export const UNGROUPED = '__members__';

function toPerson(raw: any): PersonSearchResult | null {
    if (!raw?.id) return null;
    return {
        id: raw.id,
        name: raw.name ?? null,
        usertag: raw.usertag ?? null,
        profileImage: raw.profileImage ?? null,
    };
}

/**
 * Fetch the roster.
 *
 * Admins and owners are requested alongside members because they are the people
 * most often being added — a community's leaders are exactly who you invite to
 * co-host or co-sell. Omitting them would make the browse list quietly wrong in
 * the one case it was built for.
 *
 * Failure yields an empty list rather than throwing: the picker still has its
 * search field, so a roster that will not load degrades to the behaviour that
 * existed before this was added.
 */
export async function fetchCommunityRoster(opts: {
    apiBaseUrl: string;
    communityTag: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}): Promise<RosterPerson[]> {
    const { apiBaseUrl, communityTag, headers, signal } = opts;
    try {
        const params = new URLSearchParams({
            includeMembers: 'true',
            includeAdmins: 'true',
            includeOwners: 'true',
        });
        const res = await fetch(
            `${apiBaseUrl}/api/communities/${encodeURIComponent(communityTag)}/memberships?${params}`,
            { headers: headers ?? {}, signal },
        );
        if (!res.ok) return [];
        const data = await res.json();

        /*
         * The endpoint has been reshaped more than once. Tolerating the three
         * shapes it has worn costs four lines here and saves a blank roster
         * that looks like "this community has no members".
         */
        const list: any[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.members)
                ? data.members
                : Array.isArray(data?.data)
                    ? data.data
                    : [];

        return list
            .map((m) => {
                const person = toPerson(m.user ?? m);
                if (!person) return null;
                const groups: any[] = Array.isArray(m.roleGroups) ? m.roleGroups : [];
                const group = groups.find((g) => g?.name)?.name ?? UNGROUPED;
                return { ...person, group } as RosterPerson;
            })
            .filter((p): p is RosterPerson => !!p);
    } catch {
        return [];
    }
}

/**
 * Group, order, and drop anyone already on the list.
 *
 * Role groups come before ungrouped members, and within that in the order the
 * roster returned them, which is the order the members directory already shows.
 * Inventing an alphabetical order here would make the same community look
 * different in two places.
 */
export function groupRoster(
    people: RosterPerson[],
    opts: { excludeUserIds?: string[]; ungroupedLabel: string; query?: string } = { ungroupedLabel: 'Members' },
): RosterGroup[] {
    const excluded = new Set(opts.excludeUserIds ?? []);
    const q = (opts.query ?? '').trim().toLowerCase();

    const matches = (p: RosterPerson) => {
        if (excluded.has(p.id)) return false;
        if (!q) return true;
        // Typing filters the SAME list rather than replacing it, which is what
        // keeps browse and search one control instead of two modes.
        return `${p.name ?? ''} ${p.usertag ?? ''}`.toLowerCase().includes(q);
    };

    const order: string[] = [];
    const byGroup = new Map<string, RosterPerson[]>();
    for (const p of people) {
        if (!matches(p)) continue;
        if (!byGroup.has(p.group)) {
            byGroup.set(p.group, []);
            order.push(p.group);
        }
        byGroup.get(p.group)!.push(p);
    }

    const named = order.filter((g) => g !== UNGROUPED);
    const groups: RosterGroup[] = named.map((g) => ({ name: g, people: byGroup.get(g)! }));
    if (byGroup.has(UNGROUPED)) {
        groups.push({ name: opts.ungroupedLabel, people: byGroup.get(UNGROUPED)! });
    }
    return groups;
}

/** Distinct role-group names present, for the narrowing select. */
export function rosterRoles(people: RosterPerson[]): string[] {
    const seen: string[] = [];
    for (const p of people) {
        if (p.group !== UNGROUPED && !seen.includes(p.group)) seen.push(p.group);
    }
    return seen;
}
