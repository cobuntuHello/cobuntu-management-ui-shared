/**
 * Plain-text previews of a description (cards, search, link previews, the
 * calendar file) show a mention as @Name and drop images, instead of printing
 * their stored markdown.
 */
import { describe, it, expect } from "vitest";
import { htmlToPlainText } from "../cards/htmlToPlainText";
import { richTextToPlain } from "../editor/richText";

const md = "Hike with @[Stella Marie Viereck](user:bb05b515-b1a3_4579) at sunset.\n![](https://storage.googleapis.com/b/x_y.png)\nBring water.";

describe("plain-text previews", () => {
  it("richTextToPlain: mention as @Name, image gone", () => {
    expect(richTextToPlain(md)).toBe("Hike with @Stella Marie Viereck at sunset.\n \nBring water.");
  });

  it("htmlToPlainText (cards, search, link previews) reads as prose", () => {
    expect(htmlToPlainText(md)).toBe("Hike with @Stella Marie Viereck at sunset. Bring water.");
  });

  it("leaves an email address and plain @text alone", () => {
    expect(htmlToPlainText("Write to ana@cobuntu.com or @ana")).toBe("Write to ana@cobuntu.com or @ana");
  });
});
