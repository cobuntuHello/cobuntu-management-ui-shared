/**
 * T-386: the Details tab description saves itself.
 *
 * The manage pages (events, products, courses) had a lone Save button above
 * the description editor. It is gone: the editor saves on a pause in typing
 * and on blur, and a small line beside the counter says "Saving...", "Saved"
 * or "Couldn't save. Retry".
 *
 * These pin the rules in useAutosave with the real editor and the real status
 * line: debounce, blur, never sending an unchanged value, one request in
 * flight with only the latest value queued, a failure that keeps the text and
 * retries, flushing on unmount and page exit, and read-only saving nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { AutosaveStatus } from "../editor/AutosaveStatus";
import { useAutosave, AUTOSAVE_DELAY_MS, type AutosaveSaveOptions } from "../editor/useAutosave";

type Save = (value: string, options: AutosaveSaveOptions) => Promise<unknown>;

/** The shape a manage page uses: the editor holds raw text, the trimmed text is what saves. */
function Harness({ initial = "Hello", save, enabled = true }: { initial?: string; save: Save; enabled?: boolean }) {
  const [value, setValue] = useState(initial);
  const autosave = useAutosave({ value: value.trim(), saved: initial.trim(), save, enabled });
  return (
    <MarkdownEditor
      value={value}
      onChange={setValue}
      onBlur={autosave.flush}
      disabled={!enabled}
      status={enabled ? <AutosaveStatus state={autosave.state} onRetry={autosave.retry} /> : undefined}
    />
  );
}

const textarea = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const status = () => screen.getByRole("status");
const type = (value: string) => fireEvent.change(textarea(), { target: { value } });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** Let a settled save's promise chain run to the end. */
const settle = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("debounce", () => {
  it("waits for typing to stop, then saves the latest text once", async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("Hello w");
    wait(400);
    type("Hello wo");
    wait(400);
    type("Hello wor");
    wait(AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();
    wait(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Hello wor", { keepalive: false });
    expect(status()).toHaveTextContent("Saving...");
    await settle();
    expect(status()).toHaveTextContent("Saved");
  });

  it("waits about 800ms", () => {
    expect(AUTOSAVE_DELAY_MS).toBe(800);
  });

  it("drops 'Saved' as soon as there is something unsaved again", async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("One");
    wait(AUTOSAVE_DELAY_MS);
    await settle();
    expect(status()).toHaveTextContent("Saved");
    type("One two");
    expect(status()).toBeEmptyDOMElement();
  });
});

describe("blur", () => {
  it("saves at once, and the pending debounce does not send it again", async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("Hello there");
    fireEvent.blur(textarea());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Hello there", { keepalive: false });
    await settle();
    wait(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("an unchanged value is never sent", () => {
  it("not on blur, not after typing back to the saved text, not for whitespace the save trims", () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} initial="Hello" />);
    fireEvent.blur(textarea());
    type("Hello!");
    type("Hello");
    wait(2000);
    fireEvent.blur(textarea());
    type("Hello   ");
    wait(2000);
    fireEvent.blur(textarea());
    expect(save).not.toHaveBeenCalled();
    expect(status()).toBeEmptyDOMElement();
  });

  it("adopts a new server value as the baseline instead of echoing it back", () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    const { rerender } = renderHook((p: { value: string; saved: string }) => useAutosave({ ...p, save }), {
      initialProps: { value: "Old", saved: "Old" },
    });
    // The page refetched (someone else edited it), then the editor re-seeded.
    rerender({ value: "Old", saved: "New" });
    rerender({ value: "New", saved: "New" });
    wait(2000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("one request in flight", () => {
  it("queues changes made meanwhile and sends only the latest once it settles", async () => {
    const first = deferred();
    const save = vi.fn<Save>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("A1");
    wait(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    type("A12");
    wait(AUTOSAVE_DELAY_MS);
    type("A123");
    fireEvent.blur(textarea());
    wait(AUTOSAVE_DELAY_MS);
    // Still only the first: nothing else goes out while it is in flight.
    expect(save).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent("Saving...");

    await act(async () => { first.resolve(); });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("A123", { keepalive: false });
    expect(save.mock.calls.map((c) => c[0])).not.toContain("A12");
    expect(status()).toHaveTextContent("Saved");
  });

  it("still saves text changed back to the old value while a save was out", async () => {
    // "Hello" -> "Hello!" (sent) -> "Hello" again. The server now has
    // "Hello!", so "Hello" is NOT unchanged any more and must go out.
    const first = deferred();
    const save = vi.fn<Save>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    render(<Harness save={save} initial="Hello" />);
    type("Hello!");
    wait(AUTOSAVE_DELAY_MS);
    type("Hello");
    wait(AUTOSAVE_DELAY_MS);
    await act(async () => { first.resolve(); });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("Hello", { keepalive: false });
  });
});

describe("a failed save", () => {
  it("keeps the text, says so, does not retry on its own, and Retry sends it again", async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error("Network down")).mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("Hello world");
    wait(AUTOSAVE_DELAY_MS);
    await settle();
    expect(status()).toHaveTextContent("Couldn't save.");
    expect(textarea().value).toBe("Hello world");

    wait(10_000);
    expect(save).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("Hello world", { keepalive: false });
    await settle();
    expect(status()).toHaveTextContent("Saved");
    expect(textarea().value).toBe("Hello world");
  });

  it("a synchronous throw is a failure too, not a crash", async () => {
    const save = vi.fn<Save>(() => { throw new Error("boom"); });
    render(<Harness save={save} />);
    type("Hello world");
    wait(AUTOSAVE_DELAY_MS);
    await settle();
    expect(status()).toHaveTextContent("Couldn't save.");
    expect(textarea().value).toBe("Hello world");
  });

  it("clears once the text is back to what the server has", async () => {
    const save = vi.fn<Save>().mockRejectedValue(new Error("Network down"));
    render(<Harness save={save} initial="Hello" />);
    type("Hello world");
    wait(AUTOSAVE_DELAY_MS);
    await settle();
    expect(status()).toHaveTextContent("Couldn't save.");
    type("Hello");
    expect(status()).toBeEmptyDOMElement();
  });
});

describe("the status line", () => {
  it("sits beside the counter, and 'Saved' fades after a couple of seconds", async () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    expect(status().parentElement!.textContent).toContain("/ 2000");
    type("Hi there");
    wait(AUTOSAVE_DELAY_MS);
    await settle();
    expect(status()).toHaveTextContent("Saved");
    expect(status()).not.toHaveAttribute("data-faded");
    wait(2000);
    expect(status()).toHaveAttribute("data-faded", "true");
    expect(status().className).toContain("opacity-0");
  });
});

describe("leaving", () => {
  it("flushes a pending change on unmount", () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    const { unmount } = render(<Harness save={save} />);
    type("Half a thought");
    wait(300);
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Half a thought", { keepalive: false });
  });

  it.each(["pagehide", "beforeunload"])("flushes on %s, with keepalive so the request outlives the page", (event) => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    type("Closing the tab");
    act(() => { window.dispatchEvent(new Event(event)); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Closing the tab", { keepalive: true });
  });

  it("unmounting with nothing unsaved sends nothing", () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    const { unmount } = render(<Harness save={save} />);
    unmount();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("read-only", () => {
  it("never saves and shows no status", () => {
    const save = vi.fn<Save>().mockResolvedValue(undefined);
    const { unmount } = render(<Harness save={save} enabled={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    type("Changed");
    wait(2000);
    fireEvent.blur(textarea());
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    unmount();
    expect(save).not.toHaveBeenCalled();
  });
});
