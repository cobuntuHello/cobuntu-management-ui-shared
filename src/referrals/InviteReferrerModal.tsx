import * as React from "react";
import { ActionModalShell } from "../ui/ActionModalShell";
import { searchPeople, minQueryLength } from "../lib/searchPeople";
import type { PersonSearchResult } from "../lib/searchPeople";
import { formatMoney } from "../overview/format";

/**
 * Invite one person to promote this artifact.
 *
 * ── Why not PersonPickerModal ───────────────────────────────────────────────
 *
 * That component is a multi-step flow built around choosing PEOPLE and then
 * confirming a message, with an optional tier step for surfaces that consume
 * capacity. A referral invite needs one person and one RATE, and bolting a
 * rate step onto a shared multi-step picker is surgery on a component five
 * other surfaces depend on. This reuses the same search primitive and modal
 * shell instead, and stays a single screen.
 *
 * ── The rate is typed, every time ───────────────────────────────────────────
 *
 * No inherited default, per the founder's decision: a prefilled rate gets
 * accepted without being read, and it costs the owner on every sale. The field
 * starts empty and the modal cannot be submitted until it is filled.
 *
 * ── It says what the rate is worth in money ─────────────────────────────────
 *
 * An owner decides in euros, not percentages. Given the artifact's price, the
 * hint shows the cash value of the rate they have typed, because "10%" and
 * "€2.20 of every €22.00 ticket" are not equally easy to judge.
 *
 * ── It warns BEFORE inviting, not after ─────────────────────────────────────
 *
 * Where the chosen person has no payout account the invite still goes out, but
 * the owner is told here that the link will be inert until they connect. The
 * alternative is an owner who assigns a link, tells someone to start sharing,
 * and discovers days later that nothing was ever tracked.
 */
