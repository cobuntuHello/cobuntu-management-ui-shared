import { Card } from "./primitives";
import { saleSplit, euroSplit, money, allocateCents } from "./DealSpine";

/**
 * The packages a leader can offer, laid out on the review page itself.
 *
 * ── Why this is here and not behind a button ────────────────────────────────
 *
 * A member's request arrives with NO commission agreed -- the member names no
 * package (the request body carries only the event), and a community that sells
 * through packages refuses an unnamed rate, so the leader has to pick one before
 * the listing can go live. That choice used to live behind "Propose different
 * terms", two clicks away, which read to a reviewer as "there is nothing here to
 * set" -- the PBN complaint that the packages and the fee split were not
 * visible on the pending request.
 *
 * So when the cut is still open, the leader's options are the page: each
 * published package the member's tier can be offered, with the same split a sale
 * would get, and offering one is a single click. The split is computed with the
 * SAME functions the spine uses, so the two can never quote different numbers
 * for the same rate.
 *
 * ── It proposes; it does not approve ────────────────────────────────────────
 *
 * Offering a package files it as a proposal the member still has to accept --
 * the backend will not let a member's paid listing go live on a commission
 * nobody agreed to. So the button says "Offer", not "Apply", and the subtitle
 * says whose turn is next.
 *
 * ── Euros, not percentages, and why that is not a preference ────────────────
 *
 * This card used to draw a three-way PERCENTAGE bar, and a percentage split of
 * this sale cannot be made to add up. Two of the four deductions carry a FLAT
 * per-sale charge (Cobuntu's member-seller fee is 4% + EUR 0.30, Stripe's is
 * 1.5% + EUR 0.25), and a flat charge has no percentage until you name a price.
 * `saleSplit` silently drops the fixed components for exactly that reason, so
 * the old bar was wrong by an amount that GREW as the ticket got cheaper -- on
 * a EUR 3 sale the missing EUR 0.30 is a tenth of the whole thing.
 *
 * So with a real ticket price the card works the split in money, where every
 * cent sums to the price. The percentage bar survives only as the fallback for
 * when no price is known.
 *
 * ── Three things the old card said that were not true ───────────────────────
 *
 * 1. It showed the community's NET rate (7.6%) under a heading reading 8%,
 *    with nothing to say the two were different things. The gross rate is what
 *    the leader sets and the member agrees to; the net is what arrives after
 *    Cobuntu's share OF it. Both are now named, and the deduction between them
 *    is shown rather than silently applied.
 *
 * 2. It added two unrelated fees together and called the total "Cobuntu":
 *    Cobuntu's cut of the COMMISSION, and Cobuntu's separate fee on the
 *    SELLER'S OWN share. They have different payers and different bases, and
 *    fusing them is why that number barely moved between an 8% package and a
 *    22% one -- the halves move in opposite directions. They are separate rows.
 *
 * 3. Stripe did not appear at all. Cobuntu's member-seller fee is ALL-IN
 *    (feeConstants.ts: "Stripe's processing comes out of it"), so card
 *    processing was real money buried inside the Cobuntu row. It is its own
 *    line now, carved OUT of Cobuntu's -- see euroSplit, which subtracts it, so
 *    naming it cannot double-count it.
 *
 * ── Whose money is "yours" depends on who is reading ────────────────────────
 *
 * The legend said "You keep" on both sides of the same negotiation. On the
 * admin app the reader is the COMMUNITY, so the seller's share is not theirs
 * and the row has to name the seller. `viewer` decides; the seller's name was
 * already a prop here for the subtitle.
 */
