import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MembershipTierPicker } from "../ui/MembershipTierPicker";
import { ceilingFor } from "../lib/tierAccess";
import type { TierAccessValue } from "../lib/tierAccess";

/**
 * The cascade, as a user meets it.
 *
 * Public and All members are shortcuts that imply every tier below them. That
 * used to be drawn as ticked-and-greyed checkboxes; an implied row is now a
 * label carrying an "Included" tag, and a checkbox appears only where clicking
 * it does something. The rows stay VISIBLE either way - they are included, not
 * unavailable, which is deliberately the opposite of the card-level rule where
 * a capability you cannot have is not rendered at all.
 */

const TIERS = [
  { id: "t1", name: "Founding" },
  { id: "t2", name: "Standard" },
  { id: "t3", name: "Alumni" },
];

function setup(value: TierAccessValue, props: Partial<React.ComponentProps<typeof MembershipTierPicker>> = {}) {
  const onChange = vi.fn();
  render(<MembershipTierPicker value={value} onChange={onChange} tiers={TIERS} {...props} />);
  return onChange;
}

const row = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name) });
const queryRow = (name: string) => screen.queryByRole("checkbox", { name: new RegExp(name) });

describe("under a shortcut", () => {
  it("marks every tier Included rather than as a checkbox that refuses clicks", () => {
    setup({ mode: "public", tierIds: [] });
    for (const t of TIERS) {
      expect(screen.getByText(t.name)).toBeInTheDocument();
      expect(queryRow(t.name)).toBeNull();
    }
    // One tag per implied tier, plus one for the All members row Public implies.
    expect(screen.getAllByText("Included")).toHaveLength(TIERS.length + 1);
  });

  it("gives an implied tier nothing to click", () => {
    setup({ mode: "all", tierIds: [] });
    expect(queryRow("Founding")).toBeNull();
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
    // The way out of Public is Public, not the row it implies - so that row is
    // not a control at all while Public is set.
    setup({ mode: "public", tierIds: [] });
    expect(queryRow("All members")).toBeNull();
  });
});

describe("picking tiers", () => {
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

describe("a community with one tier", () => {
  it("hides the tier list, because it would restate All members", () => {
    render(
      <MembershipTierPicker
        value={{ mode: "all", tierIds: [] }}
        onChange={vi.fn()}
        tiers={[{ id: "t1", name: "Free" }]}
      />,
    );
    expect(screen.getByText("All members")).toBeInTheDocument();
    expect(screen.queryByText("Free")).toBeNull();
  });
});

describe("the All members row tells the truth", () => {
  it("is NOT ticked when only some tiers are selected", () => {
    /*
     * Caught on screen, not by a test: it read `mode !== "public"`, so
     * selecting a single tier left "All members" ticked above it. The row
     * claimed every member while the listing was granted to one.
     */
    setup({ mode: "tiers", tierIds: ["t1"] });
    expect(row("All members")).toHaveAttribute("aria-checked", "false");
  });

  it("is ticked for All members, and Included under Public", () => {
    setup({ mode: "all", tierIds: [] });
    expect(row("All members")).toHaveAttribute("aria-checked", "true");
  });
});

describe("buying cannot be offered wider than seeing", () => {
  /*
   * "Visible to Founding only" + "anyone can buy it" was reachable and
   * saveable, because the two pickers were independent state. Not a hole - the
   * view gate runs first - but the card asserted something untrue. The buy
   * picker now takes a ceiling and simply does not render what view excludes.
   */

  it("drops Public when the listing is members-only", () => {
    setup({ mode: "all", tierIds: [] }, { ceiling: ceilingFor({ mode: "all", tierIds: [] }) });
    expect(queryRow("Public")).toBeNull();
    expect(row("All members")).toBeInTheDocument();
  });

  it("drops both shortcuts and the invisible tiers when view names tiers", () => {
    setup(
      { mode: "tiers", tierIds: ["t1"] },
      { ceiling: ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] }) },
    );
    expect(queryRow("Public")).toBeNull();
    expect(queryRow("All members")).toBeNull();
    expect(row("Founding")).toBeInTheDocument();
    expect(screen.queryByText("Alumni")).toBeNull();
  });

  it("collapses to the ceiling, not past it, when every choosable tier is ticked", () => {
    // Without the ceiling this lands on `all`, which is WIDER than the view
    // setting allows - the exact contradiction the ceiling exists to prevent.
    const ceiling = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    const onChange = setup({ mode: "tiers", tierIds: ["t1"] }, { ceiling });
    fireEvent.click(row("Standard"));
    expect(onChange).toHaveBeenCalledWith({ mode: "tiers", tierIds: ["t1", "t2"] });
  });
});
