/**
 * useGlide: the numbers in Change terms travel to their new values instead of
 * jumping (25 Nov 2026). Frames and the clock are driven by hand here, so each
 * assertion reads one exact moment of the glide.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlide } from "../listings/v2/glide";

let now = 0;
let frames = new Map<number, FrameRequestCallback>();
let nextId = 1;

beforeEach(() => {
    now = 0;
    frames = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { const id = nextId++; frames.set(id, cb); return id; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

/** Let `ms` pass and run the frames that were waiting. */
const tick = (ms: number) => act(() => {
    now += ms;
    const due = [...frames.values()];
    frames.clear();
    due.forEach((cb) => cb(now));
});

const glide = (on: boolean, start = 0) =>
    renderHook(({ v }: { v: number }) => useGlide({ a: v }, on), { initialProps: { v: start } });

describe("useGlide", () => {
    it("off, it hands back the values as given", () => {
        const { result, rerender } = glide(false);
        rerender({ v: 1000 });
        expect(result.current.a).toBe(1000);
    });

    it("starts on the first values without gliding", () => {
        const { result } = glide(true, 500);
        expect(result.current.a).toBe(500);
        expect(frames.size).toBe(0);
    });

    it("on, a change travels from the old value, eases out, and lands exact", () => {
        const { result, rerender } = glide(true);
        rerender({ v: 1000 });
        expect(result.current.a).toBe(0);
        tick(210); // halfway in time, 1 - 0.5^3 of the way
        expect(result.current.a).toBe(875);
        tick(300);
        expect(result.current.a).toBe(1000);
        expect(frames.size).toBe(0);
    });

    it("a second change mid-flight starts from what is on screen, never jumping back", () => {
        const { result, rerender } = glide(true);
        rerender({ v: 1000 });
        tick(210);
        expect(result.current.a).toBe(875);
        rerender({ v: 0 });
        expect(result.current.a).toBe(875);
        tick(1);
        expect(result.current.a).toBeGreaterThan(860);
        expect(result.current.a).toBeLessThan(875);
        tick(500);
        expect(result.current.a).toBe(0);
    });

    it("a key that was not there grows from 0", () => {
        const { result, rerender } = renderHook(({ v }: { v: Record<string, number> }) => useGlide(v, true), { initialProps: { v: { a: 10 } as Record<string, number> } });
        rerender({ v: { a: 10, b: 400 } });
        expect(result.current.b).toBe(0);
        tick(210);
        expect(result.current.b).toBe(350);
        tick(300);
        expect(result.current).toEqual({ a: 10, b: 400 });
    });

    it("with reduced motion it lands at once", () => {
        vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
        const { result, rerender } = glide(true);
        rerender({ v: 1000 });
        expect(result.current.a).toBe(1000);
        expect(frames.size).toBe(0);
    });
});
