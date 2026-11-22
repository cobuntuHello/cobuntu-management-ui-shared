import type { OverviewStats } from "./types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * "Nobody can buy this", as a next step rather than a notice.
 *
 * This replaced a centred amber banner that said the right thing and offered
 * nothing. The words are the same, and so are the three reasons (no listing at
 * all, never published, off the shelf or in review): what changed is that the
 * host who never pressed Publish is now handed the button.
 *
 * ONE ACT, ONE PLACE. The listing request itself still lives once, in the
 * listings section; this card only ever offers PUBLISH (an event that was never
 * published) and the host's own "sell it myself" path. It never carries a second
 * ask for the same listing, which is how the publish control once came to exist
 * in two places and get removed from only one.
 */
export function NextStep({
    stats, isEvent, t, onSelfList, onPublish,
}: {
    stats: OverviewStats;
    isEvent: boolean;
    t: T;
    onSelfList?: () => void;
    /** Opens the host's publish flow. Offered only to an event never published. */
    onPublish?: () => void;
}) {
    const listings = stats.listings ?? [];
    const body = listings.length === 0
        ? t("overviewNoListingsBody")
        : stats.everPublished === false
            ? t("overviewNotPublishedBody")
            : t("overviewNoActiveListingBody");
    // Strictly `=== false`: undefined means the caller did not say (a product,
    // or a backend older than the field).
    const showPublish = !!onPublish && stats.everPublished === false;

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[.1em] text-amber-800">{t("overviewNextStep")}</p>
                    <p className="mt-1.5 text-[19px] font-semibold leading-snug text-zinc-900">
                        {isEvent ? t("overviewNotSellableEvent") : t("overviewNotSellableProduct")}
                    </p>
                    <p className="mt-2 max-w-[56ch] text-[13.5px] leading-relaxed text-zinc-700">{body}</p>
                </div>
                {(showPublish || onSelfList) && (
                    <div className="flex flex-none flex-col gap-2 sm:min-w-[220px]">
                        {showPublish && (
                            <button
                                type="button"
                                onClick={onPublish}
                                className="min-h-[44px] cursor-pointer rounded-[var(--button-radius,0.75rem)] bg-[var(--brand-color,#18181b)] px-5 text-[14px] font-semibold text-[var(--brand-contrast,#fff)] transition-opacity hover:opacity-90"
                            >
                                {t("overviewPublishNow")}
                            </button>
                        )}
                        {onSelfList && (
                            <button
                                type="button"
                                onClick={onSelfList}
                                className="min-h-[44px] cursor-pointer rounded-[var(--button-radius,0.75rem)] bg-white/70 px-5 text-[14px] font-semibold text-zinc-700 transition-colors hover:bg-white"
                            >
                                {t("overviewSellItMyself")}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
