import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  BannerPlaceholder,
  bannerPlaceholderGradient,
  bannerPlaceholderHash,
} from "../ui/BannerPlaceholder";

/**
 * The listing fallback shown when a product or event has no image.
 *
 * It lives here because it had drifted into three copies (community app,
 * admin components/ui, and a third inline in the admin's EventPreview) with no
 * mechanism to keep them in agreement. The properties worth pinning are the
 * ones that make it read as artwork rather than as a broken image:
 * determinism, spread across the palette set, and that it renders a gradient
 * rather than an icon.
 */
describe("BannerPlaceholder", () => {
  it("is deterministic — the same listing always gets the same artwork", () => {
    // If this ever changes, EVERY existing listing's fallback changes with it.
    const a = bannerPlaceholderGradient("Positioning teardown");
    const b = bannerPlaceholderGradient("Positioning teardown");
    expect(a).toBe(b);
  });

  it("gives different listings different artwork", () => {
    const seeds = ["Coaching session", "Photoshoot", "Sales challenge", "Networking"];
    const grads = new Set(seeds.map(bannerPlaceholderGradient));
    // Not a guarantee of zero collisions, but four seeds landing on one gradient
    // would mean the spread is broken — which is the "all cards look identical"
    // failure this component exists to avoid.
    expect(grads.size).toBeGreaterThan(1);
  });

  it("falls back to a stable seed rather than throwing on an empty one", () => {
    expect(bannerPlaceholderGradient("")).toBe(bannerPlaceholderGradient(""));
    expect(bannerPlaceholderGradient("")).toContain("linear-gradient");
  });

  it("renders a gradient background, not an icon", () => {
    // The whole point: an outline glyph on a tinted ground reads as a loading
    // failure when several cards sit side by side.
    const { container } = render(<BannerPlaceholder seed="evt-1" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundImage).toContain("linear-gradient");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("fills its container so it can drop into any card aspect box", () => {
    const { container } = render(<BannerPlaceholder seed="evt-1" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-full");
    expect((container.firstElementChild as HTMLElement).className).toContain("h-full");
  });

  it("merges a caller className without dropping the fill classes", () => {
    const { container } = render(<BannerPlaceholder seed="evt-1" className="rounded-xl" />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("rounded-xl");
    expect(cls).toContain("w-full");
  });

  it("hashes without overflowing into a negative index", () => {
    // The palette lookup is `hash % PALETTES.length`; a negative hash would
    // index out of bounds and crash the card.
    for (const s of ["", "a", "a much longer listing name than usual", "🎉 emoji title"]) {
      expect(bannerPlaceholderHash(s)).toBeGreaterThanOrEqual(0);
    }
  });
});
