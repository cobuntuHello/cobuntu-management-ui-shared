/**
 * The listing-review palette, from the negotiation MVP.
 *
 * ── Why these values and not neutral greys ──────────────────────────────────
 *
 * The MVP's own note, kept because it is the reason the palette exists: the
 * screen is about MONEY CHANGING HANDS BETWEEN TWO PEOPLE, and a cold clinical
 * ground makes that feel like an invoice system. The paper is warm on purpose.
 * The money bands also need a warm-neutral ground, or the amber and green in
 * them read as warnings rather than as parts of a split.
 *
 * One accent -- near-black -- for anything that COMMITS. Colour is spent almost
 * entirely on the split column, because that is the thing being read.
 *
 * ── Why inline custom properties and not a stylesheet ───────────────────────
 *
 * A package cannot ship a CSS file without asking every consumer to wire it
 * into their build, and the two apps here have different Tailwind setups. These
 * are applied as inline custom properties on the panel's own root instead, so
 * they cascade to every child, need no build config, and cannot leak out and
 * restyle the host app around them.
 */
export const LISTING_TOKENS: Record<string, string> = {
    "--paper": "#f6f4f0",
    "--card": "#ffffff",
    "--sunk": "#f1eee9",
    "--line": "#e6e1d9",
    "--line-soft": "#efebe4",

    "--ink": "#191714",
    "--ink-2": "#5c574f",
    "--ink-3": "#99928a",

    /** The one action colour. Anything that commits wears it. */
    "--commit": "#191714",

    /* The split, in the order the waterfall spends it. */
    "--b-tax": "#ded8cf",
    "--b-comm": "#e0a94e",
    "--b-cob": "#7f9fc9",
    "--b-card": "#b6aea4",
    "--b-keep": "#4e9c78",

    "--good": "#3d7d5f",
    "--good-w": "#e9f2ed",
    "--warn-w": "#fbf1de",
    "--warn": "#8a6420",
    "--bad": "#a8443c",

    /** One easing curve everywhere, decelerating, so things settle. */
    "--ease": "cubic-bezier(.22,.61,.36,1)",
};

/**
 * Spread onto the panel root: `<div style={listingTokenStyle()}>`.
 *
 * Typed as CSSProperties-compatible so callers do not need a cast; custom
 * properties are legal there at runtime and TS simply has no name for them.
 */
export function listingTokenStyle(extra?: Record<string, string>): Record<string, string> {
    return { ...LISTING_TOKENS, ...(extra ?? {}) };
}
