/**
 * Mentions and images in a markdown description (T-321), as plain text.
 *
 * The description editor's value IS its markdown source, so both features are
 * text conventions rather than editor state:
 *
 *   - a mention is `@[Label](user:<id>)`, the format the feed already stores.
 *     It carries the immutable user id, so the link survives a handle change
 *     (links route by id, never by the handle snapshot), and a label that is
 *     only display text, snapshotted when the mention was written.
 *   - an image is ordinary markdown, `![](https://...)`, on its own line.
 *
 * Pure functions only, so the editor and its tests share one definition.
 */

/** One mention in stored text. Global: use with matchAll / replace. */
export const MENTION_PATTERN = /@\[([^\]\n]{1,80})\]\(user:([A-Za-z0-9_-]{1,64})\)/g;

/** One markdown image in stored text. Global: use with matchAll / replace. */
export const IMAGE_PATTERN = /!\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g;

export interface MentionPerson {
  id: string;
  name: string | null;
  usertag: string | null;
}

/**
 * The half-typed mention ending at the caret, if any: an `@` at the start of
 * the text or after whitespace / an opening bracket, then at least one
 * character that cannot end a word. Returns where the `@` sits, so the
 * completed token can replace exactly that span.
 *
 * Deliberately NOT a match for an email address ("ana@cobuntu.com"): the `@`
 * there follows a letter, not whitespace.
 */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|[\s(])@([^\s@[\]()]{1,40})$/u);
  if (!m) return null;
  const query = m[2];
  return { start: caret - query.length - 1, query };
}

/** The stored token for a person. Brackets and newlines cannot appear in the label. */
export function mentionToken(person: MentionPerson): string {
  const label = (person.name || person.usertag || "")
    .replace(/[[\]\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "someone";
  return `@[${label}](user:${person.id})`;
}

/**
 * Replace the half-typed `@query` (from `start` to `caret`) with the person's
 * token plus a space, and say where the caret goes next.
 */
export function insertMention(
  text: string, start: number, caret: number, person: MentionPerson,
): { text: string; caret: number } {
  const token = `${mentionToken(person)} `;
  return { text: text.slice(0, start) + token + text.slice(caret), caret: start + token.length };
}

/**
 * Insert an image at the caret, on a line of its own (markdown renders an
 * image mid-sentence inline, which is never what a host adding a photo wants).
 */
export function insertImage(text: string, caret: number, url: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  const lead = before.length === 0 || before.endsWith("\n") ? "" : "\n";
  const trail = after.startsWith("\n") ? "" : "\n";
  const block = `${lead}![](${url})${trail}`;
  return { text: before + block + after, caret: before.length + block.length };
}

/** Where a mention token links: the member page by immutable id. */
export function mentionHref(id: string): string {
  return `/members/${encodeURIComponent(id)}`;
}

/**
 * For a markdown renderer's URL transform: `user:<id>` (a mention) becomes the
 * member page, anything else is left to the renderer's own sanitiser. Without
 * this, a renderer that strips unknown protocols (react-markdown does) turns
 * every mention into a dead link.
 */
export function mentionUrlTransform(url: string): string | null {
  const m = /^user:([A-Za-z0-9_-]{1,64})$/.exec(url);
  return m ? mentionHref(m[1]) : null;
}
