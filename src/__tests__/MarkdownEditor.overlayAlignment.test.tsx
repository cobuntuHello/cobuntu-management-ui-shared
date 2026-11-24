/**
 * T-398: selecting text in the description editor highlighted blank space.
 *
 * The editor is an invisible textarea (it owns the caret, the selection and
 * every click) under a read-only overlay that draws the formatted text. They
 * only line up while the overlay draws every character exactly as wide and
 * as tall as the textarea does. It did not: headings were drawn at 1.15em,
 * bold in the wider bold face and code in monospace with padding, so the
 * selection drifted off the words from the first heading down; selecting
 * also painted the textarea's hidden copy of the words in the highlight
 * colour; and on phones the community app forces textareas to 16px while the
 * overlay stayed at 14.5px.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MarkdownEditor, renderEditorOverlay } from "../editor/MarkdownEditor";

const EVERY_CONSTRUCT = [
  "# Finance Social Club: November mixer",
  "## What to expect",
  "### Small print",
  "Join us for **good conversation** and __better wine__, ~~no~~ *real* _talk_.",
  "- Drinks, with `vegan` options",
  "1. Doors at 19:00",
  "> Seats are limited",
].join("\n");

const visibleText = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent;
};

const overlayOf = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]') as HTMLDivElement;

afterEach(() => {
  cleanup();
  document.querySelectorAll("style[data-test-host]").forEach((s) => s.remove());
});

describe("the overlay never changes a glyph's size, width or line height", () => {
  it("keeps every character of the text", () => {
    expect(visibleText(renderEditorOverlay(EVERY_CONSTRUCT))).toBe(EVERY_CONSTRUCT);
  });

  it("uses no class that sizes text, swaps to a heavier or monospace face, or pads an inline run", () => {
    const html = renderEditorOverlay(EVERY_CONSTRUCT);
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    const offending = classes.filter((c) =>
      /^text-\[/.test(c) ||
      /^text-(xs|sm|base|lg|[2-9]?xl)$/.test(c) ||
      /^font-(mono|medium|semibold|bold|extrabold|black)$/.test(c) ||
      /^(p|px|py|pl|pr|pt|pb|m|mx|ml|mr)-/.test(c),
    );
    expect(offending).toEqual([]);
  });

  it("draws a heading as bold at the body size, at every level", () => {
    for (const marks of ["#", "##", "###"]) {
      const host = document.createElement("div");
      host.innerHTML = renderEditorOverlay(`${marks} Title`);
      const title = [...host.querySelectorAll("span")].find((s) => s.textContent === "Title")!;
      expect(title.getAttribute("style")).toContain("-webkit-text-stroke");
      expect(title.className).not.toMatch(/text-\[|font-/);
    }
  });

  it("draws bold as a stroke over the regular face, both spellings", () => {
    for (const src of ["**bold**", "__bold__"]) {
      const host = document.createElement("div");
      host.innerHTML = renderEditorOverlay(src);
      const strong = host.querySelector("strong")!;
      expect(strong.textContent).toBe("bold");
      // inherit undoes the browser's `strong { font-weight: bolder }`.
      expect(strong.getAttribute("style")).toContain("font-weight:inherit");
      expect(strong.getAttribute("style")).toContain("-webkit-text-stroke");
    }
  });

  it("keeps code in the body font with no padding", () => {
    const host = document.createElement("div");
    host.innerHTML = renderEditorOverlay("with `vegan` options");
    const code = host.querySelector("code")!;
    expect(code.getAttribute("style")).toContain("font:inherit");
    expect(code.className).not.toMatch(/font-mono|px-|text-\[/);
  });
});

describe("selecting text", () => {
  it("never paints the textarea's hidden copy of the words", () => {
    const { container } = render(<MarkdownEditor value="Hello" onChange={() => {}} />);
    const ta = container.querySelector("textarea")!;
    expect(ta.className).toContain("text-transparent");
    expect(ta.className).toContain("selection:text-transparent");
  });
});

describe("the overlay follows the textarea's computed typography", () => {
  it("takes a host stylesheet's text-field size (the app's 16px on phones)", () => {
    const style = document.createElement("style");
    style.setAttribute("data-test-host", "");
    style.textContent = "textarea { font-size: 16px; line-height: 26px; letter-spacing: 0.01em; }";
    document.head.appendChild(style);

    const { container } = render(<MarkdownEditor value="# Title\nBody" onChange={() => {}} />);
    const overlay = overlayOf(container);
    expect(overlay.style.fontSize).toBe("16px");
    expect(overlay.style.lineHeight).toBe("26px");
    expect(overlay.style.letterSpacing).toBe("0.01em");
  });

  it("follows the textarea in fill mode too", () => {
    const style = document.createElement("style");
    style.setAttribute("data-test-host", "");
    style.textContent = "textarea { font-size: 17px; }";
    document.head.appendChild(style);

    const { container } = render(<MarkdownEditor value="Body" onChange={() => {}} fill />);
    expect(overlayOf(container).style.fontSize).toBe("17px");
  });
});
