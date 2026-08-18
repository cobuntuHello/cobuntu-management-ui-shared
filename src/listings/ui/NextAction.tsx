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
 *
 * ── Why it counts topics ────────────────────────────────────────────────────
 *
 * From the MVP, and the reasoning is why the old chips went: two of the three
 * stage labels were unreachable in practice, because a listing with open topics
 * is always in the middle one. The only progress that actually moves here is
 * how many topics are still open — countable, changing as you work, and needing
 * no glossary.
 *
 * So when topics are open they LEAD, because they are what is blocking; the
 * turn sentence drops to the body line, where it says who is holding it. With
 * none open the banner is exactly what it was before.
 */
export function NextAction({
    state,
    viewer,
    communityName,
    sellerName,
    lastProposalFrom,
    openTopics = 0,
    totalTopics = 0,
    t,
}: {
    state: string | null;
    viewer: "owner" | "leader";
    communityName: string;
    sellerName?: string | null;
    /** Who spoke last, when anyone has. Decides whose move it is mid-negotiation. */
    lastProposalFrom?: "owner" | "leader" | null;
    /** Topics still open, and how many there have ever been. */
    openTopics?: number;
    totalTopics?: number;
    t?: (key: string, vars?: Record<string, unknown>) => string;
}) {
    const label = (k: string, fallback: string) => (t ? t(k) : fallback);
    const say = (k: string, vars: Record<string, unknown>, fallback: string) => (t ? t(k, vars) : fallback);
    const other = viewer === "leader" ? (sellerName || label("theSeller", "the seller")) : communityName;

    const settledTopics = Math.max(0, totalTopics - openTopics);

    if (state === "ACTIVE") {
        return (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
                <p className="text-[19px] font-bold tracking-tight text-emerald-900">
                    {label("settledTitle", "You both shook on it")}
                </p>
                <p className="mt-1 text-[13.5px] text-emerald-800">
                    {/*
                      * What it took to get here, when it took anything. A live
                      * listing that was argued over and one that sailed through
                      * are different histories, and the count is the only trace
                      * of the difference left on this screen.
                      */}
                    {totalTopics > 0
                        ? say(totalTopics === 1 ? "settledBodyWithTopics" : "settledBodyWithTopicsPlural",
                              { community: communityName, count: totalTopics },
                              `Live in ${communityName}, with ${totalTopics} topic${totalTopics === 1 ? "" : "s"} settled along the way.`)
                        : label("settledBody", `Live in ${communityName}.`)}
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
            {/*
              * Progress you can count, rather than a stage name. Rendered above
              * the headline because it is the frame the sentence sits in: "2 of
              * 5 settled" tells you where you are, the sentence tells you what
              * to do about it.
              */}
            {totalTopics > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Dots open={openTopics} closed={settledTopics} />
                    <span className="text-[12px] font-semibold text-[var(--ink-3)]">
                        {say("topicsProgress", { closed: settledTopics, total: totalTopics },
                             `${settledTopics} of ${totalTopics} settled`)}
                    </span>
                </div>
            )}

            <p className="text-[18px] font-bold leading-snug tracking-tight text-[var(--ink)] sm:text-[20px]">
                {openTopics > 0
                    ? say(openTopics === 1 ? "topicsOpenHeadline" : "topicsOpenHeadlinePlural",
                          { count: openTopics },
                          `${openTopics} topic${openTopics === 1 ? "" : "s"} still open`)
                    : mine
                        ? label("turnMine", "Your turn")
                        : say("turnTheirs", { other }, `${other} is on it`)}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                {/*
                  * With topics open the turn does not vanish, it demotes: the
                  * count says what is blocking and this line says who is holding
                  * it. Dropping the turn entirely would leave two people both
                  * waiting for the other to work through the same list.
                  */}
                {openTopics > 0
                    ? mine
                        ? viewer === "leader"
                            ? label("topicsOpenLeaderBody", "Work through them with them, then answer the terms below.")
                            : label("topicsOpenOwnerBody", "Work through them, then take another look at the terms below.")
                        : say("topicsOpenWaitBody", { other }, `${other} is working through them.`)
                    : mine
                        ? viewer === "leader"
                            ? label("turnLeaderBody", "This request is waiting on you. Agree the terms below, or propose different ones.")
                            : label("turnOwnerBody", "They have answered. Take a look at the terms below.")
                        : label("turnWaitBody", `Nothing for you to do until ${other} answers. Their reply shows up below.`)}
            </p>
        </div>
    );
}

/**
 * Topics as dots — filled once BOTH sides have closed one.
 *
 * A bar would imply a fixed length; the number of topics is not known in
 * advance and grows as people raise things, so a row of dots that gets longer
 * is the honest shape. Capped so a heavily-argued listing does not draw a
 * hundred of them: past the cap the count beside it carries the number, which
 * it does anyway.
 */
function Dots({ open, closed }: { open: number; closed: number }) {
    const total = open + closed;
    if (total === 0) return null;
    const CAP = 12;
    const shown = Math.min(total, CAP);
    const shownClosed = Math.round((closed / total) * shown);
    return (
        <span className="flex items-center gap-1">
            {Array.from({ length: shown }, (_, i) => (
                <span
                    key={i}
                    className={`size-2.5 rounded-full transition-colors duration-300 ${
                        i < shownClosed ? "bg-[var(--good)]" : "bg-[var(--warn)]"
                    }`}
                />
            ))}
            {total > CAP && <span className="text-[11px] font-semibold text-[var(--ink-3)]">+{total - CAP}</span>}
        </span>
    );
}
