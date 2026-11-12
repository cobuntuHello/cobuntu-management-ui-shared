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

/** The label a mention of this person shows. Brackets and newlines cannot appear in it. */
export function mentionLabel(person: MentionPerson): string {
  return (person.name || person.usertag || "")
    .replace(/[[\]\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "someone";
}

/** The stored token for a person. */
export function mentionToken(person: MentionPerson): string {
  return `@[${mentionLabel(person)}](user:${person.id})`;
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
 * Stored markdown → what the editor SHOWS: every mention token becomes plain
 * `@Label`, and the label → id pairs come back so the edit can be turned into
 * stored markdown again.
 *
 * The editor used to show the token itself, so tagging someone put
 * `(user:bb05b515-...)` in front of the host while they wrote. The id is
 * storage, not prose.
 */
export function mentionsToDisplay(markdown: string): { display: string; labels: Map<string, string> } {
  const labels = new Map<string, string>();
  const display = markdown.replace(MENTION_PATTERN, (_, label: string, id: string) => {
    labels.set(label, id);
    return `@${label}`;
  });
  return { display, labels };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * What the editor shows → stored markdown: every `@Label` whose label is a
 * known mention becomes its token again. Longest labels first, so "Ana Costa"
 * wins over "Ana". A label edited by even one character no longer matches, so
 * that mention simply turns back into plain text, which is what deleting into
 * it should do.
 *
 * `mentionsToDisplay(displayToMentions(d, labels).display)` is `d` itself, so a
 * controlled textarea keeps its caret across the round trip.
 */
export function displayToMentions(display: string, labels: Map<string, string>): string {
  const pattern = displayMentionPattern([...labels.keys()]);
  if (!pattern) return display;
  return display.replace(pattern, (_, lead: string, label: string) => `${lead}@[${label}](user:${labels.get(label)})`);
}

/**
 * Matches a shown `@Label` for any of `labels`: group 1 is the character
 * before the `@` (start of text, or anything that is not part of a word or an
 * email), group 2 the label. Null when there are no labels.
 */
export function displayMentionPattern(labels: string[]): RegExp | null {
  if (labels.length === 0) return null;
  const names = [...labels].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(^|[^\\p{L}\\p{N}_@])@(${names.join("|")})(?![\\p{L}\\p{N}_])`, "gu");
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
