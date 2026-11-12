"use client";

import { useRef, useLayoutEffect, useState, useCallback, useEffect, useMemo } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useSharedT } from "../i18n";
import type { PersonSearchResult } from "../lib/searchPeople";
import { useRichTextServices, ImageUploadError } from "./RichTextServices";
import {
  mentionQueryAt, mentionLabel, insertImage, mentionsToDisplay, displayToMentions, displayMentionPattern,
} from "./richText";

export interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  autoFocus?: boolean;
  /** Hard cap on the stored value's length, enforced on the textarea itself
   * and surfaced as an always-visible "n / max" counter. Defaults to 2000:
   * a description is free text, not a one-line label, and a silent
   * truncation would be worse than a visible ceiling. */
  maxLength?: number;
  /** Offer @mentions when the host provides people search. Default on. */
  mentions?: boolean;
  /** Offer images when the host provides an uploader. Default on. */
  images?: boolean;
  /**
   * Fill the parent's height instead of growing with the text, on a flat
   * white writing surface. For an editor that IS the whole dialog
   * (DescriptionDialog): growing to a 200px cap left the rest of a tall
   * dialog empty. The parent must give it a definite height (a flex child
   * with min-h-0 is enough).
   */
  fill?: boolean;
  /**
   * Buttons for the right end of the editor's bottom row (Cancel / Done).
   * With these, "Add image" and the counter move together to the left, so a
   * dialog needs one row under the text rather than two.
   */
  actions?: React.ReactNode;
}

/**
 * A plain-text input that looks like it understands markdown while you type
 * it: Discord/Obsidian-style live preview, not a WYSIWYG editor. The value
 * IS the markdown source (what gets saved), never HTML. The bold/italic/etc.
 * you see is a read-only overlay rendered from that same text and pinned
 * exactly on top of a transparent-text textarea, so every native textarea
 * behaviour (caret, selection, undo, spellcheck, resize) keeps working for
 * free instead of being reimplemented.
 *
 * ONE editor for events, products and courses (T-321). It used to exist as two
 * near-identical copies, in event-management-ui and product-management-ui (and
 * courses used the product one), which is how features like these drift
 * apart. Both packages now re-export this.
 *
 * @mentions and images (T-321) are TEXT conventions (see richText.ts), so the
 * overlay styles them with colour only: anything that changed glyph widths
 * would pull the overlay out of line with the caret underneath it.
 */

