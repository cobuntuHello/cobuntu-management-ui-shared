import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ResponsiveDrawer } from "../ui/ResponsiveDrawer";

/**
 * Both the side-panel and bottom-sheet markup are always in the DOM — a
 * Tailwind `md:` breakpoint picks which one is visible, not JS — so every
 * query below expects TWO of everything (one per edge), not one. See the
 * component's own doc comment for why that's deliberate.
 */
describe("ResponsiveDrawer", () => {
  it("renders title, body and footer in both the side panel and the bottom sheet", () => {
    render(
      <ResponsiveDrawer onClose={() => {}} title="Carla Mendes" footer={<button>Close out</button>}>
        <p>2 downloads</p>
      </ResponsiveDrawer>,
    );
    expect(screen.getAllByRole("heading", { name: "Carla Mendes" })).toHaveLength(2);
    expect(screen.getAllByText("2 downloads")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Close out" })).toHaveLength(2);
  });

  it("does not render when open is false", () => {
    render(
      <ResponsiveDrawer open={false} onClose={() => {}} title="hidden">
        <p>body</p>
      </ResponsiveDrawer>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("calls onClose when a close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDrawer onClose={onClose} title="t">
        <p>body</p>
      </ResponsiveDrawer>,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    // The close button schedules onClose after the 300ms exit transition.
    await new Promise((r) => setTimeout(r, 320));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not bubble inner clicks to the backdrop", async () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDrawer onClose={onClose} title="t">
        <button>inner</button>
      </ResponsiveDrawer>,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "inner" })[0]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders both edges with the same z-index as ModalShell (LAYERS.modal)", () => {
    const { container } = render(<ResponsiveDrawer onClose={() => {}}>content</ResponsiveDrawer>);
    const dialogs = container.ownerDocument.body.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(2);
    for (const dialog of Array.from(dialogs)) {
      expect((dialog as HTMLElement).style.zIndex).toBe("120");
    }
  });
});
