/**
 * The shared description dialog (events, products, courses). It edits a
 * draft: Done hands it over, Cancel drops it, and Esc / a backdrop click only
 * dismiss while nothing has been typed, so a stray click cannot lose writing.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DescriptionDialog } from "../editor/DescriptionDialog";

function setup(over: Partial<React.ComponentProps<typeof DescriptionDialog>> = {}) {
  const onCancel = vi.fn();
  const onDone = vi.fn();
  const props = {
    open: true,
    title: "Description",
    subtitle: "What will customers get?",
    value: "Saved text",
    placeholder: "Write your product description...",
    cancelLabel: "Cancel",
    doneLabel: "Done",
    onCancel,
    onDone,
    ...over,
  };
  const utils = render(<DescriptionDialog {...props} />);
  return { ...utils, onCancel, onDone, props };
}

const textarea = () => screen.getByRole("dialog").querySelector("textarea") as HTMLTextAreaElement;
const backdrop = () => screen.getByTestId("description-dialog-backdrop");
function clickBackdrop() {
  fireEvent.mouseDown(backdrop());
  fireEvent.click(backdrop());
}

describe("DescriptionDialog", () => {
  it("renders the title, subtitle and saved text, and no top close X", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Description" })).toBeTruthy();
    expect(screen.getByText("What will customers get?")).toBeTruthy();
    expect(textarea().value).toBe("Saved text");
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });

  it("puts Add image, the counter and both buttons in one row under the text", () => {
    setup();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const row = cancel.parentElement!.parentElement!;
    expect(row.textContent).toContain("10 / 2000");
    expect(row.contains(screen.getByRole("button", { name: "Done" }))).toBe(true);
  });

  it("Done hands over the draft; Cancel drops it", () => {
    const { onDone, onCancel } = setup();
    fireEvent.change(textarea(), { target: { value: "New text" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith("New text");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Esc and a backdrop click dismiss while nothing has been typed", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    clickBackdrop();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("Esc and a backdrop click do NOT discard typed text", () => {
    const { onCancel } = setup();
    fireEvent.change(textarea(), { target: { value: "Half a sentence" } });
    fireEvent.keyDown(window, { key: "Escape" });
    clickBackdrop();
    expect(onCancel).not.toHaveBeenCalled();
    expect(textarea().value).toBe("Half a sentence");
  });

  it("a press that starts in the panel and ends on the backdrop does not close", () => {
    const { onCancel } = setup();
    fireEvent.mouseDown(textarea());
    fireEvent.click(backdrop());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("re-seeds from the saved value each time it opens", () => {
    const { rerender, props } = setup();
    fireEvent.change(textarea(), { target: { value: "Abandoned draft" } });
    rerender(<DescriptionDialog {...props} open={false} />);
    rerender(<DescriptionDialog {...props} open />);
    expect(textarea().value).toBe("Saved text");
  });

  it("shows the busy label and blocks Done while saving", () => {
    setup({ busy: true, busyLabel: "Saving..." });
    const done = screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