const MAX_GROW_PX = 200;
const SEARCH_DEBOUNCE_MS = 180;
const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/gif";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatLine(raw: string, mentionPattern: RegExp | null): string {
  let line = escapeHtml(raw);

  // Every multi-character delimiter (code/bold/strike, and now mentions and
  // images) is matched and immediately masked behind a placeholder token, so
  // its own literal characters can never be re-matched by a later pass. That
  // matters doubly for mentions and images: a user id or a URL routinely
  // contains `_` or `*`, which the italic pass would otherwise eat.
  const tokens: string[] = [];
  const mask = (html: string) => {
    const i = tokens.length;
    tokens.push(html);
    return `\u0000${i}\u0000`;
  };

  line = line.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, (whole) =>
    mask(`<span class="text-zinc-400">${whole}</span>`),
  );
  line = line.replace(/@\[([^\]]{1,80})\]\((user:[A-Za-z0-9_-]{1,64})\)/g, (_, label, target) =>
    mask(`<span style="color: var(--brand-color, #2563eb)">@[${label}]</span><span class="text-zinc-300">(${target})</span>`),
  );
  // A mention as the editor shows it: `@Label`, coloured. Same characters as
  // the textarea underneath, so the caret stays aligned.
  if (mentionPattern) {
    mentionPattern.lastIndex = 0;
    line = line.replace(mentionPattern, (_, lead: string, label: string) =>
      `${lead}${mask(`<span style="color: var(--brand-color, #2563eb)">@${label}</span>`)}`,
    );
  }
  line = line.replace(/`([^`\n]+)`/g, (_, inner) =>
    mask(`<span class="text-zinc-300">\`</span><code class="font-mono text-[0.9em] bg-zinc-900/5 rounded px-1">${inner}</code><span class="text-zinc-300">\`</span>`),
  );
  line = line.replace(/\*\*(.+?)\*\*/g, (_, inner) =>
    mask(`<span class="text-zinc-300">**</span><strong class="text-zinc-900">${inner}</strong><span class="text-zinc-300">**</span>`),
  );
  line = line.replace(/__(.+?)__/g, (_, inner) =>
    mask(`<span class="text-zinc-300">__</span><strong class="text-zinc-900">${inner}</strong><span class="text-zinc-300">__</span>`),
  );
  line = line.replace(/~~(.+?)~~/g, (_, inner) =>
    mask(`<span class="text-zinc-300">~~</span><del class="text-zinc-500">${inner}</del><span class="text-zinc-300">~~</span>`),
  );

  line = line
    .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '<span class="text-zinc-300">*</span><em>$1</em><span class="text-zinc-300">*</span>')
    .replace(/(?<![_\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '<span class="text-zinc-300">_</span><em>$1</em><span class="text-zinc-300">_</span>');

  line = line.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);

  const heading = line.match(/^(#{1,3})(\s+)(.*)$/);
  if (heading) {
    const level = heading[1].length;
    const sizeClass = level === 1 ? "font-bold text-[1.15em]" : level === 2 ? "font-bold text-[1.08em]" : "font-semibold";
    return `<span class="text-zinc-300">${heading[1]}</span>${heading[2]}<span class="${sizeClass}">${heading[3]}</span>`;
  }
  const quote = line.match(/^(&gt;)(\s+)(.*)$/);
  if (quote) {
    return `<span class="text-zinc-300">&gt;</span>${quote[2]}<span class="italic text-zinc-500">${quote[3]}</span>`;
  }
  const bullet = line.match(/^([-*])(\s+)(.*)$/);
  if (bullet) {
    return `<span class="text-zinc-300">${bullet[1]}</span>${bullet[2]}${bullet[3]}`;
  }
  const ordered = line.match(/^(\d+\.)(\s+)(.*)$/);
  if (ordered) {
    return `<span class="text-zinc-300">${ordered[1]}</span>${ordered[2]}${ordered[3]}`;
  }
  return line;
}

/**
 * Exported for tests: the overlay HTML for the text the editor shows.
 * `mentionLabels` are the labels of the mentions in it, which render as a
 * coloured `@Label`.
 */
export function renderEditorOverlay(value: string, mentionLabels: string[] = []): string {
  // The pattern is matched against HTML-escaped text, so the labels are escaped too.
  const pattern = displayMentionPattern(mentionLabels.map(escapeHtml));
  return value.length ? value.split("\n").map((l) => formatLine(l, pattern)).join("\n") : "";
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 6,
  autoFocus,
  maxLength = 2000,
  mentions = true,
  images = true,
  fill = false,
  actions,
}: MarkdownEditorProps) {
  const t = useSharedT("shared.managementUi.markdownEditor");
  const services = useRichTextServices();
  const canMention = mentions && !!services.searchPeople;
  const canImage = images && !!services.uploadImage;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // ── Shown text vs stored text ──
  // `value` is the stored markdown, where a mention is `@[Label](user:<id>)`.
  // The textarea shows `display`, where it is just `@Label`: the id is for
  // storage and links, never for the person writing. Every edit is turned
  // back into markdown with the label → id pairs seen so far (kept across
  // renders, so undoing a deleted mention brings its link back too).
  const knownMentions = useRef(new Map<string, string>());
  const { display, mentionLabels } = useMemo(() => {
    const parsed = mentionsToDisplay(value);
    parsed.labels.forEach((id, label) => knownMentions.current.set(label, id));
    return { display: parsed.display, mentionLabels: [...parsed.labels.keys()] };
  }, [value]);
  const caretRef = useRef(display.length);

  /** Store an edit of the shown text. False when it would pass the limit. */
  const commit = (nextDisplay: string, extra?: [string, string]): boolean => {
    if (extra) knownMentions.current.set(extra[0], extra[1]);
    const markdown = displayToMentions(nextDisplay, knownMentions.current);
    if (markdown.length > maxLength) return false;
    onChange(markdown);
    return true;
  };

  // ── Mention picker state ──
  const [mentionAt, setMentionAt] = useState<{ start: number; query: string } | null>(null);
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [searched, setSearched] = useState(false);

  // ── Image state ──
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Grows with content up to MAX_GROW_PX (a nicer typing feel than a rigid
  // fixed-height box from the first keystroke), then stops and scrolls
  // internally instead of pushing the modal around it taller without bound.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // In fill mode the height comes from the parent (h-full), and the
    // textarea scrolls on its own once the text outgrows it.
    if (fill) {
      el.style.height = "";
      el.style.overflowY = "auto";
      return;
    }
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_GROW_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_GROW_PX ? "auto" : "hidden";
  }, [fill]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  // The overlay is pinned on top of the textarea, not inside it, so once the
  // textarea scrolls internally the overlay has to be scrolled with it.
  const handleScroll = useCallback(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  /** Re-read the caret and whether it sits at the end of a half-typed `@name`. */
  const syncCaret = useCallback((text: string, caret: number) => {
    caretRef.current = caret;
    if (!canMention) return;
    const at = mentionQueryAt(text, caret);
    setMentionAt((prev) => (prev?.start === at?.start && prev?.query === at?.query ? prev : at));
  }, [canMention]);

  // Search as the query changes, debounced, cancelling the previous request.
  useEffect(() => {
    if (!canMention || !mentionAt || mentionAt.query.length < 2) {
      setPeople([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      services.searchPeople!(mentionAt.query, ctrl.signal)
        .then((rows) => {
          if (ctrl.signal.aborted) return;
          setPeople(rows.slice(0, 6));
          setActive(0);
          setSearched(true);
        })
        .catch(() => { if (!ctrl.signal.aborted) { setPeople([]); setSearched(true); } });
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [canMention, mentionAt, services]);

  const placeCaret = (caret: number) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
      caretRef.current = caret;
    });
  };

  const pick = (person: PersonSearchResult) => {
    if (!mentionAt) return;
    const label = mentionLabel(person);
    const shown = `@${label} `;
    const text = display.slice(0, mentionAt.start) + shown + display.slice(caretRef.current);
    if (!commit(text, [label, person.id])) return;
    setMentionAt(null);
    setPeople([]);
    placeCaret(mentionAt.start + shown.length);
  };

  const pickerOpen = canMention && !!mentionAt && mentionAt.query.length >= 2 && (people.length > 0 || searched);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!pickerOpen) return;
    if (e.key === "Escape") { e.preventDefault(); setMentionAt(null); return; }
    if (people.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % people.length); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + people.length) % people.length); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(people[active]); }
  };

  const addImage = async (file: File | null | undefined) => {
    if (!file || !canImage || uploading) return;
    if (!ACCEPTED_IMAGES.split(",").includes(file.type)) {
      setImageError(t("unsupportedImage"));
      return;
    }
    setImageError(null);
    setUploading(true);
    try {
      const url = await services.uploadImage!(file);
      const next = insertImage(display, caretRef.current, url);
      if (!commit(next.text)) {
        setImageError(t("noRoomForImage"));
        return;
      }
      placeCaret(next.caret);
    } catch (err) {
      setImageError(err instanceof ImageUploadError && err.message ? err.message : t("imageFailed"));
    } finally {
      setUploading(false);
    }
  };

  const imageFrom = (items: FileList | null | undefined): File | null => {
    if (!items) return null;
    for (const f of Array.from(items)) if (f.type.startsWith("image/")) return f;
    return null;
  };

  const html = renderEditorOverlay(display, mentionLabels);
  const atLimit = value.length >= maxLength;

  // Fill mode is a flat sheet of paper: white, a hairline edge, no grey fill.
  // The grey fill read as a sunken box inside the dialog; white stays readable
  // on every community theme, dark ones included, because the overlay text is
  // a fixed dark zinc.
  const surface = fill
    ? disabled
      ? "bg-white opacity-60 ring-1 ring-black/[0.07]"
      : focused
      ? "bg-white ring-1 ring-black/[0.16] shadow-[0_0_0_4px_rgba(24,24,27,0.05)]"
      : "bg-white ring-1 ring-black/[0.08] hover:ring-black/[0.12]"
    : disabled
    ? "bg-zinc-50 opacity-60"
    : focused
    ? "bg-white shadow-[0_1px_2px_rgba(16,24,32,0.04),0_0_0_4px_rgba(24,24,27,0.05)] ring-1 ring-zinc-200"
    : "bg-zinc-50 ring-1 ring-transparent hover:ring-zinc-100";

  const counter = (
    <p className={`shrink-0 text-[11px] tabular-nums ${atLimit ? "text-red-500" : "text-zinc-400"}`}>
      {value.length} / {maxLength}
    </p>
  );

  return (
    // Fill mode: the root grows in a flex parent (flex-1) or takes a definite
    // parent height (h-full), and the textarea is pinned to the surface
    // (absolute inset-0) rather than sized by a percentage height, which
    // collapses to `rows` whenever the parent's height is not definite (a
    // sheet with only a min-height, as in the course builder).
    <div className={fill ? "flex h-full min-h-0 flex-1 flex-col" : undefined}>
      <div
        className={`group relative rounded-2xl transition-all duration-150 ${surface} ${fill ? "min-h-[120px] flex-1" : ""}`}
      >
        <div
          ref={overlayRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3.5 text-[14.5px] leading-relaxed text-zinc-800"
          dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
        />
        <textarea
          ref={textareaRef}
          value={display}
          onChange={(e) => {
            // Over the limit: nothing is stored, so the controlled textarea
            // stays as it was (the same effect as the old maxLength attribute,
            // which can no longer be used: it would count the shown text, not
            // the stored one with its mention ids).
            if (commit(e.target.value)) syncCaret(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => syncCaret(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          onScroll={handleScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => setMentionAt(null), 150); }}
          onPaste={(e) => {
            const img = canImage ? imageFrom(e.clipboardData?.files) : null;
            if (img) { e.preventDefault(); void addImage(img); }
          }}
          onDragOver={(e) => { if (canImage && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
          onDrop={(e) => {
            const img = canImage ? imageFrom(e.dataTransfer?.files) : null;
            if (img) { e.preventDefault(); void addImage(img); }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={minRows}
          spellCheck
          aria-autocomplete={canMention ? "list" : undefined}
          aria-expanded={canMention ? pickerOpen : undefined}
          className={`${fill ? "absolute inset-0 h-full" : "relative"} w-full resize-none whitespace-pre-wrap break-words border-0 bg-transparent px-4 py-3.5 text-[14.5px] leading-relaxed text-transparent caret-zinc-900 outline-none placeholder:text-zinc-300`}
        />
      </div>

      {/* The @ picker sits IN FLOW under the field rather than floating at
          the caret: these editors live inside modals and scroll containers,
          and an absolutely positioned list is exactly what those clip. */}
      {pickerOpen && (
        <ul role="listbox" aria-label={t("mentionSomeone")}
          className="mt-1.5 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200 shadow-[0_8px_24px_-12px_rgba(16,24,32,0.25)]">
          {people.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-zinc-400">{t("noPeopleFound")}</li>
          ) : people.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                // mousedown, not click: a click lets the textarea blur first,
                // and blur closes the picker before the pick lands.
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] cursor-pointer ${i === active ? "bg-zinc-100" : "bg-white"}`}
              >
                {p.profileImage ? (
                  <img src={p.profileImage} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full bg-zinc-200" />
                )}
                <span className="min-w-0 truncate text-zinc-900">{p.name || p.usertag}</span>
                {p.usertag && <span className="min-w-0 truncate text-zinc-400">@{p.usertag}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`${actions ? "mt-4" : "mt-1"} flex items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-2.5">
          {canImage && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
                {uploading ? t("uploadingImage") : t("addImage")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGES}
                className="hidden"
                onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ""; }}
              />
            </>
          )}
          {actions && counter}
          {imageError && <p role="alert" className="min-w-0 truncate text-[11.5px] text-red-500">{imageError}</p>}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : counter}
      </div>
    </div>
  );
}
