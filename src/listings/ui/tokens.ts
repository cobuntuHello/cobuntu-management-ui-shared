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

/**
 * The panel's motion, as a single injected stylesheet.
 *
 * Keyframes cannot be expressed as inline styles, and the package cannot ship a
 * CSS file without asking every consumer to wire it into their build -- the
 * same constraint that made the palette inline custom properties. So the one
 * thing that genuinely needs a stylesheet is emitted as a <style> element from
 * the panel root, with every name prefixed `cbt-` so it cannot collide with the
 * host's own.
 *
 * REDUCED MOTION IS HONOURED HERE rather than at each call site. A guard that
 * has to be remembered per animation is a guard that will be forgotten on the
 * next one, and this page animates things that appear under the cursor.
 */
export const LISTING_MOTION = `
@keyframes cbt-counter-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: none; }
}
@keyframes cbt-expand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
@keyframes cbt-row-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  [data-cbt-panel] *, [data-cbt-panel] *::before, [data-cbt-panel] *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
`;
