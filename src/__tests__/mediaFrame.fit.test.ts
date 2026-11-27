import { describe, it, expect } from "vitest";
import { averageEdge, FALLBACK_GROUND, fitZoom, placement, reachesPast } from "../media/mediaFrame";

/*
 * Framing a photo of another shape than the frame (a portrait poster in the
 * square event frame): the zoom that shows all of it, where it lands on the
 * framed canvas, and the colour that fills the strips beside it.
 */

describe("fitZoom", () => {
  it("a 4:5 portrait poster in a square frame fits whole at 0.8", () => {
    expect(fitZoom(1080, 1350, 1)).toBeCloseTo(0.8);
  });
  it("a 3:2 landscape photo in a square frame fits whole at 2/3", () => {
    expect(fitZoom(1500, 1000, 1)).toBeCloseTo(2 / 3);
  });
  it("a photo already the frame's shape gives 1, whatever its size", () => {
    expect(fitZoom(1500, 1500, 1)).toBe(1);
    expect(fitZoom(1600, 900, 16 / 9)).toBeCloseTo(1);
  });
  it("a square photo in a 4:5 frame fits whole at 0.8", () => {
    expect(fitZoom(1000, 1000, 4 / 5)).toBeCloseTo(0.8);
  });
  it("an unread size never zooms out", () => {
    expect(fitZoom(0, 1350, 1)).toBe(1);
    expect(fitZoom(1080, 0, 1)).toBe(1);
    expect(fitZoom(1080, 1350, 0)).toBe(1);
  });
});

describe("reachesPast", () => {
  it("a frame inside the photo, or a rounding pixel over its edge, does not", () => {
    expect(reachesPast({ x: 0, y: 135, width: 1080, height: 1080 }, 1080, 1350)).toBe(false);
    expect(reachesPast({ x: -0.6, y: 0, width: 1080.9, height: 1080 }, 1080, 1350)).toBe(false);
  });
  it("a frame zoomed out around a portrait poster does", () => {
    expect(reachesPast({ x: -135, y: 0, width: 1350, height: 1350 }, 1080, 1350)).toBe(true);
  });
});

describe("placement", () => {
  it("the whole 4:5 poster lands centred on a square canvas, strips left and right", () => {
    const p = placement({ x: -135, y: 0, width: 1350, height: 1350 }, 1080, 1350, 1350)!;
    expect(p).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1350, dx: 135, dy: 0, dw: 1080, dh: 1350 });
  });
  it("scales with the canvas when the framed size is capped", () => {
    const p = placement({ x: -135, y: 0, width: 1350, height: 1350 }, 1080, 1350, 675)!;
    expect(p.dx).toBeCloseTo(67.5);
    expect(p.dw).toBeCloseTo(540);
    expect(p.dh).toBeCloseTo(675);
  });
  it("a frame moved off the photo entirely holds none of it", () => {
    expect(placement({ x: 2000, y: 0, width: 500, height: 500 }, 1080, 1350, 500)).toBeNull();
  });
});

describe("averageEdge", () => {
  function grid(w: number, h: number, edge: number[], inside: number[]) {
    const d: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      d.push(...(onEdge ? edge : inside));
    }
    return d;
  }
  it("is the colour of the border, not of the middle", () => {
    expect(averageEdge(grid(6, 6, [74, 15, 26, 255], [250, 250, 250, 255]), 6, 6)).toBe("rgb(74, 15, 26)");
  });
  it("a transparent border gives white, which a JPEG can show", () => {
    expect(averageEdge(grid(4, 4, [0, 0, 0, 0], [10, 10, 10, 255]), 4, 4)).toBe("rgb(255, 255, 255)");
  });
  it("an empty grid gives the fallback", () => {
    expect(averageEdge([], 0, 0)).toBe(FALLBACK_GROUND);
  });
});
