import { richTextToPlain } from "../editor/richText";

/**
 * Flatten an HTML rich-text string into a plain-text preview: strip tags AND
 * decode the common entities a WYSIWYG editor emits (&nbsp;, &amp;, &#39;, …).
 *
 * Ported verbatim from the community-app's lib/htmlToPlainText so the shared
 * storefront card previews descriptions identically to the app. &amp; is
 * decoded LAST so it cannot double-decode an already-decoded entity, and
 * fromCodePoint (not fromCharCode) keeps emoji intact.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  // Descriptions are markdown now and can carry mentions and images: show a
  // mention as @Name and drop an image, rather than their stored syntax.
  return stripMarkdown(richTextToPlain(html))
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/(&#0*39;|&apos;)/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n: string) => safeCodePoint(parseInt(n, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Markdown markers out, words kept, so a card reads "Two communities. One
 * room." and not "**Two** communities. *One* room.". Line-start markers
 * (#, -, *, >, 1.) only mean something at the start of a line, so they go
 * while the newlines are still there, before the whitespace collapse.
 *
 * Safe on legacy HTML too: it has no `**`, and its tags carry no line-start
 * markers. Same rules as the product and event packages' own preview helpers.
 */
function stripMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(#{1,6}|>|[-*+]|\d+[.)])\s+/, ""))
    .join("\n")
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|\/)[^)\s]*\)/g, "$1")
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "$2")
    .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1")
    .replace(/(?<![_\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}
