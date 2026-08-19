import { useId, useState } from "react";
import type { OverviewStats } from "./types";
import { formatMoney } from "./format";

/**
 * Views and earnings over time.
 *
 * ── Why this is not a bar chart any more ────────────────────────────────────
 *
 * The data was right and the drawing was wrong. Thirteen thin grey bars, spaced
 * out across a tall white box, gave a page of small numbers (1 to 8 views a
 * week) the visual weight of a stock chart and none of the legibility: no axis
 * to read a value against, no shape to read a direction from, and half the
 * figure empty. Sparse bars are for comparing a handful of named things, not
 * for a series of thirteen weeks.
 *
 * A filled area reads as a QUANTITY OVER TIME, which is what this is. The
 * silhouette carries the answer -- climbing, peaking, drying up -- before any
 * number is read, and the same thirteen points fill the space instead of
 * rattling around in it.
 *
 * ── How it is put together ──────────────────────────────────────────────────
 *
 * The plot is an SVG stretched to whatever box it is given
 * (`preserveAspectRatio="none"`), and every label is HTML positioned around it.
 * That split is what lets the figure match the height of the tiles beside it
 * exactly: an SVG that contained its own text could not be stretched without
 * distorting the letters. Strokes carry `vector-effect="non-scaling-stroke"` so
 * they stay the width they were drawn at whatever the box does.
 *
 * ── What it refuses to draw ─────────────────────────────────────────────────
 *
 * An earnings line when nothing has sold. A flat line along the floor reads as
 * a measured result rather than as no data, and it puts the loudest mark on the
 * page under the series the seller did not ask about.
 *
 * A single point, too: one week is not a trend, and a chart with one dot invites
 * a reading the data does not support.
 */

/* An arbitrary drawing space; the SVG is stretched to its container. */
const W = 600;
const H = 200;

export function hasTrend(weekly: OverviewStats["weekly"]): boolean {
    return (weekly?.length ?? 0) >= 2;
}

/** A round top a person would pick: 5, 10, 25, 50, 100… */
function niceTop(max: number): number {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 2, 2.5, 5, 10]) {
        if (max <= m * pow) return m * pow;
    }
    return 10 * pow;
}

