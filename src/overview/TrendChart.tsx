import type { OverviewStats } from "./types";
import { formatMoney } from "./format";

/**
 * Earnings and views over time, drawn as one figure.
 *
 * ── Why both series share a chart ───────────────────────────────────────────
 *
 * The question a seller actually has is whether attention is turning into
 * money. Two separate charts make that a memory exercise; one figure with views
 * behind the earnings line makes a week of heavy traffic and no sales visible
 * at a glance, which is the week worth asking about.
 *
 * ── Why hand-drawn SVG ──────────────────────────────────────────────────────
 *
 * A charting library is 40kB+ on a tab that shows at most a year of weekly
 * points. This is a polyline and some rectangles.
 *
 * ── What it refuses to draw ─────────────────────────────────────────────────
 *
 * A single point, or none. One week is not a trend, and a chart with one dot
 * invites a reading ("flat", "starting") that the data does not support -- so
 * below two points the caller renders nothing and the tiles carry the numbers.
 */

const W = 560;
const H = 150;
const PAD_B = 24;

export function hasTrend(weekly: OverviewStats["weekly"]): boolean {
    return (weekly?.length ?? 0) >= 2;
}

export function TrendChart({
    weekly, currency = "EUR", locale = "en-GB", t,
}: {
    weekly: OverviewStats["weekly"];
    currency?: string;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    if (!hasTrend(weekly)) return null;

    const maxNet = Math.max(...weekly.map((w) => w.net), 1);
    const maxViews = Math.max(...weekly.map((w) => w.views), 1);
    const step = weekly.length > 1 ? W / (weekly.length - 1) : W;

    const y = (v: number, max: number) => (H - PAD_B) - (v / max) * (H - PAD_B - 12);
    const pts = weekly.map((w, i) => `${(i * step).toFixed(1)},${y(w.net, maxNet).toFixed(1)}`).join(" ");
    const area = `M0,${H - PAD_B} L${pts.replace(/ /g, " L")} L${W},${H - PAD_B} Z`;

    const last = weekly[weekly.length - 1];
    const barW = Math.max(2, Math.min(14, (W / weekly.length) * 0.45));

    return (
        <figure className="m-0 rounded-xl border border-zinc-200/70 bg-white p-4">
            <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">
                    {t("overviewTrendTitle")}
                </span>
                <span className="text-[12px] text-zinc-500">
                    {t("overviewTrendWeeks", { count: weekly.length })}
                </span>
            </figcaption>

            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full"
                role="img"
                aria-label={t("overviewTrendAria", {
                    weeks: weekly.length,
                    latest: formatMoney(last.net, currency, locale),
                })}
            >
                <defs>
                    <linearGradient id="cbt-net-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/*
                  * Views sit BEHIND as bars, on their own scale. Sharing an axis
                  * with money would flatten one of them into the floor -- views
                  * are counted in hundreds and earnings in a few euros -- and a
                  * flattened series reads as "nothing happened".
                  */}
                {weekly.map((w, i) => {
                    const h = (w.views / maxViews) * (H - PAD_B - 12);
                    return (
                        <rect
                            key={w.week}
                            x={i * step - barW / 2}
                            y={(H - PAD_B) - h}
                            width={barW}
                            height={Math.max(h, 0)}
                            rx="2"
                            className="fill-zinc-200/70"
                        />
                    );
                })}

                <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} className="stroke-zinc-200" strokeWidth="1" />

                <g className="text-amber-700">
                    <path d={area} fill="url(#cbt-net-fill)" />
                    <polyline
                        points={pts}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <circle cx={(weekly.length - 1) * step} cy={y(last.net, maxNet)} r="4" fill="currentColor" />
                </g>

                <text x="0" y={H - 6} className="fill-zinc-400" fontSize="11">
                    {weekly[0].week}
                </text>
                <text x={W} y={H - 6} textAnchor="end" className="fill-zinc-400" fontSize="11">
                    {last.week}
                </text>
            </svg>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-4 rounded-sm bg-amber-700" />
                    {t("overviewTrendEarnings")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-4 rounded-sm bg-zinc-200" />
                    {t("overviewViews")}
                </span>
            </div>
        </figure>
    );
}
