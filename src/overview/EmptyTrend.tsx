import type { OverviewStats } from "./types";
import { emptyTrendSpan, type OverviewRange } from "./format";

/**
 * The trend's place before there is a trend: fewer than two weeks of data.
 *
 * A ghost of the chart that is coming, in TrendChart's own frame: the same
 * box, the same three gridlines (faint, the inner two dashed) and the same
 * week labels along the bottom for the range picked, with a short message in
 * the middle. It replaced a bare dashed box with one sentence in it, which
 * read as something missing rather than something on its way.
 *
 * It deliberately draws NO line. A flat line along the floor reads as a
 * measured result ("nothing happened") rather than as no data, which is the
 * same reason TrendChart refuses to draw an earnings line before a sale.
 */

/* TrendChart's drawing space, so the gridlines sit where its own do. */
const W = 600;
const H = 200;

export function EmptyTrend({
    weekly, range, locale = "en-GB", t, now,
}: {
    weekly: OverviewStats["weekly"];
    range: OverviewRange;
    locale?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** For tests: the day the axis counts back from when there is no data. */
    now?: Date;
}) {
    const span = emptyTrendSpan(weekly ?? [], range, now);
    const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });

    return (
        <figure
            data-testid="overview-empty-trend"
            className="m-0 flex h-full min-h-[200px] flex-col rounded-xl border border-zinc-200/70 bg-white p-4"
        >
            <figcaption className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-400">
                {t("overviewTrendTitle")}
            </figcaption>

            <div className="relative mt-2 min-h-[120px] flex-1">
                {/* Where TrendChart keeps its value scale: kept empty so the plot lines up. */}
                <div className="absolute inset-y-0 left-9 right-0">
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
                        {[0, 0.5, 1].map((g) => (
                            <line
                                key={g}
                                x1="0" y1={H * g} x2={W} y2={H * g}
                                className={g === 1 ? "stroke-zinc-200" : "stroke-zinc-100"}
                                strokeWidth="1"
                                strokeDasharray={g === 1 ? undefined : "4 5"}
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                    </svg>
                </div>
                <div className="absolute inset-y-0 left-9 right-0 flex items-center justify-center p-3">
                    <div className="max-w-[280px] rounded-lg bg-white/90 px-3 py-2 text-center">
                        <p className="m-0 text-[13.5px] font-semibold text-zinc-700">{t("overviewTrendEmptyTitle")}</p>
                        <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-zinc-500">{t("overviewTrendEmptyBody")}</p>
                    </div>
                </div>
            </div>

            <div className="ml-9 mt-1.5 flex justify-between text-[10.5px] text-zinc-400" aria-hidden="true">
                <span>{shortDate(span.from)}</span>
                <span>{shortDate(span.to)}</span>
            </div>
        </figure>
    );
}
