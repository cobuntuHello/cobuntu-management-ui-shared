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
 * Renders nothing when the backend did not say (`viewerRole` absent on an older
 * payload): naming nobody is better than guessing a role.
 */
export function OwnershipLine({ stats, t }: { stats: OverviewStats; t: T }) {
    const role = stats.viewerRole;
    if (!role) return null;

    const [who, what] = {
        owner: ["overviewRoleOwner", "overviewRoleOwnerManage"],
        "co-owner": [null, "overviewRoleCoOwner"],
        "community-leader": ["overviewRoleCommunityLeader", "overviewRoleCommunityLeaderManage"],
        carrier: ["overviewRoleCarrier", "overviewRoleCarrierManage"],
        admin: [null, "overviewRoleAdmin"],
    }[role] as [string | null, string];

    const live = (stats.listings ?? []).filter((l) => l.status === "ACTIVE").length;

    return (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {who && <span className="font-semibold text-zinc-900">{t(who)}</span>}
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">{t(what)}</span>
            {live > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    {t("overviewStatus_ACTIVE")} · {t("overviewCommunitiesCount", { count: live })}
                </span>
            )}
        </div>
    );
}
