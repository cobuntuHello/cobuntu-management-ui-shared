import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModalShell } from "../ui/ModalShell";

/**
 * The backdrop dismisses only for a click that started on it.
 *
 * A press inside the panel released over the backdrop makes the browser fire
 * "click" on the backdrop (their common ancestor). That closed the event tier
 * modal mid-edit and lost the registration question being written (Impact Hub
 * Porto, 2026-11-06; reproduced in headless Chrome on production). jsdom does
 * not synthesise that click, so these dispatch the pair the browser would.
 */
function setup(props: Partial<React.ComponentProps<typeof ModalShell>> = {}) {
  const onClose = vi.fn();
  render(
    <ModalShell onClose={onClose} hideCloseButton {...props}>
      <input aria-label="Question label" />
    </ModalShell>,
  );
  return { onClose, backdrop: screen.getByTestId("modal-backdrop"), input: screen.getByLabelText("Question label") };
}

describe("ModalShell backdrop", () => {
  it("closes on a click that starts and ends on the backdrop", () => {
    const { onClose, backdrop } = setup();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close when the press started inside the panel and ended over the backdrop", () => {
    const { onClose, backdrop, input } = setup();
    fireEvent.mouseDown(input);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT close on clicks inside the panel", () => {
    const { onClose, input } = setup();
    fireEvent.mouseDown(input);
    fireEvent.click(input);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still honours dismissOnBackdrop={false}", () => {
    const { onClose, backdrop } = setup({ dismissOnBackdrop: false });
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });
});
