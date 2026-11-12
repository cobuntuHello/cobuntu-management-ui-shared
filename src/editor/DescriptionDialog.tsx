"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "../ui/portalContainer";
import { LAYERS } from "../ui/layers";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * The one "write a description" dialog for events, products and courses.
 *
 * It replaces three hand-built dialogs that each wrapped MarkdownEditor in a
 * fixed-height box. The editor grows only to ~200px, so the bottom third of
 * those dialogs was empty; they also had a grey, inset text box on a cream
 * panel, a top X next to a Cancel button, and "Add image" on its own row above
 * the buttons. Here the writing surface fills the dialog, and image, counter
 * and buttons share one row.
 *
 * Phones get a full-height sheet sized to the VISUAL viewport, so the on-screen
 * keyboard shortens the sheet instead of covering the text being typed.
 *
 * The dialog edits a DRAFT. Done hands the draft to `onDone`; Cancel drops it.
 * Esc and a backdrop click also cancel, but only while nothing has been typed:
 * once the draft differs from `value`, a stray click outside the panel must not
 * throw the writing away (a host lost a whole registration form to exactly that
 * in the tier modal, 2026-11-06). Cancel is the deliberate way out.
 */
export interface DescriptionDialogProps {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The saved description. The draft is re-seeded from it each time the dialog opens. */
  value: string;
  placeholder?: string;
  cancelLabel: string;
  doneLabel: string;
  onCancel: () => void;
  onDone: (next: string) => void;
  /** Disables Done (and shows `busyLabel` on it) while the host saves. */
  busy?: boolean;
  busyLabel?: string;
  maxLength?: number;
}

const NARROW = "(max-width: 639px)";

/** The visual viewport's box on a phone (keyboard excluded), or null on wider screens. */
function useNarrowVisualViewport(active: boolean): { top: number; height: number } | null {
  const [box, setBox] = React.useState<{ top: number; height: number } | null>(null);
  React.useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const mq = window.matchMedia?.(NARROW);
    const vv = window.visualViewport;
    const update = () => {
      if (!mq?.matches) { setBox(null); return; }
      setBox(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    mq?.addEventListener?.("change", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      mq?.removeEventListener?.("change", update);
    };
  }, [active]);
  return active ? box : null;
}

export function DescriptionDialog({
  open,
  title,
  subtitle,
  value,
  placeholder,
  cancelLabel,
  doneLabel,
  onCancel,
  onDone,
  busy = false,
  busyLabel,
  maxLength,
}: DescriptionDialogProps) {
  const portalTarget = usePortalTarget();
  const [draft, setDraft] = React.useState(value);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const downOnBackdrop = React.useRef(false);
  const narrow = useNarrowVisualViewport(open);
  const titleId = React.useId();

  // Re-seed on every open, so a cancelled draft never comes back.
  React.useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the text with the caret at the END: an existing description is
  // usually opened to add to it.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const ta = panelRef.current?.querySelector("textarea");
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const dirty = draft !== value;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // The mention picker handles its own Escape and stops there.
      if (e.key === "Escape" && !e.defaultPrevented && !dirty) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dirty, onCancel]);

  if (!open || typeof document === "undefined" || !portalTarget) return null;

  const muted = "color-mix(in srgb, var(--text-color, #18181b) 55%, transparent)";

  return createPortal(
    <div
      data-testid="description-dialog-backdrop"
      className="fixed inset-x-0 flex items-end justify-center bg-black/40 sm:inset-y-0 sm:items-center sm:p-4"
      style={{
        zIndex: LAYERS.modal,
        ...(narrow ? { top: narrow.top, height: narrow.height } : { top: 0, bottom: 0 }),
      }}
      // Only a click that STARTED on the backdrop counts (see ModalShell).
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        const startedHere = downOnBackdrop.current;
        downOnBackdrop.current = false;
        if (startedHere && e.target === e.currentTarget && !dirty) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-2xl px-5 pt-5 shadow-xl sm:w-[720px] sm:max-w-full sm:rounded-2xl sm:px-6"
        style={{
          height: narrow ? Math.max(0, narrow.height - 12) : "min(640px, 85vh)",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
          background: "var(--bg-color, #ffffff)",
          color: "var(--text-color, #18181b)",
        }}
      >
        <div className="shrink-0">
          <h2 id={titleId} className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-[13px] leading-snug" style={{ color: muted }}>{subtitle}</p>
          )}
        </div>

        <div className="min-h-0 flex-1">
          <MarkdownEditor
            fill
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            maxLength={maxLength}
            actions={
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="cursor-pointer rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors"
                  style={{ background: "color-mix(in srgb, var(--text-color, #18181b) 7%, transparent)" }}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onDone(draft)}
                  disabled={busy}
                  className="cursor-pointer rounded-full px-5 py-2 text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--brand-color, #18181b)", color: "var(--brand-contrast, #fff)" }}
                >
                  {busy && busyLabel ? busyLabel : doneLabel}
                </button>
              </>
            }
          />
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