export function TrendChart({
    weekly, currency = "EUR", locale = "en-GB", t,
}: {
    weekly: OverviewStats["weekly"];
    currency?: string;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const uid = useId().replace(/:/g, "");
    const [hover, setHover] = useState<number | null>(null);

    if (!hasTrend(weekly)) return null;

    const earned = weekly.some((w) => w.net > 0);
    const viewTop = niceTop(Math.max(...weekly.map((w) => w.views)));
    const netTop = niceTop(Math.max(...weekly.map((w) => w.net)));

    const step = W / (weekly.length - 1);
    const x = (i: number) => i * step;
    const yv = (v: number) => H - (v / viewTop) * H;
    const yn = (v: number) => H - (v / netTop) * H;

    const line = (fn: (w: OverviewStats["weekly"][0]) => number) =>
        weekly.map((w, i) => `${x(i).toFixed(1)},${fn(w).toFixed(1)}`).join(" ");
    const viewsLine = line((w) => yv(w.views));
    const viewsArea = `M0,${H} L${viewsLine.replace(/ /g, " L")} L${W},${H} Z`;

    const shortDate = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
    const shown = hover !== null ? weekly[hover] : weekly[weekly.length - 1];

    /* Three gridlines: floor, middle, top. More is noise at this size. */
    const grid = [0, 0.5, 1];

    return (
        <figure className="m-0 flex h-full flex-col rounded-xl border border-zinc-200/70 bg-white p-4">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">
                    {earned ? t("overviewTrendTitle") : t("overviewTrendTitleViews")}
                </span>
                <span className="text-[12px] text-zinc-500">
                    {t("overviewTrendWeeks", { count: weekly.length })}
                </span>
            </figcaption>

            {/*
              * The readout sits ABOVE the plot rather than in a floating
              * tooltip: a tooltip follows the pointer across the very weeks you
              * are comparing against, and on touch it never appears at all.
              * This holds the latest week by default and swaps as you move.
              */}
            <div className="mt-1.5 flex min-h-[20px] flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
                <span className="text-[12.5px] font-semibold text-zinc-900">{shortDate(shown.week)}</span>
                <span className="text-[12.5px] text-zinc-600">
                    <span className="font-semibold text-sky-700">{shown.views}</span>{" "}
                    {t("overviewViews").toLowerCase()}
                </span>
                <span className="text-[12.5px] text-zinc-600">
                    <span className="font-semibold">{shown.sold}</span> {t("overviewSold").toLowerCase()}
                </span>
                {earned && (
                    <span className="text-[12.5px] text-zinc-600">
                        <span className="font-semibold text-amber-700">
                            {formatMoney(shown.net, currency, locale)}
                        </span>
                    </span>
                )}
            </div>

            {/*
              * flex-1 with min-h-0 is what makes the figure exactly as tall as
              * whatever sits beside it: the plot absorbs the leftover height
              * instead of demanding its own.
              */}
            <div className="relative mt-2 min-h-[120px] flex-1">
                {/* The views scale, in HTML so it never distorts. */}
                <div className="pointer-events-none absolute inset-y-0 left-0 flex w-9 flex-col justify-between">
                    {[viewTop, viewTop / 2, 0].map((v) => (
                        <span key={v} className="text-[10px] leading-none text-zinc-400 tabular-nums">
                            {Math.round(v)}
                        </span>
                    ))}
                </div>

                <div className="absolute inset-y-0 left-9 right-0">
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        preserveAspectRatio="none"
                        className="h-full w-full overflow-visible"
                        role="img"
                        aria-label={t("overviewTrendAria", {
                            weeks: weekly.length,
                            latest: formatMoney(weekly[weekly.length - 1].net, currency, locale),
                        })}
                        onMouseLeave={() => setHover(null)}
                    >
                        <defs>
                            <linearGradient id={`v${uid}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity=".28" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity=".02" />
                            </linearGradient>
                        </defs>

                        {grid.map((g) => (
                            <line
                                key={g}
                                x1="0" y1={H * g} x2={W} y2={H * g}
                                className={g === 1 ? "stroke-zinc-200" : "stroke-zinc-100"}
                                strokeWidth="1"
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}

                        {/* Views: the quantity, as a filled area. */}
                        <g className="text-sky-600">
                            <path d={viewsArea} fill={`url(#v${uid})`} />
                            <polyline
                                points={viewsLine}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        </g>

                        {/* Earnings on their own scale, only once there are any. */}
                        {earned && (
                            <polyline
                                points={line((w) => yn(w.net))}
                                fill="none"
                                className="stroke-amber-700"
                                strokeWidth="2.25"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}

                        {/*
                          * A sale is an EVENT, not a level: a dot on the week it
                          * happened says more than a second area would, and on a
                          * product that sells once a fortnight it is the only
                          * mark that would otherwise be invisible.
                          */}
                        {weekly.map((w, i) =>
                            w.sold > 0 ? (
                                <circle
                                    key={`s${w.week}`}
                                    cx={x(i)} cy={earned ? yn(w.net) : yv(w.views)} r="4"
                                    className="fill-amber-700 stroke-white"
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ) : null,
                        )}

                        {hover !== null && (
                            <>
                                <line
                                    x1={x(hover)} y1="0" x2={x(hover)} y2={H}
                                    className="stroke-zinc-300"
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                />
                                <circle
                                    cx={x(hover)} cy={yv(weekly[hover].views)} r="4"
                                    className="fill-sky-600 stroke-white"
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </>
                        )}

                        {/*
                          * Full-height hit columns. Hovering a 2px line is
                          * impossible; hovering its column is not.
                          */}
                        {weekly.map((w, i) => (
                            <rect
                                key={`h${w.week}`}
                                x={x(i) - step / 2} y="0" width={step} height={H}
                                fill="transparent"
                                onMouseEnter={() => setHover(i)}
                                onTouchStart={() => setHover(i)}
                            />
                        ))}
                    </svg>
                </div>
            </div>

            <div className="ml-9 mt-1.5 flex justify-between text-[10.5px] text-zinc-400">
                <span>{shortDate(weekly[0].week)}</span>
                <span>{shortDate(weekly[weekly.length - 1].week)}</span>
            </div>

            {!earned && (
                <p className="mt-1 text-[11.5px] text-zinc-500">{t("overviewTrendNoEarningsYet")}</p>
            )}
        </figure>
    );
}
