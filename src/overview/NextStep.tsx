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

    /*
     * THE LOOK (24 Nov 2026): the listing page's decision language, not a
     * banner. A white card with a hairline border; the only colour is the
     * status mark, amber for "your move", and its eyebrow. A whole card
     * washed in pale yellow read as a warning sign and fought the page.
     */
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7.5v5.5M12 16.5v.01" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-amber-700">{t("overviewNextStep")}</p>
                        <p className="mt-0.5 text-[16px] font-semibold leading-snug text-zinc-900">
                            {isEvent ? t("overviewNotSellableEvent") : t("overviewNotSellableProduct")}
                        </p>
                        <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-zinc-600">{body}</p>
                    </div>
                </div>
                {(showPublish || onSelfList) && (
                    <div className="flex flex-none flex-col gap-2 sm:flex-row sm:items-center">
                        {onSelfList && (
                            <button
                                type="button"
                                onClick={onSelfList}
                                className="min-h-[44px] cursor-pointer rounded-[var(--button-radius,0.75rem)] border border-zinc-200 bg-white px-4 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                            >
                                {t("overviewSellItMyself")}
                            </button>
                        )}
                        {showPublish && (
                            <button
                                type="button"
                                onClick={onPublish}
                                className="min-h-[44px] cursor-pointer rounded-[var(--button-radius,0.75rem)] bg-[var(--brand-color,#18181b)] px-5 text-[14px] font-semibold text-[var(--brand-contrast,#fff)] transition-opacity hover:opacity-90"
                            >
                                {t("overviewPublishNow")}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
