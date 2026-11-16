import { useState } from "react";
import type { ArtifactReferralLink, ArtifactReferralCopy } from "./types";
import { formatMoney } from "../overview/format";
import { PricingSectionHeading } from "../ui/PricingSectionHeading";

/**
 * Who promotes this item, and what they have earned.
 *
 * ── Why this tab exists at all ──────────────────────────────────────────────
 *
 * An owner wants other people to sell for them WITHOUT giving up the sale. The
 * alternative, letting another community list the item, splits the payout: the
 * owner carries the whole cost of running the thing and sees only the slice
 * sold through their own storefront. A referral link keeps one checkout, one
 * merchant and one payout invoice, with the promoter's cut as a named
 * deduction. That sentence is the empty state, because the distinction is the
 * entire reason to use this and an owner meets it here first.
 *
 * ── A link with no code is not a link ───────────────────────────────────────
 *
 * `code` is null until its owner connects Stripe. That is not a loading state
 * and not a formatting problem: there is genuinely nothing to share, because
 * nobody could be paid on it. So a pending row shows no link, no copy control,
 * and says plainly what is missing and whose move it is. The copy button is
 * absent rather than disabled-with-a-tooltip -- a disabled control still reads
 * as "there is a link here, just not for you".
 *
 * ── Two money columns, not one ──────────────────────────────────────────────
 *
 * HELD is inside the buyer's refund window and can still vanish. PAID has
 * moved. Summing them into "earned" would promise a referrer money that a
 * refund can still take back, which is exactly the complaint the payout
 * banners elsewhere in this product had to be rewritten to avoid.
 */
