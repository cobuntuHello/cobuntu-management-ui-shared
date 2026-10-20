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
    sellerName,
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
    sellerName: string;
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
                    /* Gross commission and the slice Cobuntu takes OF it, both named. */
                    const grossCommission = e ? samplePrice! * (rate / 100) : 0;
                    const cobuntuOfCommission = grossCommission - (e?.communityNet ?? 0);
                    /*
                     * Cents that actually add up to the ticket. Rounding the four
                     * rows independently makes them total a cent more than the
                     * line below them says -- see allocateCents.
                     */
                    const cents = e
                        ? allocateCents(samplePrice!, [e.hostKeeps, e.communityNet, e.cobuntuNet, e.stripeAmt])
                        : [0, 0, 0, 0];

                    const s = saleSplit(rate, platformShare, sellerFee);
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
                            className="mx-3 mb-3 grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-3.5 rounded-2xl border border-[var(--line-soft)] bg-[var(--card)] p-4 sm:mx-4 sm:p-5"
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
                                     * The settlement, as a document: who, how much, right
                                     * aligned on one column, ruled off and totalled. The
                                     * total is the point -- it is what makes the four rows
                                     * checkable rather than asserted.
                                     */
                                    <dl className="mt-3.5 overflow-hidden rounded-xl bg-[var(--sunk)] px-3.5 py-1 text-[13.5px]">
                                        {/*
                                          * A RECEIPT: start at what the buyer pays,
                                          * take each party out of it, and land on what
                                          * the seller is left with. The same four
                                          * numbers as before, but as money LEAVING a
                                          * sale rather than four parallel shares of
                                          * one -- which is the order a seller
                                          * experiences it in, and the only order where
                                          * the last line is the answer to the question.
                                          */}
                                        <Row
                                            name={label("offerTicketTotal", "Ticket price")}
                                            amount={money(Math.round(samplePrice! * 100), cur)}
                                        />
                                        <Row
                                            swatch="var(--b-comm)"
                                            name={communityName}
                                            amount={money(cents[1], cur)}
                                            deduct
                                            note={say(
                                                "offerCommissionNote",
                                                {
                                                    rate,
                                                    gross: money(Math.round(grossCommission * 100), cur),
                                                    share: platformShare,
                                                    cut: money(Math.round(cobuntuOfCommission * 100), cur),
                                                    platform: platformName,
                                                },
                                                `${rate}% is ${money(Math.round(grossCommission * 100), cur)}, less ${platformName}'s ${platformShare}% of it (${money(Math.round(cobuntuOfCommission * 100), cur)})`,
                                            )}
                                        />
                                        <Row
                                            swatch="var(--b-cob)"
                                            name={platformName}
                                            amount={money(cents[2], cur)}
                                            deduct
                                        />
                                        {e.stripeAmt > 0 && (
                                            <Row
                                                swatch="var(--b-stripe)"
                                                name={label("spineStripeRow", "Stripe (card processing)")}
                                                amount={money(cents[3], cur)}
                                                deduct
                                            />
                                        )}
                                        {/*
                                          * The bottom line, ruled off the way a till
                                          * receipt rules off its total: a DASHED rule,
                                          * which is the one borrowed mark that says
                                          * "receipt" without turning the card into a
                                          * costume.
                                          */}
                                        <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--ink-3)]/40 py-3">
                                            <dt className="flex items-center gap-2.5 font-semibold text-[var(--ink)]">
                                                <span
                                                    className="h-[7px] w-[7px] flex-none rounded-full"
                                                    style={{ background: "var(--b-keep)" }}
                                                    aria-hidden="true"
                                                />
                                                {sellerRowName}
                                            </dt>
                                            <dd className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">
                                                {money(cents[0], cur)}
                                            </dd>
                                        </div>
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
 * One line of the receipt: who, a dot leader, and the amount in the money
 * column -- with a minus on anything coming OUT of the ticket.
 *
 * The leader dots are the receipt's own device and they earn their place here:
 * three packages are read down a column, and a ruled gap between a long
 * community name and a short amount is what stops the eye landing on the wrong
 * row. Drawn as a dotted border on a flexible spacer rather than repeated
 * characters, so it fills whatever space is left at any width and a screen
 * reader never reads it out.
 *
 * The note sits on its own line beneath the name. Run inline it wraps on a
 * narrow panel and drags the row's dot down with it, leaving a coloured mark
 * orphaned beside the second line -- caught in a render at 390px.
 */
function Row({
    swatch,
    name,
    amount,
    note,
    deduct = false,
}: {
    /** The band this row matches in the meter. The ticket row has none. */
    swatch?: string;
    name: string;
    amount: string;
    note?: string;
    /** Money leaving the sale: shown as a subtraction. */
    deduct?: boolean;
}) {
    return (
        <div className="py-2.5">
            {/* items-start: when a long name wraps, the amount and the dot stay
                on its FIRST line, the way a receipt puts the figure against the
                line it belongs to. Centred, they drift into the gap between the
                two lines and stop belonging to either. */}
            <div className="flex items-start gap-2.5">
                {/* The ticket row has no band in the meter and so no dot, but it
                    keeps the indent or its name will not line up with the rows
                    beneath it. */}
                <span
                    className={`mt-[7px] h-[7px] w-[7px] flex-none${swatch ? " rounded-full" : ""}`}
                    style={swatch ? { background: swatch } : undefined}
                    aria-hidden="true"
                />
                {/* min-w-0, NOT shrink-0: a long community name used to push the
                    amount clean out of the card on a narrow panel -- the row read
                    "PBN | Porto Business Network   -EUR 0.3" with the last digit
                    gone, which on a money card is not a layout nit. It wraps now
                    and the amount is never what gives way. No media query,
                    because the card can be narrow at any viewport. */}
                <dt className="min-w-0 text-[var(--ink)]">{name}</dt>
                <span
                    className="mt-[10px] min-w-[16px] flex-1 border-b border-dotted border-[var(--ink-3)]/45"
                    aria-hidden="true"
                />
                <dd className="ml-auto shrink-0 tabular-nums text-[var(--ink)]">
                    {deduct ? `\u2212${amount}` : amount}
                </dd>
            </div>
            {note && (
                <p className="mt-0.5 pl-[17px] text-[12px] leading-snug text-[var(--ink-3)]">{note}</p>
            )}
        </div>
    );
}

/** One percent, rounded for display without pretending to precision it lacks. */
function round(n: number): number {
    return Math.round(n * 10) / 10;
}