export function InviteReferrerModal({
    isOpen,
    onClose,
    apiBaseUrl,
    authHeaders,
    communityTag,
    currentUserId,
    excludeUserIds = [],
    unit,
    priceCents,
    currency = "EUR",
    onInvite,
}: {
    isOpen: boolean;
    onClose: () => void;
    apiBaseUrl: string;
    authHeaders: () => Record<string, string>;
    communityTag: string | null;
    /** The artifact's seller, so they cannot be invited to refer their own item. */
    currentUserId?: string | null;
    /** People who already hold a link here. */
    excludeUserIds?: string[];
    /** "tickets", "purchases", "enrolments". */
    unit: string;
    /** The artifact's own price, for the money hint. Null hides the hint. */
    priceCents?: number | null;
    currency?: string;
    /** Performs the write. Throw an Error to surface its message. */
    onInvite: (input: { ownerUserId: string; commissionPct: number; label: string | null }) => Promise<void>;
}) {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<PersonSearchResult[]>([]);
    const [person, setPerson] = React.useState<PersonSearchResult | null>(null);
    const [pct, setPct] = React.useState("");
    const [label, setLabel] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Reset on open, so a second invite does not inherit the first's answers.
    React.useEffect(() => {
        if (isOpen) {
            setQuery(""); setResults([]); setPerson(null);
            setPct(""); setLabel(""); setError(null);
        }
    }, [isOpen]);

    /*
     * The debounce must not depend on identity-unstable props.
     *
     * `authHeaders` is a function and `excludeUserIds` an array, and a host
     * writing either inline -- which is the normal way to call this -- creates
     * a new reference on every render. With those in the dependency array the
     * effect re-ran each render, cleared its own 220ms timer before it could
     * fire, and the search NEVER ran. A test caught it; in the app it would
     * have looked like a search box that simply returns nothing.
     *
     * So: the callback and the list are read through a ref, and the effect
     * keys on the values that should actually retrigger a search.
     */
    const latest = React.useRef({ authHeaders, excludeUserIds, currentUserId });
    latest.current = { authHeaders, excludeUserIds, currentUserId };
    const excludeKey = excludeUserIds.join(",");

    React.useEffect(() => {
        if (!isOpen || person) return;
        const controller = new AbortController();
        const t = setTimeout(async () => {
            const { authHeaders: h, excludeUserIds: ex, currentUserId: me } = latest.current;
            const found = await searchPeople({
                apiBaseUrl, communityTag, query,
                excludeUserIds: [...ex, ...(me ? [me] : [])],
                currentUserId: me, headers: h(), signal: controller.signal,
            });
            setResults(found);
        }, 220);
        return () => { clearTimeout(t); controller.abort(); };
    }, [isOpen, person, query, apiBaseUrl, communityTag, excludeKey]);

    const pctNumber = Number(pct);
    const pctValid = pct !== "" && Number.isFinite(pctNumber) && pctNumber > 0 && pctNumber < 100;
    const canSubmit = !!person && pctValid && !busy;

    const submit = async () => {
        if (!canSubmit || !person) return;
        setBusy(true);
        setError(null);
        try {
            await onInvite({
                ownerUserId: person.id,
                // Stored as a fraction, which is how the backend keeps it.
                commissionPct: pctNumber / 100,
                label: label.trim() || null,
            });
            onClose();
        } catch (e: any) {
            setError(e?.message || "Could not send that invite. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    const perSale = priceCents != null && pctValid
        ? formatMoney(Math.round(priceCents * (pctNumber / 100)), currency)
        : null;

    return (
        <ActionModalShell
            title="Invite someone to promote this"
            subtitle="They share a link, you stay the seller, and they earn a share of each sale."
            isOpen={isOpen}
            onClose={onClose}
            footer={
                <div className="mui-referrals__modalFooter">
                    <button type="button" className="mui-btn mui-btn--secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="mui-btn mui-btn--primary" onClick={() => void submit()} disabled={!canSubmit}>
                        {busy ? "Inviting…" : "Send invite"}
                    </button>
                </div>
            }
        >
            <div className="mui-referrals__form">
                <label className="mui-referrals__field">
                    <span className="mui-referrals__fieldLabel">Person</span>
                    {person ? (
                        <div className="mui-referrals__chosen">
                            <span>{person.name || person.usertag || "This person"}</span>
                            <button type="button" className="mui-btn mui-btn--ghost mui-btn--sm"
                                    onClick={() => { setPerson(null); setQuery(""); }}>
                                Change
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                className="mui-input"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name or handle"
                                autoComplete="off"
                            />
                            {query.trim().length >= minQueryLength(communityTag) ? (
                                <ul className="mui-referrals__results">
                                    {results.length === 0 ? (
                                        <li className="mui-referrals__noResults">Nobody found.</li>
                                    ) : results.map((r) => (
                                        <li key={r.id}>
                                            <button type="button" className="mui-referrals__result"
                                                    onClick={() => setPerson(r)}>
                                                {r.name || r.usertag || r.id}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </>
                    )}
                </label>

                <label className="mui-referrals__field">
                    <span className="mui-referrals__fieldLabel">Commission</span>
                    <span className="mui-referrals__pctWrap">
                        <input
                            className="mui-input"
                            value={pct}
                            onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="decimal"
                            placeholder="10"
                            aria-describedby="mui-referral-pct-hint"
                        />
                        <span aria-hidden="true">% of each {singular(unit)}</span>
                    </span>
                    <span id="mui-referral-pct-hint" className="mui-referrals__hint">
                        Comes out of your share. Cobuntu takes 0% of it.
                        {perSale ? ` At this price that is ${perSale} to them per ${singular(unit)}.` : ""}
                    </span>
                </label>

                <label className="mui-referrals__field">
                    <span className="mui-referrals__fieldLabel">Label (optional)</span>
                    <input className="mui-input" value={label} onChange={(e) => setLabel(e.target.value)}
                           placeholder="Newsletter partner" />
                    <span className="mui-referrals__hint">Only you see this.</span>
                </label>

                {/*
                  * The person's payout status is not known here -- the API
                  * decides it -- so this is stated as a condition rather than a
                  * fact about them. An owner who reads it still learns the rule
                  * before they commit, which is the point.
                  */}
                <p className="mui-referrals__note">
                    If they have not connected a payout account yet, the invite is still sent,
                    but the link stays off and records nothing until they do.
                </p>

                {error ? <p role="alert" className="mui-referrals__error">{error}</p> : null}
            </div>
        </ActionModalShell>
    );
}

/** "tickets" -> "ticket". Good enough for the three nouns this takes. */
function singular(plural: string): string {
    return plural.endsWith("s") ? plural.slice(0, -1) : plural;
}
