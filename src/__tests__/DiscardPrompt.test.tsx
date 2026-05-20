import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DiscardPrompt } from "../ui/DiscardPrompt";

describe("DiscardPrompt", () => {
  it("does not render when open is false", () => {
    render(
      <DiscardPrompt open={false} onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("fires onConfirm and onCancel via their buttons", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DiscardPrompt open onCancel={onCancel} onConfirm={onConfirm} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("accepts custom labels and message", () => {
    render(
      <DiscardPrompt
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Leave?"
        message="Unsaved edits will be lost forever."
        confirmLabel="Leave"
        cancelLabel="Stay"
      />,
    );
    expect(screen.getByText("Leave?")).toBeInTheDocument();
    expect(
      screen.getByText("Unsaved edits will be lost forever."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay" })).toBeInTheDocument();
  });
});
