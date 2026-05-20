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
