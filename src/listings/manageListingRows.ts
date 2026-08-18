/**
 * The seller's own listings, reduced to rows.
 *
 * ── Why a pure module and not just JSX ──────────────────────────────────────
 *
 * Two domains answer this question with two different payloads. A product
 * listing is a `community_listings` row; an event listing is an
 * `event_communities` row, hydrated with a `ticketListing` that used to be the
 * only place its commission lived. They agree on what a row MEANS and disagree
 * on where every field sits, which is exactly the shape of thing that gets
 * re-implemented per surface and drifts.
 *
 * So the reading happens here, once, and the tab renders whatever comes out.
 * It is also the only part worth testing directly: a Decimal that arrives as
 * the string "12.50" and renders as "12.50%" is a bug no snapshot would catch.
 */

/**
 * The five states a listing can be in, as the backend enum spells them.
 *
 * PAUSED is the OWNER's lever: off the shelf, still approved, theirs to undo.
 * REVOKED is the community dropping it. They are deliberately not collapsed
 * into one "not live" — the owner is owed the difference between "I took this
 * down" and "they did", and that difference is the whole reason the enum grew
 * a fifth value instead of reusing CANCELLED.
 */
export type ListingState = "PENDING" | "ACTIVE" | "PAUSED" | "CANCELLED" | "REVOKED";

const KNOWN_STATES: readonly ListingState[] = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "REVOKED",
];

/**
 * A status this build does not know about returns null rather than a guess.
 *
 * The tempting default is CANCELLED, and it is the one that does damage: a
 * state added to the backend enum after this bundle shipped would tell every
 * seller their live listing had been closed. Null means "say nothing about the
 * state", and the row simply renders without a chip.
 */
export function normalizeListingState(raw: unknown): ListingState | null {
  return typeof raw === "string" && (KNOWN_STATES as readonly string[]).includes(raw)
    ? (raw as ListingState)
    : null;
}

/** Closed for good, by whoever closed it. Neither is on any shelf. */
export function isClosedState(state: ListingState | null): boolean {
  return state === "CANCELLED" || state === "REVOKED";
}

export interface ManageListingRow {
  /** The listing's own id — what /manage/listing/{id} is addressed by. */
  id: string;
  state: ListingState | null;
  communityId: string | null;
  communityTag: string | null;
  communityName: string | null;
  communityIconUrl: string | null;
  /** Null until the backend sends the package relation (see resolvePackageNames). */
  packageId: string | null;
  packageName: string | null;
  /** Percent. Null means no rate has been agreed yet, which is not the same as 0. */
  rate: number | null;
  createdAt: string | null;
}

/**
 * Prisma Decimals cross the wire as STRINGS.
 *
 * `commissionRate` is `Decimal(5,2)`, so JSON.stringify hands the client
 * "12.50", not 12.5. Existing surfaces render it straight into a template
 * literal and get away with it; anything that compares or formats it does not.
 * A rate of 0 is a real answer (a community taking nothing) and must survive,
 * which is why this cannot be written with `||`.
 */
export function toRate(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * One API row, either domain, to one tab row.
 *
 * `ticketListing.commissionRate` is the event fallback: events had no rate
 * column of their own until packages landed, so a live event listing from
 * before then carries its rate on the linked ticket listing and nowhere else.
 * Reading only the new column would show those sellers a blank where their
 * agreed commission is.
 */
export function toManageListingRow(raw: any): ManageListingRow {
  const community = raw?.community ?? raw?.communities ?? null;
  return {
    id: String(raw?.id ?? ""),
    state: normalizeListingState(raw?.status),
    communityId: community?.id ?? raw?.communityId ?? null,
    communityTag: community?.communityTag ?? community?.tagLower ?? null,
    communityName: community?.name ?? null,
    communityIconUrl: community?.iconUrl ?? null,
    packageId: raw?.packageId ?? raw?.package?.id ?? null,
    packageName: raw?.package?.name ?? null,
    rate: toRate(raw?.commissionRate ?? raw?.ticketListing?.commissionRate),
    createdAt: raw?.createdAt ?? null,
  };
}

export function toManageListingRows(raw: unknown): ManageListingRow[] {
  return Array.isArray(raw) ? raw.map(toManageListingRow).filter((r) => !!r.id) : [];
}

/**
 * Rows first, most useful first.
 *
 * Open listings above closed ones, because a closed listing is history and an
 * open one is a relationship being run. Within each group the newest first,
 * which is the order the API already returns and the order a seller reasons
 * about ("the one I just asked for").
 */
export function sortManageListingRows(rows: ManageListingRow[]): ManageListingRow[] {
  return [...rows].sort((a, b) => {
    const closed = Number(isClosedState(a.state)) - Number(isClosedState(b.state));
    if (closed !== 0) return closed;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

export interface RequestableCommunity {
  communityTag: string;
  name: string;
  iconUrl: string | null;
}

interface MembershipLike {
  communityTag: string;
  name: string;
  iconUrl?: string | null;
  status?: string;
}

/**
 * Which communities are left to ask.
 *
 * A community holding an OPEN listing is not offered again — the backend
 * refuses a second one ("A listing already exists for this product in this
 * community") and offering it would be a button whose only outcome is an
 * error toast.
 *
 * Either CLOSED state is offered again. Both free the slot server-side, so
 * asking again after your own withdrawal — or after a community ended it — is
 * a supported move and the seller should not have to guess that.
 *
 * ── This briefly excluded REVOKED, and that was wrong ───────────────────────
 *
 * It was changed to match the backend, which tested `status === 'CANCELLED'`
 * alone. That matching was correct as an observation and wrong as a decision:
 * the backend guard was itself the bug. REVOKED was split out of CANCELLED to
 * record WHO closed a listing, and every guard written against the old single
 * state silently became a permanent lockout when it landed — a community that
 * ended a listing barred that seller from it forever, with no route back short
 * of a database edit.
 *
 * The backend now frees the slot for both, so this offers both. Re-requesting
 * is not re-instating: the row returns to PENDING and a leader decides again.
 * The community keeps the final word; it simply is not a life sentence.
 *
 * PENDING membership is excluded for a separate reason: requestListing requires
 * an ACCEPTED member and would 403.
 */
export function requestableCommunities(
  memberships: MembershipLike[],
  rows: ManageListingRow[],
): RequestableCommunity[] {
  const taken = new Set(
    rows
      .filter((r) => !isClosedState(r.state))
      .map((r) => r.communityTag?.toLowerCase())
      .filter(Boolean) as string[],
  );

  return (memberships ?? [])
    .filter((m) => !!m?.communityTag)
    .filter((m) => (m.status ?? "ACCEPTED") === "ACCEPTED")
    .filter((m) => !taken.has(m.communityTag.toLowerCase()))
    .map((m) => ({
      communityTag: m.communityTag,
      name: m.name || m.communityTag,
      iconUrl: m.iconUrl ?? null,
    }));
}

/**
 * Does this item belong to its maker, or to the community?
 *
 * `communityId` is the whole condition, on both tables: the create flow writes
 * it only when a leader chose "as the community", and it is what the server
 * checks before allowing community-scoped settings.
 *
 * It decides whether the Listings tab exists at all. A community-owned item has
 * exactly one listing — the community's own — and there is nothing to negotiate
 * with yourself, so a tab of one non-negotiable row is a tab that only ever
 * says "yes, still yours".
 */
export function isMemberOwned(item: { communityId?: string | null } | null | undefined): boolean {
  return !!item && !item.communityId;
}
