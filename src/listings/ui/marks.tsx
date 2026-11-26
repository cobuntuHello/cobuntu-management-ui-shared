/**
 * The brand marks this panel draws beside money.
 *
 * ── Why they live here ──────────────────────────────────────────────────────
 *
 * The listing panel is mounted by BOTH apps, so it cannot reach into either
 * one's components folder for a logo. These are the canonical SVGs, copied
 * from the backoffice (`components/CobuntuMark.tsx`, `components/BrandIcons.tsx`)
 * so the shared panel has them too.
 *
 * That is a second copy, and a second copy of a brand mark is exactly the kind
 * of thing that drifts. The right end state is the apps importing these from
 * here and deleting their own; this is the first half of that move, not the
 * finished state.
 *
 * ── Why real marks and not letters ──────────────────────────────────────────
 *
 * They shipped for one release as monograms -- a "C" and an "S" in coloured
 * circles -- on the reasoning that a wrong logo is worse than an honest letter.
 * That reasoning was sound and the conclusion was still wrong, because the
 * assets existed: the Cobuntu ring was in the backoffice all along and so was
 * Stripe's wordmark glyph. "I could not find it" is not the same fact as "it
 * does not exist", and only one of them justifies drawing a letter instead.
 */

/**
 * Cobuntu's mark: the open copper ring and its two slate dots.
 *
 * Traced from the live asset (https://cobuntu.com/icon.png, 512 x 512), not
 * redrawn from memory: the copy this replaced (from the backoffice) had the
 * big dot in sand and the ring's opening in the wrong place, and the user
 * spotted it at a glance. Ring: centre 277,263, radius 185, stroke 37, round
 * caps, open between 21 and 70 degrees (bottom right). Big dot 78.5,92 r 47.5
 * outside its top left; small dot 426,409 r 13.5 in the opening. Copper
 * #C68346, slate #4A5260.
 */
export function CobuntuMark({ size = 20 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 512 512"
            fill="none"
            role="img"
            aria-label="Cobuntu"
        >
            <path
                d="M340.27 436.84A185 185 0 1 1 449.71 329.3"
                fill="none"
                stroke="#C68346"
                strokeWidth="37"
                strokeLinecap="round"
            />
            <circle cx="78.5" cy="92" r="47.5" fill="#4A5260" />
            <circle cx="426" cy="409" r="13.5" fill="#4A5260" />
        </svg>
    );
}

/**
 * Stripe's glyph, on their own indigo, in a SQUARE tile.
 *
 * Square because that is the shape Stripe's mark is set in everywhere it
 * appears, including the backoffice's own integrations list. Rounding it into
 * a circle crops the glyph's own proportions and makes it read as a user
 * avatar, which is what it looked like beside the community's and the
 * requester's.
 */
export function StripeMark({ size = 20 }: { size?: number }) {
    return (
        <span
            role="img"
            aria-label="Stripe"
            className="inline-flex items-center justify-center rounded-[5px] bg-[#635BFF] text-white"
            style={{ width: size, height: size }}
        >
            <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
        </span>
    );
}

/**
 * The sale itself: a ticket for an event, a tag for anything else.
 *
 * The top line of the receipt is the one row that is nobody's money yet, and it
 * was the only row with an empty space where every other row has a mark. An
 * indent with nothing in it reads as a mark that failed to load.
 */
export function SaleMark({ kind, size = 20 }: { kind: "product" | "event"; size?: number }) {
    return (
        <span
            className="inline-flex items-center justify-center rounded-[5px] bg-[var(--sunk)] text-[var(--ink-2)]"
            style={{ width: size, height: size }}
            aria-hidden="true"
        >
            <svg
                width={size * 0.6}
                height={size * 0.6}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {kind === "event" ? (
                    /* A ticket: the stub notches are what make it read at 12px. */
                    <>
                        <path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4z" />
                        <path d="M14 6v12" />
                    </>
                ) : (
                    /* A price tag. */
                    <>
                        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z" />
                        <circle cx="7.5" cy="7.5" r="1.5" />
                    </>
                )}
            </svg>
        </span>
    );
}
