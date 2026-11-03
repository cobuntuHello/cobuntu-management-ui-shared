import { useState } from "react";
import type { ArtifactReferralLink, ArtifactReferralCopy } from "./types";
import { formatMoney } from "../overview/format";
import { EmptyState } from "../overview/EmptyState";

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
    onCopyLink,
}: {
    links: ArtifactReferralLink[];
    copy: ArtifactReferralCopy;
    currency?: string;
    /** False for a viewer who may read the tab but not hand out links. */
    canManage: boolean;
    /** The link currently being disabled, so only its own row goes quiet. */
    busyId?: string | null;
    onInvite?: () => void;
    onDisable?: (linkId: string) => void;
    /** Given the full share URL. The host owns clipboard + toast. */
    onCopyLink?: (link: ArtifactReferralLink) => void;
}) {
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const live = links.filter((l) => l.status !== "DISABLED");
    const totalSales = live.reduce((s, l) => s + l.sales, 0);
    const totalHeld = live.reduce((s, l) => s + l.earnedHeldCents, 0);
    const totalPaid = live.reduce((s, l) => s + l.earnedPaidCents, 0);

    if (links.length === 0) {
        return (
            <div className="mui-referrals">
                <Header canManage={canManage} onInvite={onInvite} />
                <EmptyState
                    title="No referral links yet"
                    body={`Let someone promote this without handing over the sale. You stay the seller, you invoice the buyer, and they earn an agreed share of each ${singular(copy.unit)}.`}
                    action={canManage && onInvite ? (
                        <button type="button" className="mui-btn mui-btn--primary" onClick={onInvite}>
                            Invite someone
                        </button>
                    ) : undefined}
                />
            </div>
        );
    }

    return (
        <div className="mui-referrals">
            <Header canManage={canManage} onInvite={onInvite} />

            <dl className="mui-referrals__summary">
                <Stat k="Active links" v={String(live.filter((l) => l.status === "ACTIVE").length)}
                      sub={`of ${links.length} assigned`} />
                <Stat k={`${cap(copy.unit)} referred`} v={String(totalSales)} />
                <Stat k="Commission held" v={formatMoney(totalHeld, currency)}
                      sub="still in the refund window" />
                <Stat k="Commission paid" v={formatMoney(totalPaid, currency)} />
            </dl>

            <ul className="mui-referrals__list">
                {links.map((l) => {
                    const pending = l.status === "PENDING_STRIPE";
                    const disabled = l.status === "DISABLED";
                    const name = l.owner.name || l.owner.usertag || "Someone";
                    return (
                        <li key={l.id}
                            className={`mui-referrals__row${pending ? " is-pending" : ""}${disabled ? " is-disabled" : ""}`}>
                            <div className="mui-referrals__who">
                                <Avatar person={l.owner} />
                                <div className="mui-referrals__whoText">
                                    <span className="mui-referrals__name">{name}</span>
                                    <span className="mui-referrals__meta">
                                        <StatusPill status={l.status} />
                                        <span>{formatPct(l.commissionPct)} per {singular(copy.unit)}</span>
                                        {l.label ? <span>{l.label}</span> : null}
                                    </span>
                                    {pending ? (
                                        /*
                                         * Names whose move it is. An owner who reads
                                         * "not connected" without being told that
                                         * NOTHING is tracked yet will assume the link
                                         * is working and quietly lose the attribution.
                                         */
                                        <p className="mui-referrals__pendingNote">
                                            <strong>This link is off.</strong>{" "}
                                            {name} needs to connect a payout account before it can
                                            record a sale. Nothing is tracked until then, so there is
                                            nothing to share yet.
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mui-referrals__figures">
                                <Figure k={cap(copy.unit)} v={pending ? "—" : String(l.sales)} />
                                <Figure k="Held" v={pending ? "—" : formatMoney(l.earnedHeldCents, currency)} />
                                <Figure k="Paid" v={pending ? "—" : formatMoney(l.earnedPaidCents, currency)} />

                                <div className="mui-referrals__actions">
                                    {/*
                                      * No copy control on a pending link. Not disabled:
                                      * absent. See the note at the top of the file.
                                      */}
                                    {l.code && !disabled && onCopyLink ? (
                                        <button type="button" className="mui-btn mui-btn--secondary mui-btn--sm"
                                                onClick={() => onCopyLink(l)}>
                                            Copy link
                                        </button>
                                    ) : null}

                                    {canManage && !disabled && onDisable ? (
                                        confirmingId === l.id ? (
                                            <>
                                                <button type="button" className="mui-btn mui-btn--danger mui-btn--sm"
                                                        disabled={busyId === l.id}
                                                        onClick={() => { setConfirmingId(null); onDisable(l.id); }}>
                                                    {busyId === l.id ? "Turning off…" : "Turn off"}
                                                </button>
                                                <button type="button" className="mui-btn mui-btn--ghost mui-btn--sm"
                                                        onClick={() => setConfirmingId(null)}>
                                                    Keep
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className="mui-btn mui-btn--ghost mui-btn--sm"
                                                    onClick={() => setConfirmingId(l.id)}>
                                                Turn off
                                            </button>
                                        )
                                    ) : null}
                                </div>
                            </div>

                            {confirmingId === l.id ? (
                                /*
                                 * Says what does NOT happen. "Turn off" beside a money
                                 * figure reads as though the money goes too.
                                 */
                                <p className="mui-referrals__confirm">
                                    {name}&rsquo;s link stops recording new {copy.unit}. Commission
                                    they have already earned is not affected.
                                </p>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function Header({ canManage, onInvite }: { canManage: boolean; onInvite?: () => void }) {
    return (
        <div className="mui-referrals__header">
            <div>
                <h3 className="mui-referrals__title">Referral links</h3>
                <p className="mui-referrals__subtitle">
                    Give someone a link to share. Buyers check out here, you invoice them,
                    and they earn their share of each sale.
                </p>
            </div>
            {canManage && onInvite ? (
                <button type="button" className="mui-btn mui-btn--primary" onClick={onInvite}>
                    Invite someone
                </button>
            ) : null}
        </div>
    );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
    return (
        <div className="mui-referrals__stat">
            <dt>{k}</dt>
            <dd>{v}</dd>
            {sub ? <p>{sub}</p> : null}
        </div>
    );
}

function Figure({ k, v }: { k: string; v: string }) {
    return (
        <div className="mui-referrals__figure">
            <span className="mui-referrals__figureKey">{k}</span>
            <span className="mui-referrals__figureValue">{v}</span>
        </div>
    );
}

function StatusPill({ status }: { status: ArtifactReferralLink["status"] }) {
    const label =
        status === "ACTIVE" ? "Active"
            : status === "PENDING_STRIPE" ? "Not connected"
                : "Off";
    return <span className={`mui-referrals__pill mui-referrals__pill--${status.toLowerCase()}`}>{label}</span>;
}

/**
 * Initials, from the person's own name.
 *
 * The host passes `profileImage` where it has one. Where it does not, initials
 * beat a generic silhouette for telling two promoters apart in a list, which is
 * the only job this avatar has.
 */
function Avatar({ person }: { person: ArtifactReferralLink["owner"] }) {
    if (person.profileImage) {
        return <img className="mui-referrals__avatar" src={person.profileImage} alt="" />;
    }
    const source = person.name || person.usertag || "";
    const initials = source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join("");
    return <span className="mui-referrals__avatar mui-referrals__avatar--initials">{initials || "?"}</span>;
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
