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
 * ── It needs a publishable key, and that is why it was broken ───────
 *
 * `/segments/public` is guarded by `requireApiKey("READ_PUBLIC")`. It used to
 * be reachable anyway: there was an X-Internal-Gateway bypass that let
 * anything proxied through api-gateway past the key check. THAT BYPASS WAS
 * REMOVED, and this helper was never updated — so every call 401'd, and
 * because the catch below turns any failure into an empty list, it presented
 * as "This community has no membership tiers yet" rather than as an error.
 * Measured on pathseekers, which has two tiers: the bare call returns 401, the
 * keyed call returns both.
 *
 * (The route's own comment in services/core still claimed it was "effectively
 * bypassed for any request transiting through api-gateway". It is not, and
 * that sentence is what made this look like a data problem.)
 *
 * The key is the Stripe pk_live_… model: public by design, fetched from an
 * unauthenticated endpoint, safe to hold in the browser. The community app
 * already injects it into every apiClient call, which is exactly why its own
 * pickers kept working while the admin app's did not.
 *
 * A caller's own `Authorization: Bearer <user token>` does NOT substitute:
 * requireApiKey reads Bearer as a key candidate, and a user JWT fails
 * validation as one. X-API-Key takes precedence over it, so passing both is
 * harmless.
 *
 * ── Failure yields an empty list, deliberately ──────────────────────
 *
 * A picker with no tiers still works: it means "all members", which is the
 * safe reading because it never narrows access on its own. It is also exactly
 * what a listing with no grants already resolves to.
 *
 * The cost of that choice is what this bug was: a silent empty list is
 * indistinguishable from a community that genuinely has no tiers. Kept anyway,
 * because the alternative is a create wizard that fails to open, but the
 * lookup now reports WHY into the console so the next person is not left
 * reading the UI for a clue.
 */

export type MembershipTierOption = { id: string; name: string };

/**
 * Per-tag cache of the community's publishable key.
 *
 * The key is public and stable, and every picker mount would otherwise cost a
 * second round-trip before the one it actually wants. Keyed by tag so two
 * communities open in two tabs cannot read each other's.
 */
const publishableKeyByTag = new Map<string, string>();

async function resolvePublishableKey(
  apiBaseUrl: string,
  communityTag: string,
): Promise<string | null> {
  const cached = publishableKeyByTag.get(communityTag);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/communities/${encodeURIComponent(communityTag)}/publishable-key`,
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // The endpoint returns `{ key }`. Tolerate `publishableKey` too rather
    // than silently returning null if it is ever renamed.
    const key = (data as any)?.key ?? (data as any)?.publishableKey ?? null;
    if (typeof key === "string" && key) {
      publishableKeyByTag.set(communityTag, key);
      return key;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchMembershipTiers(
  apiBaseUrl: string,
  communityTag: string | null | undefined,
  headers?: Record<string, string>,
): Promise<MembershipTierOption[]> {
  if (!communityTag) return [];
  try {
    // Consumers that already inject a key (the community app does, on every
    // apiClient call) keep theirs; everyone else gets one resolved here.
    const supplied = headers?.["X-API-Key"] ?? headers?.["x-api-key"];
    const key = supplied ?? (await resolvePublishableKey(apiBaseUrl, communityTag));

    const res = await fetch(
      `${apiBaseUrl}/api/communities/${encodeURIComponent(communityTag)}/segments/public`,
      { headers: { ...(headers ?? {}), ...(key ? { "X-API-Key": key } : {}) } },
    );
    if (!res.ok) {
      // Loud enough to find, quiet enough not to break a wizard. A 401 here
      // means the key never arrived; the picker will claim the community has
      // no tiers, which is the symptom this comment exists to explain.
      console.warn(
        `[fetchMembershipTiers] ${res.status} for ${communityTag} — the access picker will show no tiers`,
      );
      return [];
    }
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data) ? data : (data as any)?.segments;
    return Array.isArray(list)
      ? list.filter((t: any) => t && t.id).map((t: any) => ({ id: String(t.id), name: String(t.name ?? "") }))
      : [];
  } catch {
    return [];
  }
}