export function OfferedPackages({
    packages,
    platformShare = 10,
    sellerFee = null,
    stripeRate,
    stripeFixed,
    samplePrice,
    sampleCurrency,
    communityName,
    communityIconUrl,
    sellerName,
    sellerImageUrl,
    viewer = "seller",
    busy = false,
    onChoose,
    t,
}: {
    packages: { id: string; name: string; description: string | null; rate: number }[];
    /** Cobuntu's cut OF the commission, as a percent. Per community. */
    platformShare?: number;
    /** Cobuntu's all-in fee on the seller's own share. `rate` is a fraction. */
    sellerFee?: { rate: number; fixed: number; currency?: string } | null;
    /** Stripe's estimate, from the same GET /api/config/fees. Fraction + minor units. */
    stripeRate?: number;
    stripeFixed?: number;
    /**
     * A real ticket price in MAJOR units. Given, the card works every package
     * in money on this price. Absent, it falls back to the percentage bar,
     * which cannot show the flat fees -- see the note above.
     */
    samplePrice?: number;
    sampleCurrency?: string;
    communityName: string;
    /** communities.iconUrl, when the community has one. */
    communityIconUrl?: string | null;
    sellerName: string;
    /** requestedBy.profileImage, when they have one. */
    sellerImageUrl?: string | null;
    /** Who is reading. The leader does not "keep" the seller's share. */
    viewer?: "leader" | "seller";
    busy?: boolean;
    onChoose: (packageId: string) => void;
    t?: (key: string, vars?: Record<string, unknown>) => string;
}) {
    const label = (k: string, fallback: string) => (t ? t(k) : fallback);
    const say = (k: string, vars: Record<string, unknown>, fallback: string) => (t ? t(k, vars) : fallback);
    if (packages.length === 0) return null;
    const platformName = communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu";

    /* The seller's row, named for whoever is reading it. */
    const sellerRowName = viewer === "leader"
        ? say("offerSellerKeeps", { seller: sellerName }, `${sellerName} keeps`)
        : label("spineKeySeller", "You keep");

    const cur = sampleCurrency || sellerFee?.currency || "EUR";
    const canWorkEuros = !!samplePrice && samplePrice > 0;

    /*
     * THE EFFECTIVE FLOOR, made visible.
     *
     * When nobody picked a package, the checkout does NOT charge nothing -- it
     * resolves the commission per sale as the LOWEST rate the seller's tier is
     * offered. A review page that says "no cut agreed" quietly bills that floor
     * on every sale. A leader who sees only "nothing agreed" never knows a rate
     * is already in force, and the community silently takes its cheapest
     * arrangement. Naming the floor here is the difference between a leader
     * approving a known 8% and one approving a blank.
     */
    const floorRate = Math.min(...packages.map((p) => Number(p.rate)));
    const floorPkg = packages.find((p) => Number(p.rate) === floorRate) ?? null;

    return (
        <Card className="overflow-hidden text-[var(--ink)]">
            <div className="px-4 pb-1 pt-5 sm:px-5">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                    {label("offerTitle", "Set the commission")}
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                    {say("offerSubtitle", { seller: sellerName },
                         `Offer ${sellerName} one of these. They confirm it, then you can publish.`)}
                </p>
                {floorPkg && (
                    <p className="mt-3 rounded-xl bg-[var(--sunk)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                        {say("offerFloorNote",
                             { community: communityName, rate: floorRate, name: floorPkg.name, seller: sellerName },
                             `Until you set terms, ${communityName} already takes ${floorRate}% on every sale — ${floorPkg.name}, the floor of ${sellerName}'s tier. Offer a package to lock it in or change it.`)}
                    </p>
                )}
            </div>
            <ul>
                {packages.map((pkg) => {
                    const rate = Number(pkg.rate);
                    const isFloor = !!floorPkg && pkg.id === floorPkg.id;
                    const e = canWorkEuros
                        ? euroSplit(
                              samplePrice!, rate, platformShare, sellerFee,
                              stripeRate != null ? { rate: stripeRate, fixed: stripeFixed ?? 0 } : null,
                          )
                        : null;
                    /*
                     * What each party ENDS UP WITH, in cents that sum exactly to
                     * the deductions. The gross-commission scaffolding that used to
                     * live here went with the basis column: the rate a party
                     * charges and the amount it receives are different numbers, and
                     * only the second one belongs in the money column.
                     */
                    const destination = e
                        ? allocateCents(samplePrice! - e.hostKeeps, [e.communityNet, e.cobuntuNet, e.stripeAmt])
                        : [0, 0, 0];
                    /*
                     * The seller's line is the ticket MINUS the rows above it, not
                     * a fifth rounded figure. Rounded on its own it can land a cent
                     * away from what the printed rows actually subtract to, and the
                     * bottom line of a receipt is the one number that has to be
                     * arithmetic the reader can repeat.
                     */
                    const sellerCents = e
                        ? Math.round(samplePrice! * 100) - destination.reduce((a, b) => a + b, 0)
                        : 0;

                    const s = saleSplit(rate, platformShare, sellerFee);
                    /*
                     * ONE BAND PER ROW of the receipt beneath it, in the same
                     * colours as those rows' marks -- seller, community, platform,
                     * Stripe. A bar whose segments do not match the rows under it
                     * is decoration, and it has drifted out of step twice while
                     * this card was being reworked, so it is worth saying: if a
                     * row is added or merged here, this list changes with it.
                     */
                    const bands = e
                        ? [
                              { pct: (e.hostKeeps / samplePrice!) * 100, color: "var(--b-keep)" },
                              { pct: (e.communityNet / samplePrice!) * 100, color: "var(--b-comm)" },
                              { pct: (e.cobuntuNet / samplePrice!) * 100, color: "var(--b-cob)" },
                              { pct: (e.stripeAmt / samplePrice!) * 100, color: "var(--b-stripe)" },
                          ].filter((b) => b.pct > 0.01)
                        : [
                              { pct: s.sellerOfSale, color: "var(--b-keep)" },
                              { pct: s.communityOfSale, color: "var(--b-comm)" },
                              { pct: s.platformOfSale, color: "var(--b-cob)" },
                          ].filter((b) => b.pct > 0);

                    return (
                        <li
                            key={pkg.id}
                            /*
                             * An inset grouped block, the way a phone groups a
                             * section: its own rounded surface with space around
                             * it, rather than a row cut out of a ruled table.
                             * Hairlines between list items is the web idiom that
                             * made this read as a document.
                             */
                            /*
                             * A SECTION, not a card. This was a rounded bordered
                             * box holding another rounded tinted box -- a card
                             * inside a card inside the panel's card, three nested
                             * surfaces to say one thing. The panel is the card;
                             * packages are separated by a rule and by space, which
                             * is enough to tell three of them apart.
                             */
                            className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-4 border-t border-[var(--line)] px-4 py-6 first:border-t-0 sm:px-6"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                                        {pkg.name}
                                    </span>
                                    {/*
                                     * The rate in the body face with tabular figures, not a
                                     * contrasting display serif. This is a number to compare
                                     * down a column of three, not a banner.
                                     */}
                                    <span className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--ink)]">
                                        {rate}
                                        <span className="text-[15px] font-medium text-[var(--ink-3)]">%</span>
                                    </span>
                                    {isFloor && (
                                        /* A quiet marker of fact, not an alert. */
                                        /* A filled chip, which is how a phone marks
                                           state -- but in the muted surface, not an
                                           alert colour. It is a fact, not a warning. */
                                        <span className="rounded-full bg-[var(--sunk)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-2)]">
                                            {label("offerDefaultBadge", "Applies now by default")}
                                        </span>
                                    )}
                                </div>
                                {pkg.description && (
                                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
                                        {pkg.description}
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onChoose(pkg.id)}
                                /* 44px tall: a thumb target, not a text link with a
                                   background. rounded-lg, not a pill: every other
                                   button in this panel (approve, decline, counter,
                                   the header pair) is rounded-lg, and one control
                                   wearing a different shape reads as a different
                                   kind of thing. */
                                className="h-11 shrink-0 cursor-pointer rounded-lg bg-[var(--commit)] px-5 text-[13.5px] font-semibold tabular-nums text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                                {say("offerPick", { rate }, `Offer ${rate}%`)}
                            </button>

                            <div className="col-span-2 min-w-0">
                                {/* One segmented measure, square ends, hairline gaps. */}
                                <div className="flex h-[6px] w-full gap-[2px] overflow-hidden rounded-full">
                                    {bands.map((b, i) => (
                                        <span
                                            key={i}
                                            className="h-full first:rounded-l-full last:rounded-r-full"
                                            style={{ width: `${b.pct}%`, background: b.color, minWidth: "6px" }}
                                        />
                                    ))}
                                </div>

                                {e ? (
                                    /*
                                     * The receipt, on the card's own surface.
                                     *
                                     * It used to sit in a tinted box of its own,
                                     * which is what made three nested surfaces and
                                     * put a beige slab in the middle of a white
                                     * panel. Rules and space do the same work
                                     * without a second background.
                                     */
                                    <dl className="mt-4 text-[13.5px]">
                                        <Line
                                            name={label("offerTicketTotal", "Ticket price")}
                                            amount={money(Math.round(samplePrice! * 100), cur)}
                                            muted
                                        />
                                        {/*
                                          * Three parties, each as its own line, and
                                          * each showing what it RECEIVES. Stripe is
                                          * separate from the platform fee even though
                                          * it is paid out of it -- a leader reading
                                          * "card processing" wants to see the card
                                          * processing, not be told it is folded into
                                          * someone else's number. The note under the
                                          * total carries the one relationship that
                                          * makes these three add up.
                                          */}
                                        <Line
                                            mark={{ src: communityIconUrl, name: communityName, color: "var(--b-comm)" }}
                                            name={communityName}
                                            amount={money(destination[0], cur)}
                                            deduct
                                        />
                                        <Line
                                            mark={{ name: platformName, color: "var(--b-cob)" }}
                                            name={platformName}
                                            amount={money(destination[1], cur)}
                                            deduct
                                        />
                                        {destination[2] > 0 && (
                                            <Line
                                                mark={{ name: "Stripe", color: "var(--b-stripe)" }}
                                                name={label("spineStripeRow", "Stripe (card processing)")}
                                                amount={money(destination[2], cur)}
                                                deduct
                                            />
                                        )}
                                        <div className="mt-1 flex items-center justify-between gap-4 border-t-2 border-[var(--ink)]/15 pt-3">
                                            <dt className="flex min-w-0 items-center gap-2.5 text-[14px] font-semibold text-[var(--ink)]">
                                                <Mark src={sellerImageUrl} name={sellerName} color="var(--b-keep)" />
                                                <span className="min-w-0">{sellerRowName}</span>
                                            </dt>
                                            <dd className="shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--ink)]">
                                                {money(sellerCents, cur)}
                                            </dd>
                                        </div>
                                        {/*
                                          * The rates, once, under the figures they
                                          * explain -- rather than a basis column that
                                          * never matched the amount beside it, which is
                                          * what made "8%" sit next to EUR 0.38 and
                                          * start this whole question.
                                          */}
                                        <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-3)]">
                                            {say("offerBasisNote", {
                                                community: communityName,
                                                rate,
                                                share: platformShare,
                                                platform: platformName,
                                                seller: sellerName,
                                                fee: sellerFee
                                                    ? `${round(sellerFee.rate * 100)}% + ${money(sellerFee.fixed, cur)}`
                                                    : "",
                                            },
                                            `${communityName} charges ${rate}%. ${platformName} takes ${platformShare}% of that, plus ${sellerFee ? `${round(sellerFee.rate * 100)}% + ${money(sellerFee.fixed, cur)}` : "its fee"} of ${sellerName}'s share, and pays Stripe out of it.`)}
                                        </p>
                                    </dl>
                                ) : (
                                    /* No price to work against: percentages, flat fees absent. */
                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--ink-2)]">
                                        {[
                                            { pct: s.sellerOfSale, color: "var(--b-keep)", name: sellerRowName },
                                            { pct: s.communityOfSale, color: "var(--b-comm)", name: communityName },
                                            { pct: s.platformOfSale, color: "var(--b-cob)", name: platformName },
                                        ]
                                            .filter((x) => x.pct > 0)
                                            .map((x, i) => (
                                                <span key={i} className="inline-flex items-center gap-1.5">
                                                    <span
                                                        className="mt-[5px] h-[6px] w-[6px] flex-none"
                                                        style={{ background: x.color }}
                                                    />
                                                    {x.name}{" "}
                                                    <b className="font-semibold tabular-nums text-[var(--ink)]">
                                                        {round(x.pct)}%
                                                    </b>
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

/**
 * The small round mark beside a party's name.
 *
 * A real image where one exists -- the community's `iconUrl`, the requester's
 * `profileImage` -- and a monogram in that row's band colour where one does
 * not. Cobuntu and Stripe deliberately get monograms rather than logos: the
 * Cobuntu brand mark is a WORDMARK set in a font this package does not load,
 * and Stripe's is a trademark that should be their own asset file and not
 * something redrawn from memory. A wrong logo is worse than an honest letter.
 * Swapping either in later is a src on this component and nothing else.
 */
function Mark({
    src,
    name,
    color,
}: {
    src?: string | null;
    name: string;
    color: string;
}) {
    const initial = name.trim().replace(/^[^\p{L}\p{N}]+/u, "")[0]?.toUpperCase() || "?";
    if (src) {
        return (
            <img
                src={src}
                alt=""
                className="h-5 w-5 flex-none rounded-full bg-[var(--sunk)] object-cover"
            />
        );
    }
    return (
        <span
            aria-hidden="true"
            className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: color }}
        >
            {initial}
        </span>
    );
}

/**
 * One line of the receipt: a mark, who it is, and the amount.
 *
 * The figures are right-aligned on a single money column and the rules carry
 * the structure -- no tinted fill, and no basis column: the rate a party
 * CHARGES and the amount it RECEIVES are different numbers, and putting them
 * side by side is what made "8%" sit next to EUR 0.38 and read as a mistake.
 * The rates are stated once, under the total.
 */
function Line({
    mark,
    name,
    amount,
    deduct = false,
    muted = false,
}: {
    /** Absent on the ticket line, which is nobody's money yet. */
    mark?: { src?: string | null; name: string; color: string };
    name: string;
    amount: string;
    /** Money leaving the sale: shown as a subtraction. */
    deduct?: boolean;
    /** The ticket line: a starting point, not a charge. */
    muted?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-3 py-2.5${
                muted ? "" : " border-t border-[var(--line-soft)]"
            }`}
        >
            <dt
                className={`flex min-w-0 items-center gap-2.5 ${
                    muted ? "text-[var(--ink-2)]" : "text-[var(--ink)]"
                }`}
            >
                {mark ? (
                    <Mark src={mark.src} name={mark.name} color={mark.color} />
                ) : (
                    /* Keeps the ticket line's name on the same left edge as the
                       rows under it, which is what makes the column read. */
                    <span className="h-5 w-5 flex-none" aria-hidden="true" />
                )}
                <span className="min-w-0">{name}</span>
            </dt>
            <dd
                className={`shrink-0 tabular-nums ${
                    muted ? "text-[var(--ink-2)]" : "text-[var(--ink)]"
                }`}
            >
                {deduct ? `\u2212${amount}` : amount}
            </dd>
        </div>
    );
}

/** One percent, rounded for display without pretending to precision it lacks. */
function round(n: number): number {
    return Math.round(n * 10) / 10;
}
