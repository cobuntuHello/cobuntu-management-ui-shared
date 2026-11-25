"use client";

import { useEffect, useRef, useState } from "react";

/** The user asked for less motion: land on new values at once. */
function reducedMotion(): boolean {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * NUMBERS THAT GLIDE. When a value changes, show it travelling from where it
 * was to where it is (ease-out) instead of jumping. Change terms re-prices the
 * whole split at every click, and a panel whose amounts, ring and rate all
 * snap at once read as the dialog reloading.
 *
 *   - `on` false: a plain pass-through, so a caller that does not glide renders
 *     exactly what it did before.
 *   - Interrupted (a second click mid-flight): the next glide starts from the
 *     values on screen, never from the old target, so nothing jumps back.
 *   - In flight the values are rounded (cents, whole percents); they land exact.
 *   - Reduced motion, or no requestAnimationFrame (server render): land at once.
 *
 * Keys may come and go between renders; a new key glides up from 0, so a slice
 * that was not in the ring grows in rather than appearing.
 */
export function useGlide(values: Record<string, number>, on: boolean, ms = 420): Record<string, number> {
    const [shown, setShown] = useState(values);
    const onScreen = useRef(values);
    const target = useRef(values);
    target.current = values;
    const sig = Object.keys(values).sort().map((k) => `${k}:${values[k]}`).join("|");

    useEffect(() => {
        const to = target.current;
        const from = onScreen.current;
        const land = () => { onScreen.current = to; setShown(to); };
        if (!on || reducedMotion() || typeof requestAnimationFrame !== "function") { land(); return; }
        if (Object.keys(to).every((k) => from[k] === to[k])) { land(); return; }
        const t0 = clock();
        let raf = 0;
        const step = () => {
            const k = Math.min(1, Math.max(0, (clock() - t0) / ms));
            if (k >= 1) { land(); return; }
            const e = 1 - Math.pow(1 - k, 3);
            const next: Record<string, number> = {};
            for (const id of Object.keys(to)) {
                const a = from[id] ?? 0;
                next[id] = Math.round(a + (to[id] - a) * e);
            }
            onScreen.current = next;
            setShown(next);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
        // `sig` stands for `values`: a new object with the same numbers is no change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sig, on, ms]);

    if (!on) return values;
    // A key the glide has not reached yet (first frame after it appears) starts at 0.
    const out: Record<string, number> = {};
    for (const k of Object.keys(values)) out[k] = shown[k] ?? 0;
    return out;
}
