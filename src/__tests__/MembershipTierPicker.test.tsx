import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MembershipTierPicker } from "../ui/MembershipTierPicker";
import type { TierAccessValue } from "../lib/tierAccess";

/**
 * The cascade, as a user meets it.
 *
 * Public and All members are shortcuts that imply every tier, so they tick and
 * FREEZE the rows below rather than clearing them. Frozen means "already
 * included" - which is why the rows stay visible and ticked instead of
 * disappearing. That is deliberately the opposite of the card-level rule,
 * where a capability you cannot have is not rendered at all.
 */

const TIERS = [
  { id: "t1", name: "Founding" },
  { id: "t2", name: "Standard" },
  { id: "t3", name: "Alumni" },
];

function setup(value: TierAccessValue) {
  const onChange = vi.fn();
  render(<MembershipTierPicker value={value} onChange={onChange} tiers={TIERS} />);
  return onChange;
}

const row = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name) });

describe("under a shortcut", () => {
  it("shows every tier ticked and frozen", () => {
    setup({ mode: "public", tierIds: [] });
    for (const t of TIERS) {
      expect(row(t.name)).toHaveAttribute("aria-checked", "true");
      expect(row(t.name)).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("ignores clicks on a frozen tier", () => {
    const onChange = setup({ mode: "all", tierIds: [] });
    fireEvent.click(row("Founding"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still renders the tiers rather than hiding them", () => {
    // They are included, not unavailable. Hiding them would misdescribe why.
    setup({ mode: "public", tierIds: [] });
    expect(screen.getByText("Alumni")).toBeInTheDocument();
  });
});

describe("switching modes", () => {
  it("drops from Public to All members", () => {
    const onChange = setup({ mode: "public", tierIds: [] });
    fireEvent.click(row("Public"));
    expect(onChange).toHaveBeenCalledWith({ mode: "all", tierIds: [] });
  });

  it("cannot untick All members while Public is on", () => {
    // The way out of Public is Public, not the row it implies.
    const onChange = setup({ mode: "public", tierIds: [] });
    fireEvent.click(row("All members"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("picking tiers", () => {
  /*
   * The subtract-from-all transition lives in tierAccess.test.ts, where it can
   * be asserted on the value directly. It is unreachable through this
   * component by design: the rows are frozen under a shortcut, so a user
   * leaves All members via the Public row first.
   */

  it("toggles a tier when the list is live", () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1", "t2"] });
    fireEvent.click(row("Alumni"));
    expect(onChange).toHaveBeenCalledWith({ mode: "all", tierIds: [] });
  });

  it("marks an excluded tier unticked", () => {
    setup({ mode: "tiers", tierIds: ["t1"] });
    expect(row("Founding")).toHaveAttribute("aria-checked", "true");
    expect(row("Alumni")).toHaveAttribute("aria-checked", "false");
  });
});

describe("a community with no tiers", () => {
  it("says so instead of showing an empty rail", () => {
    render(<MembershipTierPicker value={{ mode: "all", tierIds: [] }} onChange={vi.fn()} tiers={[]} />);
    expect(screen.getByText(/no membership tiers yet/)).toBeInTheDocument();
  });
});
