import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfirmLeaveModal } from "../ui/ConfirmLeaveModal";

describe("ConfirmLeaveModal", () => {
  it("renders nothing when open is false", () => {
    render(
      <ConfirmLeaveModal open={false} onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.queryByText("Leave this page?")).not.toBeInTheDocument();
  });

  it("renders title and message when open", () => {
    render(
      <ConfirmLeaveModal
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Connect Stripe to accept payments"
        message="You'll be taken to Stripe to connect your account. You can come back and finish this listing after."
      />,
    );
    expect(
      screen.getByText("Connect Stripe to accept payments"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You'll be taken to Stripe to connect your account. You can come back and finish this listing after.",
      ),
    ).toBeInTheDocument();
  });

  it("fires onConfirm and onCancel via their buttons", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmLeaveModal
        open
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Continue to Stripe"
        cancelLabel="Not now"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Continue to Stripe" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
