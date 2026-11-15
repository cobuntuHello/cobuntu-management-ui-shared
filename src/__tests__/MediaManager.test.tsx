import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import * as React from "react";

/*
 * MediaManager: the photos of an event, a product or a course. Pick or drop
 * several, frame each one after, then reorder, re-frame, replace or remove.
 * The cropper and the canvas are stubbed: happy-dom has no canvas, and what
 * matters here is the flow and what the host is handed.
 */

let cropPx = { x: 0, y: 0, width: 1500, height: 1500 };
vi.mock("react-easy-crop", () => ({
  default: (p: any) => {
    React.useEffect(() => { p.onCropComplete?.({}, cropPx); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="cropper" data-image={p.image} data-aspect={p.aspect} />;
  },
}));
vi.mock("../media/mediaFrame", async (orig) => {
  const real = await orig<typeof import("../media/mediaFrame")>();
  return {
    ...real,
    readAsDataUrl: vi.fn(async (f: File) => `data:image/png;base64,${f.name}`),
    fileHasAiGeneratedLabel: vi.fn(async (f: File) => f.name.startsWith("ai")),
    frameToDataUrl: vi.fn(async (_src: string, a: any) => ({ dataUrl: "data:image/jpeg;base64,FRAMED", width: Math.round(a.width), height: Math.round(a.height) })),
    dataUrlToFile: vi.fn(() => new File(["x"], "photo.jpg", { type: "image/jpeg" })),
  };
});

import { MediaManager, type ManagedMedia, type MediaRules } from "../media/MediaManager";

const RULES: MediaRules = {
  minEdge: 1080,
  requireConfirmation: true,
  confirmationText: "I hold the rights to these images, and none is AI-generated.",
  notice: "High-resolution photos only.",
  blockAiLabelled: true,
};
const photo = (name: string) => new File(["bytes"], name, { type: "image/jpeg" });
const item = (n: number): ManagedMedia => ({ id: `i${n}`, preview: `https://s/${n}.jpg`, type: "image" });

function Harness({ initial = [] as ManagedMedia[], rules = null as MediaRules | null, commit, onChange }: {
  initial?: ManagedMedia[]; rules?: MediaRules | null; commit?: any; onChange?: (x: ManagedMedia[]) => void;
}) {
  const [items, setItems] = React.useState(initial);
  const c = commit ?? vi.fn(async (p: any) => ({ id: `new-${Math.random()}`, preview: p.dataUrl, type: "image" as const }));
  return (
    <MediaManager items={items} onChange={(x) => { setItems(x); onChange?.(x); }} aspect={1} maxItems={8} commit={c} rules={rules} />
  );
}

function pick(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

beforeEach(() => { cropPx = { x: 0, y: 0, width: 1500, height: 1500 }; });

describe("MediaManager", () => {
  it("starts as one wide drop area that opens the upload modal", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Add photos/ }));
    expect(screen.getByText("Drop photos here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose from your device" })).toBeTruthy();
  });

  it("frames each picked photo after the choice, and hands every one to the host", async () => {
    const commit = vi.fn(async (p: any) => ({ id: `new-${commit.mock.calls.length}`, preview: p.dataUrl, type: "image" as const }));
    const onChange = vi.fn();
    render(<Harness commit={commit} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Add photos/ }));
    pick([photo("a.jpg"), photo("b.jpg")]);
    await screen.findByText("2 photos ready");
    fireEvent.click(screen.getByRole("button", { name: "Continue to framing" }));
    expect(await screen.findByText("1 of 2")).toBeTruthy();
    expect(screen.getByTestId("cropper").getAttribute("data-aspect")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Use and next" }));
    expect(await screen.findByText("2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use photo" }));
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(commit.mock.calls[0][0]).toMatchObject({ width: 1500, height: 1500, confirmed: true, source: "data:image/png;base64,a.jpg" });
    await waitFor(() => expect(onChange.mock.calls.at(-1)![0]).toHaveLength(2));
  });

  it("with a community's rules: the notice, the tick before framing, AI-labelled files refused, the size floor", async () => {
    cropPx = { x: 0, y: 0, width: 900, height: 900 };
    render(<Harness rules={RULES} />);
    fireEvent.click(screen.getByRole("button", { name: /Add photos/ }));
    expect(screen.getByText(RULES.notice!)).toBeTruthy();
    pick([photo("ai-render.jpg"), photo("real.jpg")]);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/ai-render\.jpg: this file says it was made with AI/)).toBeTruthy();
    await screen.findByText("1 photo ready");
    const go = screen.getByRole("button", { name: "Continue to framing" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: RULES.confirmationText }));
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    expect(await screen.findByText(/This frame would be 900 × 900/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("each photo: make cover, remove, replace and re-frame", async () => {
    const onChange = vi.fn();
    render(<Harness initial={[item(1), item(2), item(3)]} onChange={onChange} />);
    expect(screen.getAllByText("Cover")).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Make cover" })[1]);
    expect(onChange.mock.calls.at(-1)![0].map((x: ManagedMedia) => x.id)).toEqual(["i3", "i1", "i2"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[2]);
    expect(onChange.mock.calls.at(-1)![0].map((x: ManagedMedia) => x.id)).toEqual(["i3", "i1"]);

    fireEvent.click(screen.getAllByRole("button", { name: "Replace" })[0]);
    expect(screen.getByText("Replace photo")).toBeTruthy();
    expect(screen.getByText("Drop a photo here")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getAllByRole("button", { name: "Re-frame" })[1]);
    const cropper = await screen.findByTestId("cropper");
    expect(cropper.getAttribute("data-image")).toBe("https://s/1.jpg");
  });

  it("a host that fails to keep a photo gets it back out, with the reason", async () => {
    const commit = vi.fn(async () => { throw new Error("This image is 800 × 800 pixels."); });
    render(<Harness commit={commit} />);
    fireEvent.click(screen.getByRole("button", { name: /Add photos/ }));
    pick([photo("a.jpg")]);
    await screen.findByText("1 photo ready");
    fireEvent.click(screen.getByRole("button", { name: "Continue to framing" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use photo" }));
    expect(await screen.findByText("This image is 800 × 800 pixels.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add photos/ })).toBeTruthy();
  });
});
