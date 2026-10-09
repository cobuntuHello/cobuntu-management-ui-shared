import { Card } from "./primitives";
import { saleSplit } from "./DealSpine";

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
 * SAME function the spine uses, so the two can never quote different numbers for
 * the same rate.
 *
 * ── It proposes; it does not approve ────────────────────────────────────────
 *
 * Offering a package files it as a proposal the member still has to accept --
 * the backend will not let a member's paid listing go live on a commission
 * nobody agreed to. So the button says "Offer", not "Apply", and the subtitle
 * says whose turn is next.
 */
export function OfferedPackages({
    packages,
    platformShare = 10,
    sellerFee = null,
    communityName,
    sellerName,
    busy = false,
    onChoose,
    t,
}: {
    packages: { id: string; name: string; description: string | null; rate: number }[];
    platformShare?: number;
    sellerFee?: { rate: number; fixed: number; currency?: string } | null;
    communityName: string;
    sellerName: string;
    busy?: boolean;
    onChoose: (packageId: string) => void;
    t?: (key: string, vars?: Record<string, unknown>) => string;
}) {
    const label = (k: string, fallback: string) => (t ? t(k) : fallback);
    const say = (k: string, vars: Record<string, unknown>, fallback: string) => (t ? t(k, vars) : fallback);
    if (packages.length === 0) return null;
    const platformName = communityName.trim().toLowerCase() === "cobuntu" ? "Platform" : "Cobuntu";

    return (
        <Card className="overflow-hidden text-[var(--ink)]">
            <div className="border-b border-[var(--line-soft)] p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
                    {label("offerTitle", "Set the commission")}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                    {say("offerSubtitle", { seller: sellerName },
                         `Offer ${sellerName} one of these. They confirm it, then you can publish.`)}
                </p>
            </div>
            <ul>
                {packages.map((pkg) => {
                    const rate = Number(pkg.rate);
                    const s = saleSplit(rate, platformShare, sellerFee);
                    return (
                        <li key={pkg.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--line-soft)] p-4 last:border-none sm:p-5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[14px] font-semibold text-[var(--ink)]">{pkg.name}</span>
                                    <span className="text-[13px] font-semibold tabular-nums text-[var(--ink-2)]">{rate}%</span>
                                </div>
                                {pkg.description && (
                                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">{pkg.description}</p>
                                )}
                                {/* The same split the spine draws, in one line. */}
                                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-3)]">
                                    <span className="text-[var(--ink-2)]">{label("spineKeySeller", "You keep")} {round(s.sellerOfSale)}%</span>
                                    {s.communityOfSale > 0 && <> · {communityName} {round(s.communityOfSale)}%</>}
                                    {s.platformOfSale > 0 && <> · {platformName} {round(s.platformOfSale)}%</>}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onChoose(pkg.id)}
                                className="shrink-0 cursor-pointer rounded-lg bg-[var(--commit)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
                            >
                                {say("offerPick", { rate }, `Offer ${rate}%`)}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

/** One percent, rounded for display without pretending to precision it lacks. */
function round(n: number): number {
    return Math.round(n * 10) / 10;
}
