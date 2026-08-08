import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ModalShell } from "../ui/ModalShell";

describe("ModalShell", () => {
  it("renders title, body, and footer slots", () => {
    render(
      <ModalShell
        onClose={() => {}}
        title="Edit tier"
        footer={<button>Save</button>}
      >
        <p>body text</p>
      </ModalShell>,
    );
    expect(screen.getByRole("heading", { name: "Edit tier" })).toBeInTheDocument();
    expect(screen.getByText("body text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(
      <ModalShell open={false} onClose={() => {}} title="hidden">
        <p>body</p>
      </ModalShell>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ModalShell onClose={onClose} title="t">
        <p>body</p>
      </ModalShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ModalShell onClose={onClose} title="t">
        <p>body</p>
      </ModalShell>,
    );
    // The backdrop is the outermost portaled div with role-less wrapper.
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss on backdrop when dismissOnBackdrop=false", async () => {
    const onClose = vi.fn();
    render(
      <ModalShell onClose={onClose} title="t" dismissOnBackdrop={false}>
        <p>body</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    await userEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not bubble inner clicks to the backdrop", async () => {
    const onClose = vi.fn();
    render(
      <ModalShell onClose={onClose} title="t">
        <button>inner</button>
      </ModalShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "inner" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * Regression guard for the 2026-08-08 report: the tier modal's backdrop left
 * the community app's left sidebar lit and clickable.
 *
 * The assertion is a RANGE, not an equality, because both ends are real
 * constraints and a future bump could silently break either:
 *   floor  — must clear the community sidebar (z-[60] at its highest)
 *   ceiling— must stay under popovers that open FROM INSIDE a modal, or they
 *            render behind it (community Select z-[200], admin DatePicker
 *            z-[9999])
 */
describe("ModalShell backdrop stacking", () => {
  it("sits above app chrome but below in-modal popovers", () => {
    const { container } = render(
      <ModalShell onClose={() => {}}>content</ModalShell>,
    );
    const backdrop = container.ownerDocument.body.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();

    const zClass = Array.from(backdrop!.classList).find((c) => c.startsWith("z-"));
    expect(zClass).toBeDefined();

    const z = parseInt(zClass!.replace(/^z-\[?|\]?$/g, ""), 10);
    expect(z).toBeGreaterThan(60);    // community sidebar
    expect(z).toBeLessThan(200);      // community Select / admin DatePicker
  });
});
