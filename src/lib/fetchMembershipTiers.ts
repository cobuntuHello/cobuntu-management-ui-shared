/**
 * A community's membership tiers, for the listing access pickers.
 *
 * ── Why this is in the shared package ───────────────────────────────
 *
 * Both settings drawers need it and both were broken the same way: the
 * drawers accepted a `membershipTiers` prop, the views that render them never
 * passed one, and neither manage page had the prop at all. So the chain was
 * severed INSIDE the packages, and no consumer could fix it from outside —
 * every access picker on a manage page reported "This community has no
 * membership tiers yet" for communities that plainly had several.
 *
 * The endpoint knowledge lives here so the two packages cannot drift on which
 * route, which shape, or what a failure means.
 *
 * ── Why /segments/public ────────────────────────────────────────────
 *
 * It returns exactly `{ id, name }`, it is what the apply page and /plans
 * already call, and it carries no permission of its own. The authenticated
 * `GET /:tag/segments` requires COMMUNITY_MANAGE_TIERS, which a leader who can
 * edit a listing does not necessarily hold — using it would 403 exactly the
 * people this is for.
 *
 * Every `community_segments` row IS a membership tier: there is no `kind`
 * discriminator, and both existing tier UIs select on communityId alone.
 *
 * ── Failure yields an empty list, deliberately ──────────────────────
 *
 * A picker with no tiers still works: it means "all members", which is the
 * safe reading because it never narrows access on its own. It is also exactly
 * what a listing with no grants already resolves to.
 */

export type MembershipTierOption = { id: string; name: string };

export async function fetchMembershipTiers(
  apiBaseUrl: string,
  communityTag: string | null | undefined,
  headers?: Record<string, string>,
): Promise<MembershipTierOption[]> {
  if (!communityTag) return [];
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/communities/${encodeURIComponent(communityTag)}/segments/public`,
      { headers: headers ?? {} },
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data) ? data : (data as any)?.segments;
    return Array.isArray(list)
      ? list.filter((t: any) => t && t.id).map((t: any) => ({ id: String(t.id), name: String(t.name ?? "") }))
      : [];
  } catch {
    return [];
  }
}
