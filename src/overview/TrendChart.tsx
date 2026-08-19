import { useId, useState } from "react";
import type { OverviewStats } from "./types";
import { formatMoney } from "./format";

/**
 * Earnings, sales and views over time, drawn as one figure you can read.
 *
 * ── What the first version got wrong ────────────────────────────────────────
 *
 * It drew heavy bars for views, a line for earnings, and no way to read either:
 * no axis, no gridlines, raw ISO dates under the corners, and nothing on hover.
 * On the common case -- traffic but no sales yet -- the earnings line lay flat
 * along the floor, so the loudest thing on the chart was a series the seller had
 * not asked about and the series they had was invisible.
 *
 * ── What it does now ────────────────────────────────────────────────────────
 *
 * 1. A MONEY AXIS with gridlines, so a point has a value and not just a shape.
 * 2. HOVER anywhere: a guide line, the week's date, and all three numbers.
 *    A chart of weekly buckets is useless if you cannot ask "which week was
 *    that?" -- and that is the question this page exists to answer.
 * 3. WHEN NOTHING HAS SOLD, no earnings line at all. A flat line on the floor
 *    is a drawing of a series that does not exist yet; the chart says so in
 *    words and shows the views on their own, which is the real signal at that
 *    stage: people are looking and nobody is buying.
 * 4. Dates a human reads (3 Nov), on the ticks that fit.
 *
 * ── Why the two series keep separate scales ─────────────────────────────────
 *
 * Views are counted in hundreds and early earnings in single euros. One axis
 * flattens whichever is smaller into the floor, and a flattened series reads as
 * "nothing happened" rather than "different units".
 *
 * ── Why hand-drawn SVG ──────────────────────────────────────────────────────
 *
 * A charting library is 40kB+ for a polyline, some rectangles and a hover test
 * on at most a year of weekly points.
 */

const W = 620;
const H = 210;
const PAD_L = 46;   // room for the money labels
const PAD_B = 26;   // room for the dates
const PAD_T = 12;

export function hasTrend(weekly: OverviewStats["weekly"]): boolean {
    return (weekly?.length ?? 0) >= 2;
}

/** A money axis a person would draw: 0, a round middle, a round top. */
function niceTicks(max: number): number[] {
    if (max <= 0) return [0];
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const top = Math.ceil(max / pow) * pow;
    return [0, top / 2, top];
}

