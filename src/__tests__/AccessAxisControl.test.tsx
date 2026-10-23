import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessAxisControl } from "../ui/AccessAxisControl";
import { ceilingFor } from "../lib/tierAccess";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TierAccessValue } from "../lib/tierAccess";

/**
 * The mode row (Public / All members / Specific tiers) is a radio choice —
 * mutually exclusive, rendered as a dot. The nested tier list it reveals is a
 * checkbox choice — multi-select, rendered as a square tick — because the two
 * questions are genuinely different shapes, not just differently styled.
 */

const TIERS = [
  { id: "t1", name: "Founding" },
  { id: "t2", name: "Standard" },
  { id: "t3", name: "Alumni" },
];

function setup(value: TierAccessValue, props: Partial<React.ComponentProps<typeof AccessAxisControl>> = {}) {
  const onChange = vi.fn();
  render(
    <AccessAxisControl
      label="Who can find this"
      value={value}
      onChange={onChange}
      tiers={TIERS}
      publicLabel="Anyone"
      {...props}
    />,
  );
  return onChange;
}

describe("mode rows", () => {
  it("renders Public, All members and Specific tiers as a mutually exclusive group", () => {
    setup({ mode: "all", tierIds: [] });
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("All members")).toBeInTheDocument();
    expect(screen.getByText("Specific tiers")).toBeInTheDocument();
  });

  it("omits the Specific tiers row when fewer than two tiers are choosable", () => {
    setup({ mode: "all", tierIds: [] }, { tiers: [TIERS[0]] });
    expect(screen.queryByText("Specific tiers")).toBeNull();
  });

  it("switching to Public clears tierIds", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1"] });
    await userEvent.click(screen.getByText("Public"));
    expect(onChange).toHaveBeenCalledWith({ mode: "public", tierIds: [] });
  });

  it("switching to All members clears tierIds", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1"] });
    await userEvent.click(screen.getByText("All members"));
    expect(onChange).toHaveBeenCalledWith({ mode: "all", tierIds: [] });
  });

  it("picking Specific tiers from a shortcut starts with every tier included, not just one", async () => {
    const onChange = setup({ mode: "all", tierIds: [] });
    await userEvent.click(screen.getByText("Specific tiers"));
    expect(onChange).toHaveBeenCalledWith({ mode: "tiers", tierIds: ["t1", "t2", "t3"] });
  });

  it("picking Specific tiers again keeps the existing subset rather than resetting it", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t2"] });
    await userEvent.click(screen.getByText("Specific tiers"));
    expect(onChange).toHaveBeenCalledWith({ mode: "tiers", tierIds: ["t2"] });
  });
});

describe("the ceiling", () => {
  it("disables Public when the ceiling forbids it", () => {
    const ceiling = ceilingFor({ mode: "all", tierIds: [] });
    setup({ mode: "all", tierIds: [] }, { ceiling });
    expect(screen.getByText("Public").closest("button")).toBeDisabled();
  });

  it("disables All members when the ceiling forbids it", () => {
    const ceiling = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    setup({ mode: "tiers", tierIds: ["t1"] }, { ceiling });
    expect(screen.getByText("All members").closest("button")).toBeDisabled();
  });

  it("limits the choosable tier list to the ceiling's tierIds", () => {
    const ceiling = ceilingFor({ mode: "tiers", tierIds: ["t1", "t2"] });
    setup({ mode: "tiers", tierIds: ["t1", "t2"] }, { ceiling });
    expect(screen.getByText("Founding")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.queryByText("Alumni")).toBeNull();
  });
});

describe("the nested tier checklist", () => {
  it("shows a checked tile for every included tier when in tiers mode", () => {
    setup({ mode: "tiers", tierIds: ["t1", "t3"] });
    expect(screen.getByText("Founding")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Alumni")).toBeInTheDocument();
  });

  it("hides the tier checklist when not in tiers mode", () => {
    setup({ mode: "all", tierIds: [] });
    expect(screen.queryByText("Founding")).toBeNull();
  });

  it("toggling an included tier off removes it", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1", "t2"] });
    await userEvent.click(screen.getByText("Founding"));
    expect(onChange).toHaveBeenCalledWith({ mode: "tiers", tierIds: ["t2"] });
  });

  it("toggling an excluded tier on adds it", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1"] });
    await userEvent.click(screen.getByText("Standard"));
    expect(onChange).toHaveBeenCalledWith({ mode: "tiers", tierIds: ["t1", "t2"] });
  });

  it("unticking every tier collapses back to all, not an empty list", async () => {
    const onChange = setup({ mode: "tiers", tierIds: ["t1"] });
    await userEvent.click(screen.getByText("Founding"));
    expect(onChange).toHaveBeenCalledWith({ mode: "all", tierIds: [] });
  });
});

describe("disabled prop", () => {
  it("disables every row when disabled is passed", () => {
    setup({ mode: "all", tierIds: [] }, { disabled: true });
    expect(screen.getByText("Public").closest("button")).toBeDisabled();
    expect(screen.getByText("All members").closest("button")).toBeDisabled();
    expect(screen.getByText("Specific tiers").closest("button")).toBeDisabled();
  });
});

describe("accessibility roles", () => {
  it("exposes the mode rows as a radio group with the selected one checked", () => {
    setup({ mode: "all", tierIds: [] });
    expect(screen.getByRole("radio", { name: /Public/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /All members/ })).toHaveAttribute("aria-checked", "true");
  });

  it("exposes the nested tier list as checkboxes", () => {
    setup({ mode: "tiers", tierIds: ["t1"] });
    expect(screen.getByRole("checkbox", { name: /Founding/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: /Standard/ })).toHaveAttribute("aria-checked", "false");
  });
});

describe("the option rows read as cards", () => {
    const src = readFileSync(resolve(process.cwd(), "src/ui/AccessAxisControl.tsx"), "utf8");

    it("has a resting surface and a hover, not only a press state", () => {
        /*
         * These rows carried `active:bg-zinc-100` and nothing else, so at rest
         * they were bare text on white and did not read as the choices they
         * are. Nothing happened on hover either.
         */
        expect(src).toContain("bg-zinc-50 hover:bg-zinc-100");
    });

    it("marks the selected row by LIFTING it, not by tinting it", () => {
        /*
         * Selection used to be carried entirely by a 20px dot at the far right
         * -- a long way from the label it answers on a wide card.
         *
         * The first fix tinted the selected row with the brand colour at 7%.
         * Rendered with no brand token (the admin's case, where the fallback
         * is near-black) that came out a grey within a hair of the zinc-50
         * beneath it, so the chosen row was indistinguishable again. White
         * against zinc-50 is a difference that survives having no hue at all.
         */
        expect(src).toContain("bg-white shadow-");
        expect(src).not.toContain('var(--brand-color,#18181b)_7%');
    });

    it("takes the brand colour for the marks, with an ink fallback", () => {
        // The admin has no --brand-color, and the fallback is the ink it
        // already used, so nothing regresses there.
        expect(src).toContain('var(--brand-color, #18181b)');
    });

    it("stops drawing the tier checkboxes as the heaviest thing in the control", () => {
        /*
         * Four stacked zinc-900 squares put the most weight on the control's
         * LEAST important rows -- children of a choice already made above
         * them.
         */
        expect(src).not.toContain("border-zinc-900 bg-zinc-900");
    });
});