export function ManageReferrals({
    links,
    copy,
    currency = "EUR",
    canManage,
    busyId,
    onInvite,
    onDisable,
    onEnable,
    onCopyLink,
}: {
    links: ArtifactReferralLink[];
    copy: ArtifactReferralCopy;
    currency?: string;
    /** False for a viewer who may read the tab but not hand out links. */
    canManage: boolean;
    /** The link currently busy (disabling or re-enabling), so only its own row goes quiet. */
    busyId?: string | null;
    onInvite?: () => void;
    onDisable?: (linkId: string) => void;
    /** Turn a DISABLED link back on. Absent hides the action, same as onDisable. */
    onEnable?: (linkId: string) => void;
    /** Given the full share URL. The host owns clipboard + toast. */
    onCopyLink?: (link: ArtifactReferralLink) => void;
}) {
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const live = links.filter((l) => l.status !== "DISABLED");
    const totalSales = live.reduce((s, l) => s + l.sales, 0);
    const totalHeld = live.reduce((s, l) => s + l.earnedHeldCents, 0);
    const totalPaid = live.reduce((s, l) => s + l.earnedPaidCents, 0);

    const ink = "var(--text-color, #18181b)";
    const muted = "color-mix(in srgb, var(--text-color, #18181b) 58%, transparent)";
    const line = "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)";
    const soft = "color-mix(in srgb, var(--text-color, #18181b) 6%, transparent)";
    const one = singular(copy.unit);
    const heading = (
        <PricingSectionHeading
            title="Referral links"
            description={`Someone shares a link. Buyers pay you, and they earn an agreed share of each ${one}.`}
            action={links.length > 0 && canManage && onInvite ? (
                <button type="button" onClick={onInvite} className={`${btn} text-white`} style={{ background: "var(--brand-color, #18181b)" }}>
                    Invite someone
                </button>
            ) : undefined}
        />
    );

    if (links.length === 0) {
        return (
            <div data-testid="referrals">
                {heading}
                <div className="rounded-2xl border border-dashed px-5 py-6 text-center" style={{ borderColor: "color-mix(in srgb, var(--text-color, #18181b) 25%, transparent)" }}>
                    <p className="text-[14.5px] font-semibold" style={{ color: ink }}>No referral links yet</p>
                    <p className="mx-auto mt-1 max-w-[46ch] text-[12.5px]" style={{ color: muted }}>
                        {canManage
                            ? `Let a partner or a member promote this without handing over the sale. You stay the seller, you invoice the buyer, and they earn an agreed share of each ${one}.`
                            : "Nobody has a referral link for this yet."}
                    </p>
                    {canManage && onInvite ? (
                        <>
                            <ol className="mx-auto mt-4 mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12px]" style={{ color: muted }}>
                                {["Pick a person", "Set their share", "They share the link"].map((step, i) => (
                                    <li key={step} className="flex items-center gap-1.5">
                                        <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold" style={{ background: soft, color: ink }}>{i + 1}</span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                            <button type="button" onClick={onInvite} className={`${btn} text-white`} style={{ background: "var(--brand-color, #18181b)" }}>
                                Invite someone
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div data-testid="referrals">
            {heading}

            <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat k="Active links" v={String(live.filter((l) => l.status === "ACTIVE").length)} sub={`of ${links.length}`} />
                <Stat k={`${cap(copy.unit)} referred`} v={String(totalSales)} />
                <Stat k="Held" v={formatMoney(totalHeld, currency)} sub="in the refund window" />
                <Stat k="Paid" v={formatMoney(totalPaid, currency)} />
            </dl>

            <ul className="overflow-hidden rounded-2xl border" style={{ borderColor: line }}>
                {links.map((l, i) => {
                    const pending = l.status === "PENDING_STRIPE";
                    const disabled = l.status === "DISABLED";
                    const name = l.owner.name || l.owner.usertag || "Someone";
                    return (
                        <li key={l.id} className={`px-4 py-3.5 ${i > 0 ? "border-t" : ""}`} style={{ borderColor: line }}>
                            <div className="flex flex-wrap items-center gap-3">
                                <Avatar person={l.owner} />
                                <div className={`min-w-[180px] flex-1 ${disabled ? "opacity-55" : ""}`}>
                                    <span className="block text-[14px] font-semibold" style={{ color: ink }}>{name}</span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: muted }}>
                                        <StatusPill status={l.status} />
                                        <span>{formatPct(l.commissionPct)} per {one}</span>
                                        {l.label ? <span>· {l.label}</span> : null}
                                    </span>
                                </div>
                                <div className={`flex gap-4 tabular-nums ${disabled ? "opacity-55" : ""}`}>
                                    <Figure k={cap(copy.unit)} v={pending ? "–" : String(l.sales)} />
                                    <Figure k="Held" v={pending ? "–" : formatMoney(l.earnedHeldCents, currency)} />
                                    <Figure k="Paid" v={pending ? "–" : formatMoney(l.earnedPaidCents, currency)} />
                                </div>
                                <div className="ml-auto flex gap-1.5">
                                    {/* No copy control on a pending link. Not disabled: absent. */}
                                    {l.code && !disabled && onCopyLink ? (
                                        <button type="button" className={`${btnSm}`} style={{ background: soft, color: ink }} onClick={() => onCopyLink(l)}>
                                            Copy link
                                        </button>
                                    ) : null}
                                    {canManage && !disabled && onDisable ? (
                                        confirmingId === l.id ? (
                                            <>
                                                <button type="button" className={`${btnSm} text-white`} style={{ background: "#b42318" }}
                                                        disabled={busyId === l.id}
                                                        onClick={() => { setConfirmingId(null); onDisable(l.id); }}>
                                                    {busyId === l.id ? "Turning off…" : "Turn off"}
                                                </button>
                                                <button type="button" className={btnSm} style={{ color: muted }} onClick={() => setConfirmingId(null)}>
                                                    Keep
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className={btnSm} style={{ color: muted }} onClick={() => setConfirmingId(l.id)}>
                                                Turn off
                                            </button>
                                        )
                                    ) : null}
                                    {/* Re-enabling keeps the same row (its rate and history): no confirm step. */}
                                    {canManage && disabled && onEnable ? (
                                        <button type="button" className={btnSm} style={{ background: soft, color: ink }}
                                                disabled={busyId === l.id} onClick={() => onEnable(l.id)}>
                                            {busyId === l.id ? "Turning on…" : "Turn back on"}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            {pending ? (
                                /* Says whose move it is: nothing is tracked until they connect. */
                                <p className="mt-2 rounded-xl px-3 py-2 text-[12px] sm:ml-12" style={{ background: "#fdf4e3", color: "#8a5a12" }}>
                                    <strong>This link is off.</strong>{" "}
                                    {name} needs to connect a payout account before it can record a sale. Nothing is tracked until then, so there is nothing to share yet.
                                </p>
                            ) : null}
                            {confirmingId === l.id ? (
                                /* Says what does NOT happen: the money earned stays. */
                                <p className="mt-2 text-[12px] sm:ml-12" style={{ color: muted }}>
                                    {name}&rsquo;s link stops recording new {copy.unit}. Commission they have already earned is not affected.
                                </p>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

const btn = "inline-flex items-center justify-center gap-1.5 rounded-[var(--button-radius,10px)] px-3.5 py-2 text-[13px] font-semibold cursor-pointer";
const btnSm = "inline-flex items-center justify-center rounded-[var(--button-radius,10px)] px-2.5 py-1.5 text-[12.5px] font-semibold cursor-pointer disabled:opacity-50";

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
    return (
        <div className="rounded-xl px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--text-color, #18181b) 5%, transparent)" }}>
            <dt className="text-[11.5px]" style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 58%, transparent)" }}>{k}</dt>
            <dd className="mt-0.5 text-[17px] font-semibold tabular-nums" style={{ color: "var(--text-color, #18181b)" }}>{v}</dd>
            {sub ? <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 42%, transparent)" }}>{sub}</p> : null}
        </div>
    );
}

function Figure({ k, v }: { k: string; v: string }) {
    return (
        <div className="text-right">
            <span className="block text-[11px]" style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 58%, transparent)" }}>{k}</span>
            <span className="text-[13.5px] font-semibold" style={{ color: "var(--text-color, #18181b)" }}>{v}</span>
        </div>
    );
}

function StatusPill({ status }: { status: ArtifactReferralLink["status"] }) {
    const label = status === "ACTIVE" ? "Active" : status === "PENDING_STRIPE" ? "Not connected" : "Off";
    const style = status === "ACTIVE"
        ? { background: "#e7f5ee", color: "#147a4b" }
        : status === "PENDING_STRIPE"
            ? { background: "#fdf4e3", color: "#8a5a12" }
            : { background: "color-mix(in srgb, var(--text-color, #18181b) 8%, transparent)", color: "color-mix(in srgb, var(--text-color, #18181b) 58%, transparent)" };
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={style}>{label}</span>;
}

/** Initials beat a silhouette for telling two promoters apart. */
function Avatar({ person }: { person: ArtifactReferralLink["owner"] }) {
    const cls = "h-9 w-9 shrink-0 rounded-full";
    if (person.profileImage) return <img className={`${cls} object-cover`} src={person.profileImage} alt="" />;
    const source = person.name || person.usertag || "";
    const initials = source.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
    return (
        <span className={`${cls} grid place-items-center text-[12.5px] font-semibold`}
              style={{ background: "color-mix(in srgb, var(--brand-color, #c4834f) 18%, transparent)", color: "var(--text-color, #18181b)" }}>
            {initials || "?"}
        </span>
    );
}

/** 0.085 -> "8.5%", 0.1 -> "10%". Never prints a trailing ".0". */
export function formatPct(fraction: number): string {
    const pct = (fraction ?? 0) * 100;
    return `${Number(pct.toFixed(2))}%`;
}

function cap(s: string): string {
    return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** "tickets" -> "ticket". Good enough for the three nouns this takes. */
function singular(plural: string): string {
    return plural.endsWith("s") ? plural.slice(0, -1) : plural;
}
