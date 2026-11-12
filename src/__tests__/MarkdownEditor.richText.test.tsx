/**
 * T-321: @mentions and images in the one description editor (events,
 * products, courses; create wizards and /manage).
 *
 * Product decisions (2026-11-10): a mention is a LINK ONLY (no notification),
 * and anyone on Cobuntu can be mentioned. Both features are text conventions
 * in the markdown value: `@[Label](user:<id>)` (the feed's format, routed by
 * the immutable id) and `![](https://...)` on its own line.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import {
  mentionQueryAt, mentionToken, insertMention, insertImage, mentionUrlTransform, MENTION_PATTERN,
  mentionsToDisplay, displayToMentions,
} from "../editor/richText";
import { MarkdownEditor, renderEditorOverlay } from "../editor/MarkdownEditor";
import { RichTextServicesProvider, ImageUploadError, type RichTextServices } from "../editor/RichTextServices";

const ana = { id: "u_ana-1", name: "Ana Costa", usertag: "anacosta", profileImage: null };

describe("text conventions", () => {
  it("finds the half-typed @query ending at the caret, and nothing else", () => {
    expect(mentionQueryAt("Meet @an", 8)).toEqual({ start: 5, query: "an" });
    expect(mentionQueryAt("@ana", 4)).toEqual({ start: 0, query: "ana" });
    // An email is not a mention: its @ follows a letter.
    expect(mentionQueryAt("write to ana@cobuntu.com", 24)).toBeNull();
    // The caret moved past a space: the query ended.
    expect(mentionQueryAt("Meet @ana ", 10)).toBeNull();
  });

  it("builds the feed's token, with a label that cannot break the brackets", () => {
    expect(mentionToken(ana)).toBe("@[Ana Costa](user:u_ana-1)");
    expect(mentionToken({ id: "x1", name: "Ana [the] Costa\n", usertag: null })).toBe("@[Ana the Costa](user:x1)");
    expect(mentionToken({ id: "x2", name: null, usertag: "rui" })).toBe("@[rui](user:x2)");
    expect(`Hi ${mentionToken(ana)}`.match(MENTION_PATTERN)).toHaveLength(1);
  });

  it("replaces exactly the @query and puts the caret after the inserted space", () => {
    const r = insertMention("Meet @an today", 5, 8, ana);
    expect(r.text).toBe("Meet @[Ana Costa](user:u_ana-1)  today");
    expect(r.text.slice(r.caret)).toBe(" today");
  });

  it("puts an image on a line of its own", () => {
    expect(insertImage("Lunch", 5, "https://x.test/a.png").text).toBe("Lunch\n![](https://x.test/a.png)\n");
    expect(insertImage("", 0, "https://x.test/a.png").text).toBe("![](https://x.test/a.png)\n");
    expect(insertImage("A\nB", 2, "https://x.test/a.png").text).toBe("A\n![](https://x.test/a.png)\nB");
  });

  it("maps a mention target to the member page by id, and leaves other URLs alone", () => {
    expect(mentionUrlTransform("user:u_ana-1")).toBe("/members/u_ana-1");
    expect(mentionUrlTransform("https://cobuntu.com")).toBeNull();
    expect(mentionUrlTransform("user:../../admin")).toBeNull();
  });
});

describe("the overlay", () => {
  const visibleText = (html: string) => {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent;
  };

  it("styles mentions and images without changing a single character (the caret depends on it)", () => {
    const value = "Hi @[Ana Costa](user:u_ana-1)\n![](https://x.test/my_photo_1.png)\n**bold** _it_";
    expect(visibleText(renderEditorOverlay(value))).toBe(value);
  });

  it("does not italicise the underscores inside an image URL or a user id", () => {
    const html = renderEditorOverlay("![](https://x.test/a_b_c.png) @[A](user:x_y_z)");
    expect(html).not.toContain("<em>");
  });
});

function Harness({ services, initial = "" }: { services?: RichTextServices; initial?: string }) {
  const [v, setV] = useState(initial);
  const editor = <MarkdownEditor value={v} onChange={setV} />;
  return (
    <>
      {services ? <RichTextServicesProvider value={services}>{editor}</RichTextServicesProvider> : editor}
      <output data-testid="value">{v}</output>
    </>
  );
}

describe("shown text vs stored text", () => {
  it("round-trips: stored → shown → stored", () => {
    const md = "Hi @[Ana Costa](user:u_ana-1) and @[Ana](user:u_2), see ana@cobuntu.com";
    const { display, labels } = mentionsToDisplay(md);
    expect(display).toBe("Hi @Ana Costa and @Ana, see ana@cobuntu.com");
    expect(displayToMentions(display, labels)).toBe(md);
  });

  it("only a whole label is a mention", () => {
    const labels = new Map([["Ana Costa", "u_ana-1"]]);
    expect(displayToMentions("@Ana Costas", labels)).toBe("@Ana Costas");
    expect(displayToMentions("x@Ana Costa", labels)).toBe("x@Ana Costa");
    expect(displayToMentions("(@Ana Costa)", labels)).toBe("(@[Ana Costa](user:u_ana-1))");
  });

  it("colours a shown mention without changing a character", () => {
    const html = renderEditorOverlay("Hi @Ana Costa", ["Ana Costa"]);
    expect(html).toContain("@Ana Costa</span>");
    const d = document.createElement("div");
    d.innerHTML = html;
    expect(d.textContent).toBe("Hi @Ana Costa");
  });
});

describe("MarkdownEditor without services", () => {
  it("is the plain editor it always was: no image button, no picker", () => {
    render(<Harness />);
    expect(screen.queryByText("Add image")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "@ana", selectionStart: 4 } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("MarkdownEditor with services", () => {
  it("offers people for an @query and inserts the chosen one", async () => {
    const searchPeople = vi.fn(async () => [ana]);
    render(<Harness services={{ searchPeople }} />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.change(box, { target: { value: "Meet @an", selectionStart: 8 } });
    await screen.findByRole("option", { name: /Ana Costa/ });
    expect(searchPeople).toHaveBeenCalledWith("an", expect.any(AbortSignal));

    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("Meet @[Ana Costa](user:u_ana-1) ");
    // Stored with the id, shown without it.
    expect(box.value).toBe("Meet @Ana Costa ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows a saved mention as @Label and keeps it linked while you type around it", () => {
    render(<Harness services={{ searchPeople: vi.fn(async () => []) }} initial="Hi @[Ana Costa](user:u_ana-1)" />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(box.value).toBe("Hi @Ana Costa");
    fireEvent.change(box, { target: { value: "Hi @Ana Costa, welcome", selectionStart: 22 } });
    expect(screen.getByTestId("value").textContent).toBe("Hi @[Ana Costa](user:u_ana-1), welcome");
  });

  it("deleting into a mention turns it back into plain text", () => {
    render(<Harness services={{ searchPeople: vi.fn(async () => []) }} initial="Hi @[Ana Costa](user:u_ana-1)" />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Hi @Ana Cost", selectionStart: 12 } });
    expect(screen.getByTestId("value").textContent).toBe("Hi @Ana Cost");
  });

  it("enforces the limit on the STORED text, ids included", () => {
    function Small() {
      const [v, setV] = useState("@[Ana Costa](user:u_ana-1)");
      return (<><RichTextServicesProvider value={{ searchPeople: vi.fn(async () => []) }}><MarkdownEditor value={v} onChange={setV} maxLength={30} /></RichTextServicesProvider><output data-testid="value">{v}</output></>);
    }
    render(<Small />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    // 26 stored characters; five more would make 31.
    fireEvent.change(box, { target: { value: "@Ana Costa hello", selectionStart: 16 } });
    expect(screen.getByTestId("value").textContent).toBe("@[Ana Costa](user:u_ana-1)");
    expect(screen.getByText("26 / 30")).toBeTruthy();
  });

  it("says so when nobody matches, and Escape closes the list", async () => {
    render(<Harness services={{ searchPeople: vi.fn(async () => []) }} />);
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "@zz", selectionStart: 3 } });
    await screen.findByText("No one found");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("uploads a chosen image and inserts it on its own line", async () => {
    const uploadImage = vi.fn(async () => "https://storage.googleapis.com/b/descriptions/u/1.png");
    const { container } = render(<Harness services={{ uploadImage }} initial="Lunch" />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.select(box, { target: { selectionStart: 5 } });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() => expect(screen.getByTestId("value").textContent)
      .toBe("Lunch\n![](https://storage.googleapis.com/b/descriptions/u/1.png)\n"));
    expect(uploadImage).toHaveBeenCalledWith(file);
  });

  it("takes a pasted image too", async () => {
    const uploadImage = vi.fn(async () => "https://x.test/p.png");
    render(<Harness services={{ uploadImage }} />);
    const file = new File([new Uint8Array([1])], "p.png", { type: "image/png" });
    await act(async () => {
      fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("![](https://x.test/p.png)\n"));
  });

  it("shows the server's reason when an upload is refused, and inserts nothing", async () => {
    const uploadImage = vi.fn(async () => { throw new ImageUploadError("That image is larger than 10 MB.", 413); });
    const { container } = render(<Harness services={{ uploadImage }} initial="x" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "b.jpg", { type: "image/jpeg" })] } });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("That image is larger than 10 MB.");
    expect(screen.getByTestId("value").textContent).toBe("x");
  });

  it("refuses an SVG before uploading it", async () => {
    const uploadImage = vi.fn(async () => "https://x.test/s.svg");
    const { container } = render(<Harness services={{ uploadImage }} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["<svg/>"], "s.svg", { type: "image/svg+xml" })] } });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPEG, PNG, WebP or GIF image.");
    expect(uploadImage).not.toHaveBeenCalled();
  });
});

describe("one services context across package copies", () => {
  it("is registered on globalThis under a shared symbol", () => {
    const key = Symbol.for("cobuntu.management-ui-shared.richTextServices");
    expect((globalThis as any)[key]).toBeTruthy();
  });
});
