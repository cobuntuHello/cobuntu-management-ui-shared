/**
 * The create wizard's progress bar has to be VISIBLE on step one.
 *
 * Reported three times. The first two fixes both reached for the track's
 * opacity (12% -> 22%, then pinning --brand-color on the admin page) and the
 * bar kept coming back as "hardly visible", because the opacity was only half
 * the story and never the decisive half.
 *
 * On step one `pct` is 0 BY DESIGN — it counts transitions completed, so that
 * answering a question which shortens the flow cannot slide the marker. The
 * maths is right. What it produced was a progress bar with nothing in it, and
 * an empty bar does not read as "0% done", it reads as broken.
 *
 * These pin both halves: a fill that is never zero-width, and a track that
 * tints against the same colour the label uses rather than whatever the host
 * app happens to have inherited.
 */

import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CreateStepRail } from "../create/CreateStepRail";
import type { CreateStepId } from "../create/createWizard";

afterEach(() => cleanup());

const THREE: CreateStepId[] = ["details", "commerce", "access"];

const bar = () => screen.getByRole("progressbar");
const fill = () => bar().firstElementChild as HTMLElement;

describe("CreateStepRail — the bar is never empty", () => {
  it("step one still shows a fill, even though pct is 0", () => {
    // THE regression. Before this, step one rendered width:0% — the reported bug.
    render(<CreateStepRail steps={THREE} current="details" kind="product" />);
    expect(fill().style.width).toBe("14px");
  });

  it("the stub is in PIXELS, so it cannot scale with the step count", () => {
    /*
     * A percentage floor would reintroduce the exact jump `pct` exists to
     * prevent: picking "personal" drops the access step, and a 5% floor on a
     * 3-step flow is a different width from 5% on a 2-step flow. 14px is 14px.
     */
    render(<CreateStepRail steps={["details", "commerce"]} current="details" kind="product" />);
    expect(fill().style.width).toBe("14px");
  });

  it("does not let the stub displace a real fill", () => {
    render(<CreateStepRail steps={THREE} current="commerce" kind="product" />);
    expect(fill().style.width).toBe("50%");
  });

  it("reaches 100% on the last step", () => {
    render(<CreateStepRail steps={THREE} current="access" kind="product" />);
    expect(fill().style.width).toBe("100%");
  });
});

describe("CreateStepRail — the track tints deterministically", () => {
  /*
   * Asserted against the SOURCE, not the DOM, and that is not laziness: jsdom's
   * CSS parser rejects `color-mix()` outright and drops the whole declaration,
   * so `bar().style.background` reads empty here no matter what ships. Reading
   * the rendered value would pass identically before and after this fix, which
   * is worse than not testing it.
   */
  const SRC = readFileSync(join(__dirname, "..", "create", "CreateStepRail.tsx"), "utf8");

  it("mixes against --text-color, not whatever colour the shell inherited", () => {
    /*
     * The sibling <p> above the track paints `var(--text-color)` explicitly,
     * and nothing between them sets `color` — so the track was tinting against
     * an ambient value while the label used the pinned one. Same markup, two
     * different answers depending on the host app.
     */
    expect(SRC).toMatch(/color-mix\(in srgb, var\(--text-color, currentColor\) \d+%, transparent\)/);
  });

  it("keeps a currentColor fallback, so it stays theme-relative", () => {
    // Theme-relative is the point; deterministic is the fix. Keep both.
    expect(SRC).toContain("var(--text-color, currentColor)");
  });
});

describe("CreateStepRail — the fill measure itself is unchanged", () => {
  it("step one is 0% in BOTH a three-step and a two-step flow", () => {
    /*
     * Guards the property the 14px floor had to not break: shortening the flow
     * must not move the marker. Asserted on pct via the width string, since the
     * floor is a constant and cannot disguise a change here.
     */
    const { unmount } = render(<CreateStepRail steps={THREE} current="details" kind="product" />);
    const three = fill().style.width;
    unmount();
    render(<CreateStepRail steps={["details", "commerce"]} current="details" kind="product" />);
    expect(fill().style.width).toBe(three);
  });

  it("keeps the accessible step count on the bar", () => {
    render(<CreateStepRail steps={THREE} current="commerce" kind="product" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "2");
    expect(bar()).toHaveAttribute("aria-valuemax", "3");
  });
});

describe("CreateStepRail — the Next hint is legible and correctly ranked", () => {
  /*
   * Same root cause as the track, one line up: the "Step N of M" paragraph
   * pins `--text-color`, this one did not, and nothing between them sets
   * `color`. At 45% of an unknown ambient colour it was barely on the page.
   *
   * These read the SOURCE for the same reason the track cases do — the fix is
   * a style declaration, and asserting the rendered value would pass
   * identically before and after.
   */
  const SRC = readFileSync(join(__dirname, "..", "create", "CreateStepRail.tsx"), "utf8");

  it("renders the next step's label", () => {
    render(<CreateStepRail steps={THREE} current="details" kind="product" />);
    expect(screen.getByText(/^Next:/)).toBeInTheDocument();
  });

  it("is hidden on the last step, where there is no next", () => {
    render(<CreateStepRail steps={THREE} current="access" kind="product" />);
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
  });

  it("paints --text-color rather than inheriting an unknown ambient colour", () => {
    const hint = SRC.match(/className="text-\[12\.5px\][^"]*"[\s\S]{0,160}?Next:/);
    expect(hint).not.toBeNull();
    expect(hint![0]).toContain('color: "var(--text-color)"');
  });

  it("stays QUIETER than the current step, and no darker than it should be", () => {
    /*
     * The ranking is the point, not the number. "Details" is the current step
     * and carries full weight; this is a hint about a screen you have not
     * reached. Anything at or above ~70% would make the hint darker than the
     * "Step N of M" label at 50%, inverting the hierarchy.
     */
    expect(SRC).toMatch(/text-\[12\.5px\] opacity-60/);
    expect(SRC).not.toMatch(/text-\[12\.5px\] opacity-(7|8|9|100)/);
  });
});
