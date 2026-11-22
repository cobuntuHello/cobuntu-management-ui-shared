import type { OverviewStats } from "./types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Who owns this and what you are to it, in one line.
 *
 * The same page reads very differently depending on who is looking: an owner
 * reads "what I keep", a leader of the owning community reads "what the
 * community keeps", and a leader whose community merely carries someone else's
 * item reads "what my community earned" and nothing of the seller's own
 * business. Saying which of those it is, up top, is what stops a number being
 * read as somebody else's money.
 *
 * The owner is NAMED ("Owned by Finance Social Club", "Owned by Nina Simone")
 * when the backend sends it, with its icon or avatar: a leader of a community
 * carrying ten members' items needs to know whose this one is. Your own item
 * stays "Owned by you".
 *
 * Renders nothing when the backend did not say who is looking (`viewerRole`
 * absent on an older payload): naming nobody is better than guessing a role.
 */
export function OwnershipLine({ stats, t }: { stats: OverviewStats; t: T }) {
    const role = stats.viewerRole;
    if (!role) return null;
    const owner = stats.owner ?? null;

    const what = {
        owner: "overviewRoleOwnerManage",
        "co-owner": "overviewRoleCoOwner",
        "community-leader": "overviewRoleCommunityLeaderManage",
        carrier: "overviewRoleCarrierManage",
        admin: "overviewRoleAdmin",
    }[role];

    // Your own item: never your own name back at you.
    const who: string | null = role === "owner"
        ? t("overviewRoleOwner")
        : owner
            ? t("overviewOwnedBy", { name: owner.name })
            : role === "community-leader"
                ? t("overviewRoleCommunityLeader")
                : role === "carrier"
                    ? t("overviewRoleCarrier")
                    : null;
    const showImage = role !== "owner" && !!owner;

    const live = (stats.listings ?? []).filter((l) => l.status === "ACTIVE").length;

    return (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {showImage && owner && (owner.imageUrl ? (
                <img
                    src={owner.imageUrl}
                    alt=""
                    className={`h-6 w-6 flex-none object-cover ${owner.kind === "community" ? "rounded-md" : "rounded-full"}`}
                />
            ) : (
                <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 flex-none items-center justify-center bg-zinc-200 text-[11px] font-bold text-zinc-600 ${owner.kind === "community" ? "rounded-md" : "rounded-full"}`}
                >
                    {owner.name.trim().charAt(0).toUpperCase()}
                </span>
            ))}
            {who && <span className="font-semibold text-zinc-900">{who}</span>}
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">{t(what)}</span>
            {live > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    {t("overviewStatus_ACTIVE")} · {t("overviewCommunitiesCount", { count: live })}
                </span>
            )}
        </div>
    );
}
