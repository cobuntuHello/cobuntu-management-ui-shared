import * as React from "react";
import { ActionModalShell } from "../ui/ActionModalShell";
import { searchPeople, minQueryLength } from "../lib/searchPeople";
import type { PersonSearchResult } from "../lib/searchPeople";
import { formatMoney } from "../overview/format";
import { useSharedT } from "../i18n";

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
    // Every word through the host's translations (shared.managementUi.referrals);
    // a host that mounts no copy provider gets the package's English.
    const t = useSharedT("shared.managementUi.referrals");

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
            setError(e?.message || t("inviteFailed"));
        } finally {
            setBusy(false);
        }
    };

    const perSale = priceCents != null && pctValid
        ? formatMoney(Math.round(priceCents * (pctNumber / 100)), currency)
        : null;

    const ink = "var(--text-color, #18181b)";
    const muted = "color-mix(in srgb, var(--text-color, #18181b) 58%, transparent)";
    const soft = "color-mix(in srgb, var(--text-color, #18181b) 7%, transparent)";
    const label12 = "mb-1.5 block text-[12px] font-semibold";
    const field = "flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5";
    const priceShown = priceCents != null ? formatMoney(priceCents, currency) : null;

    return (
        <ActionModalShell
            title={t("inviteTitle")}
            subtitle={t("inviteSubtitle")}
            isOpen={isOpen}
            onClose={onClose}
            footer={
                <div className="flex w-full gap-2">
                    <button type="button" onClick={onClose} disabled={busy}
                        className="h-10 flex-1 cursor-pointer rounded-[var(--button-radius,12px)] text-[13.5px] font-semibold"
                        style={{ background: "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)", color: ink }}>
                        {t("cancel")}
                    </button>
                    <button type="button" onClick={() => void submit()} disabled={!canSubmit}
                        className="h-10 flex-[2] cursor-pointer rounded-[var(--button-radius,12px)] text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: "var(--brand-color, #18181b)" }}>
                        {busy ? t("inviting") : t("sendInvite")}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div>
                    <span className={label12} style={{ color: muted }}>{t("person")}</span>
                    {person ? (
                        <div className={field} style={{ background: soft }}>
                            <span className="text-[13.5px] font-semibold" style={{ color: ink }}>
                                {person.name || person.usertag || t("thisPerson")}
                                {person.usertag && person.name ? <span className="ml-1.5 font-normal" style={{ color: muted }}>@{person.usertag}</span> : null}
                            </span>
                            <button type="button" className="cursor-pointer text-[12.5px] font-semibold" style={{ color: ink }}
                                    onClick={() => { setPerson(null); setQuery(""); }}>
                                {t("change")}
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("searchPlaceholder")}
                                autoComplete="off"
                                aria-label={t("person")}
                                className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none"
                                style={{ background: soft, color: ink }}
                            />
                            {query.trim().length >= minQueryLength(communityTag) ? (
                                <ul className="mt-1.5 overflow-hidden rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)" }}>
                                    {results.length === 0 ? (
                                        <li className="px-3.5 py-2.5 text-[13px]" style={{ color: muted }}>{t("nobodyFound")}</li>
                                    ) : results.map((r) => (
                                        <li key={r.id}>
                                            <button type="button" onClick={() => setPerson(r)}
                                                className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] hover:bg-[color-mix(in_srgb,var(--text-color,#18181b)_5%,transparent)]"
                                                style={{ color: ink }}>
                                                {r.name || r.usertag || r.id}
                                                {r.usertag && r.name ? <span style={{ color: muted }}>@{r.usertag}</span> : null}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </>
                    )}
                </div>

                <div>
                    <label htmlFor="mui-referral-pct" className={label12} style={{ color: muted }}>{t("theirShare")}</label>
                    {/* A text box, no spinner (same as the discount amount box). */}
                    <div className={field} style={{ background: soft }}>
                        <input
                            id="mui-referral-pct"
                            value={pct}
                            onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="decimal"
                            placeholder="10"
                            aria-describedby="mui-referral-pct-hint"
                            className="min-w-0 flex-1 bg-transparent text-[13.5px] tabular-nums outline-none"
                            style={{ color: ink }}
                        />
                        <span aria-hidden="true" className="text-[12.5px]" style={{ color: muted }}>{t("pctOfEach", { unit })}</span>
                    </div>
                    <p id="mui-referral-pct-hint" className="mt-1.5 text-[12px]" style={{ color: muted }}>
                        {t("shareHint")}
                    </p>
                    {perSale ? (
                        <p className="mt-1 text-[12.5px] font-medium" style={{ color: "#147a4b" }}>
                            {priceShown
                                ? t("earnPerPrice", { unit, amount: perSale, price: priceShown })
                                : t("earnPer", { unit, amount: perSale })}
                        </p>
                    ) : null}
                </div>

                <div>
                    <label htmlFor="mui-referral-label" className={label12} style={{ color: muted }}>{t("labelOptional")}</label>
                    <input id="mui-referral-label" value={label} onChange={(e) => setLabel(e.target.value)}
                        placeholder={t("labelPlaceholder")}
                        className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none"
                        style={{ background: soft, color: ink }} />
                    <p className="mt-1.5 text-[12px]" style={{ color: muted }}>{t("onlyYou")}</p>
                </div>

                {/* Stated as a condition: the API decides the person's payout status. */}
                <p className="rounded-xl px-3 py-2.5 text-[12px]" style={{ background: soft, color: muted }}>
                    {t("payoutNote")}
                </p>

                {error ? <p role="alert" className="text-[12.5px]" style={{ color: "#b42318" }}>{error}</p> : null}
            </div>
        </ActionModalShell>
    );
}

