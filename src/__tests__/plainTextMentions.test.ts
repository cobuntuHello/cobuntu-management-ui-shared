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

describe("plain-text previews: markdown markers", () => {
  it("drops markers, keeps the words", () => {
    const md = "# Sunset hike\n\n**Two** communities. *One* room. ~~old~~ `code`\n- Meet at the station\n1. Bring water\n> Quiet please\nSee [our map](https://x.test/m).";
    expect(htmlToPlainText(md)).toBe(
      "Sunset hike Two communities. One room. old code Meet at the station Bring water Quiet please See our map.",
    );
  });

  it("leaves snake_case, a lone asterisk and arithmetic alone", () => {
    expect(htmlToPlainText("file_name_here costs 2 * 3 euros")).toBe("file_name_here costs 2 * 3 euros");
  });

  it("still flattens legacy HTML", () => {
    expect(htmlToPlainText("<p><strong>Hi</strong> &amp; welcome</p>")).toBe("Hi & welcome");
  });
});
