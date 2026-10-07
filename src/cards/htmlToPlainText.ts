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
  return html
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

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}
