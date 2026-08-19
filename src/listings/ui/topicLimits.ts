/**
 * The server's limits, restated for the composer.
 *
 * Duplicated deliberately rather than fetched: they are constants, not
 * configuration, and a round trip to learn how long a sentence may be would
 * delay the first keystroke to save nothing. The AUTHORITY is
 * `shared/listings/topicLimits.ts` in core -- these must match it, and the
 * server refuses independently if they ever drift, so a stale copy here costs a
 * rejected post rather than a bad write.
 */
export const TOPIC_LIMITS = {
    subject: 120,
    body: 4000,
    comment: 4000,
} as const;
