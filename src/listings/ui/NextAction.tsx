/**
 * What has to happen next, and who is holding it up.
 *
 * ── The labels this replaced ────────────────────────────────────────────────
 *
 * The MVP's note, kept because the reasoning applies here too: an earlier cut
 * showed three chips — "Requested / Talking it out / Live". They read as jargon
 * because they described the SYSTEM's state, not the person's. Nobody asks "am
 * I in Talking it out"; they ask what they have to do and who is waiting on
 * whom.
 *
 * So it says that, in a sentence, from the reader's seat. The panel this
 * replaces got it actively wrong in one direction: it told a LEADER "there is
 * nothing for you to do until they answer" — about themselves, above an
 * Approve button — because it only ever spoke to the seller.
 *
 * ── Turn is derived, not stored ─────────────────────────────────────────────
 *
 * A PENDING listing is waiting on the community; anything else is the seller's
 * to move. There is no `turn` column and there does not need to be — the state
 * and the seat between them answer it, and a stored turn could disagree with
 * the state it is supposed to describe.
 */
export function NextAction({
    state,
    viewer,
    communityName,
    sellerName,
    lastProposalFrom,
    t,
}: {
    state: string | null;
    viewer: "owner" | "leader";
    communityName: string;
    sellerName?: string | null;
    /** Who spoke last, when anyone has. Decides whose move it is mid-negotiation. */
    lastProposalFrom?: "owner" | "leader" | null;
    t?: (key: string, vars?: Record<string, unknown>) => string;
}) {
    const label = (k: string, fallback: string) => (t ? t(k) : fallback);
    const other = viewer === "leader" ? (sellerName || label("theSeller", "the seller")) : communityName;

    if (state === "ACTIVE") {
        return (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
                <p className="text-[19px] font-bold tracking-tight text-emerald-900">
                    {label("settledTitle", "You both shook on it")}
                </p>
                <p className="mt-1 text-[13.5px] text-emerald-800">
                    {label("settledBody", `Live in ${communityName}.`)}
                </p>
            </div>
        );
    }

    if (state !== "PENDING") return null;

    /*
     * Whose move. A request with no reply is the community's; once somebody has
     * countered, it belongs to whoever did NOT speak last. One decision, so the
     * sentence and the button can never disagree.
     */
    const waitingOn: "owner" | "leader" = lastProposalFrom === "leader" ? "owner" : "leader";
    const mine = waitingOn === viewer;

    return (
        <div
            className="mb-5 rounded-2xl border p-4 transition-colors duration-300 sm:p-5"
            style={{
                borderColor: mine ? "color-mix(in srgb, var(--warn) 30%, transparent)" : "var(--line)",
                background: mine ? "var(--warn-w)" : "var(--card)",
            }}
        >
            {/*
              * Explicit colour, not inherited.
              *
              * This read as near-invisible cream on the warm banner: the panel
              * sets the PALETTE at its root but not a text colour, so the
              * heading took whatever the host app happened to give it. Tokens
              * that are only half-applied are worse than none, because the
              * background comes from here and the foreground from somewhere
              * else, and the two have never met.
              */}
            <p className="text-[18px] font-bold leading-snug tracking-tight text-[var(--ink)] sm:text-[20px]">
                {mine ? label("turnMine", "Your turn") : label("turnTheirs", `${other} is on it`)}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                {mine
                    ? viewer === "leader"
                        ? label("turnLeaderBody", "This request is waiting on you. Agree the terms below, or propose different ones.")
                        : label("turnOwnerBody", "They have answered. Take a look at the terms below.")
                    : label("turnWaitBody", `Nothing for you to do until ${other} answers. Their reply shows up below.`)}
            </p>
        </div>
    );
}
