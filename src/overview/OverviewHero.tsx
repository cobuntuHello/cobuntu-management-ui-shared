import { useState, type ReactNode } from "react";
import type { OverviewStats } from "./types";
import { TrendChart, hasTrend } from "./TrendChart";
import { sliceRange, type OverviewRange } from "./format";

type T = (key: string, vars?: Record<string, string | number>) => string;

const RANGES: Array<{ key: OverviewRange; label: string }> = [
    { key: "4", label: "overviewRange4" },
    { key: "11", label: "overviewRange11" },
    { key: "all", label: "overviewRangeAll" },
];

/**
 * What you keep, and the shape of how it is going, in one card.
 *
 * The big number is the answer a seller opens this page for, so it leads. The
 * trend sits beside it and can be sliced to the last 4 or 11 weeks or all time;
 * the slice is made here from the series the API already returns (all of it),
 * so changing range costs no request.
 *
 * `money` is rendered by the caller (it differs by who is looking), this owns
 * only the frame, the range control and the chart.
 */
export function OverviewHero({
    label, value, sub, details, weekly, currency, locale, t,
}: {
    label: string;
    value: string;
    sub?: ReactNode;
    /** The held / due / paid lines, or whatever stands under the figure. */
    details?: ReactNode;
    weekly: OverviewStats["weekly"];
    currency: string;
    locale: string;
    t: T;
}) {
    const [range, setRange] = useState<OverviewRange>("11");
    const shown = sliceRange(weekly, range);

    return (
        <div className="grid gap-5 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-5 sm:p-7 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-8">
            <div className="flex flex-col justify-between gap-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.1em] text-zinc-500">{label}</p>
                    <p className="mt-2 text-[44px] font-bold leading-none tracking-tight tabular-nums text-emerald-800 sm:text-[52px]">{value}</p>
                    {sub ? <div className="mt-2 text-[13.5px] leading-snug text-zinc-500">{sub}</div> : null}
                </div>
                {details}
            </div>

            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex justify-end">
                    <div role="group" aria-label={t("overviewTrendTitleViews")} className="inline-flex rounded-full bg-zinc-200/70 p-0.5 text-[12.5px] font-semibold">
                        {RANGES.map((r) => (
                            <button
                                key={r.key}
                                type="button"
                                aria-pressed={range === r.key}
                                onClick={() => setRange(r.key)}
                                className={`cursor-pointer rounded-full px-3 py-1.5 transition-colors ${range === r.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                            >
                                {t(r.label)}
                            </button>
                        ))}
                    </div>
                </div>
                {hasTrend(shown) ? (
                    <TrendChart weekly={shown} currency={currency} locale={locale} t={t} />
                ) : (
                    <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-[13px] text-zinc-400">
                        {t("overviewTrendTooEarly")}
                    </div>
                )}
            </div>
        </div>
    );
}