export function TrendChart({
    weekly, currency = "EUR", locale = "en-GB", t,
}: {
    weekly: OverviewStats["weekly"];
    currency?: string;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const gradId = useId();
    const [hover, setHover] = useState<number | null>(null);

    if (!hasTrend(weekly)) return null;

    /*
     * "Has this ever earned anything?" decides the whole composition. Below,
     * `earned` false means the money axis and the earnings line are not drawn
     * at all rather than drawn as zero.
     */
    const earned = weekly.some((w) => w.net > 0);
    const maxNet = Math.max(...weekly.map((w) => w.net), 0);
    const maxViews = Math.max(...weekly.map((w) => w.views), 1);
    const ticks = niceTicks(maxNet);
    const netTop = ticks[ticks.length - 1] || 1;

    const plotW = W - PAD_L;
    const plotH = H - PAD_B - PAD_T;
    const step = plotW / (weekly.length - 1);
    const x = (i: number) => PAD_L + i * step;
    const y = (v: number, max: number) => PAD_T + plotH - (max <= 0 ? 0 : (v / max) * plotH);

    const pts = weekly.map((w, i) => `${x(i).toFixed(1)},${y(w.net, netTop).toFixed(1)}`).join(" ");
    const area = `M${PAD_L},${PAD_T + plotH} L${pts.replace(/ /g, " L")} L${W},${PAD_T + plotH} Z`;

    const barW = Math.max(3, Math.min(16, (plotW / weekly.length) * 0.5));
    const shortDate = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

    /* Every other label when the weeks get tight, so they never collide. */
    const labelEvery = weekly.length > 8 ? Math.ceil(weekly.length / 6) : 1;
    const shown = hover !== null ? weekly[hover] : weekly[weekly.length - 1];

    return (
        <figure className="m-0 flex h-full flex-col rounded-xl border border-zinc-200/70 bg-white p-4">
            <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">
                    {earned ? t("overviewTrendTitle") : t("overviewTrendTitleViews")}
                </span>
                <span className="text-[12px] text-zinc-500">
                    {t("overviewTrendWeeks", { count: weekly.length })}
                </span>
            </figcaption>

            {/*
              * The readout lives ABOVE the plot rather than in a floating
              * tooltip: a tooltip that follows the pointer covers the very
              * weeks either side you are comparing against, and on touch there
              * is no hover to summon it at all. Here it holds the latest week
              * by default and swaps as you move.
              */}
            <div className="mb-1 flex min-h-[22px] flex-wrap items-baseline gap-x-4 gap-y-0.5">
                <span className="text-[12.5px] font-semibold text-zinc-900">{shortDate(shown.week)}</span>
                {earned && (
                    <span className="text-[12.5px] text-zinc-600">
                        <span className="font-semibold text-amber-700">
                            {formatMoney(shown.net, currency, locale)}
                        </span>{" "}
                        {t("overviewTrendEarnings")}
                    </span>
                )}
                <span className="text-[12.5px] text-zinc-600">
                    <span className="font-semibold">{shown.sold}</span> {t("overviewSold").toLowerCase()}
                </span>
                <span className="text-[12.5px] text-zinc-600">
                    <span className="font-semibold">{shown.views}</span> {t("overviewViews").toLowerCase()}
                </span>
            </div>

            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full touch-none"
                role="img"
                aria-label={t("overviewTrendAria", {
                    weeks: weekly.length,
                    latest: formatMoney(weekly[weekly.length - 1].net, currency, locale),
                })}
                onMouseLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id={`g${gradId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity=".2" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Money gridlines, only when there is money to grid. */}
                {earned && ticks.map((v) => (
                    <g key={v}>
                        <line
                            x1={PAD_L} y1={y(v, netTop)} x2={W} y2={y(v, netTop)}
                            className={v === 0 ? "stroke-zinc-200" : "stroke-zinc-100"}
                            strokeWidth="1"
                        />
                        <text
                            x={PAD_L - 8} y={y(v, netTop) + 4} textAnchor="end"
                            className="fill-zinc-400" fontSize="10.5"
                        >
                            {formatMoney(v, currency, locale)}
                        </text>
                    </g>
                ))}
                {!earned && (
                    <line
                        x1={PAD_L} y1={PAD_T + plotH} x2={W} y2={PAD_T + plotH}
                        className="stroke-zinc-200" strokeWidth="1"
                    />
                )}

                {/* Views, behind, on their own scale. */}
                {weekly.map((w, i) => {
                    const h = (w.views / maxViews) * plotH;
                    return (
                        <rect
                            key={w.week}
                            x={x(i) - barW / 2}
                            y={PAD_T + plotH - h}
                            width={barW}
                            height={Math.max(h, 0)}
                            rx="2.5"
                            className={hover === i ? "fill-zinc-300" : "fill-zinc-200/80"}
                        />
                    );
                })}

                {earned && (
                    <g className="text-amber-700">
                        <path d={area} fill={`url(#g${gradId})`} />
                        <polyline
                            points={pts}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        {weekly.map((w, i) =>
                            w.net > 0 || i === weekly.length - 1 ? (
                                <circle
                                    key={w.week}
                                    cx={x(i)} cy={y(w.net, netTop)}
                                    r={hover === i ? 5 : 3.5}
                                    fill="currentColor"
                                />
                            ) : null,
                        )}
                    </g>
                )}

                {/* The hovered week's guide. */}
                {hover !== null && (
                    <line
                        x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={PAD_T + plotH}
                        className="stroke-zinc-400" strokeWidth="1" strokeDasharray="3 3"
                    />
                )}

                {weekly.map((w, i) =>
                    i % labelEvery === 0 || i === weekly.length - 1 ? (
                        <text
                            key={w.week}
                            x={x(i)}
                            y={H - 8}
                            textAnchor={i === 0 ? "start" : i === weekly.length - 1 ? "end" : "middle"}
                            className="fill-zinc-400"
                            fontSize="10.5"
                        >
                            {shortDate(w.week)}
                        </text>
                    ) : null,
                )}

                {/*
                  * Invisible full-height hit areas, one per week. Hovering a
                  * 3px-tall bar is impossible; hovering its column is not.
                  */}
                {weekly.map((w, i) => (
                    <rect
                        key={`hit-${w.week}`}
                        x={x(i) - step / 2} y={PAD_T} width={step} height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHover(i)}
                        onTouchStart={() => setHover(i)}
                    />
                ))}
            </svg>

            {!earned && (
                <p className="mt-1.5 text-[12px] text-zinc-500">{t("overviewTrendNoEarningsYet")}</p>
            )}
        </figure>
    );
}
