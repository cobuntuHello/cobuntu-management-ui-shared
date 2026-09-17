"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * The handful of primitives the donations editor needs, kept LOCAL to this
 * module rather than promoted from the packages' PriceEditModal/_primitives.tsx.
 *
 * That file says, in its own words, that its primitives are "intentionally kept
 * in this directory (not promoted to @cobuntu/management-ui-shared) because
 * they're tuned to the cramped tier-card density - the shared package's
 * primitives target the full-width modal step layout instead."
 *
 * That decision stands. Consolidating the donations editor (T-123) does not
 * require overturning it: this module takes its own small copies, the packages
 * keep theirs for the rest of PriceEditModal, and nothing else moves. The trade
 * is deliberate and it is a good one - roughly 120 lines of tiny, behaviour-free
 * primitives duplicated here, against two 335-line copies of a real editor with
 * real behaviour removed from the packages.
 *
 * These are visually identical to the package versions. Do not "improve" them
 * independently; that is exactly how the editor drifted in the first place.
 */

/**
 * HelpTip - the ⓘ affordance next to a field label.
 *
 * Deliberately built WITHOUT @radix-ui/react-popover, which is what the package
 * version uses. This package depends on class-variance-authority, clsx,
 * lucide-react and tailwind-merge and NOTHING else; adding radix here would push
 * it onto every app that consumes shared, to render one tooltip. So the few
 * things Radix was doing for us are done by hand:
 *
 *   - PORTALLED to document.body, because the tip must escape ModalShell's
 *     overflow clipping. This is the reason the original reached for a portal
 *     at all, so it is not optional.
 *   - z-[200], above ModalShell's z-[120] backdrop.
 *   - Positioned from the trigger's rect, opening ABOVE and aligned to its left
 *     edge, flipping below when there is not room above.
 *   - Dismisses on outside pointer-down, Escape, scroll and resize. Scroll
 *     matters because the position is captured once, not tracked.
 */
export function HelpTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onPointer = (e: PointerEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    // Capture phase: the tip's position is a snapshot, so any scroll of any
    // ancestor invalidates it. Cheaper and more honest than re-measuring.
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const toggle = (e: React.MouseEvent) => {
    // The trigger often sits inside a clickable row; opening help must not also
    // open whatever is behind it.
    e.stopPropagation();
    e.preventDefault();
    const next = !open;
    if (next) setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(next);
  };

  // Above the trigger by default; below when the top would clip.
  const ESTIMATED_HEIGHT = 64;
  const above = !rect || rect.top > ESTIMATED_HEIGHT + 12;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label ? `Help: ${label}` : "Help"}
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center justify-center text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer align-middle"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && rect && typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: Math.max(12, rect.left),
              ...(above
                ? { top: rect.top - 6, transform: "translateY(-100%)" }
                : { top: rect.bottom + 6 }),
            }}
            className="z-[200] max-w-[240px] rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-normal normal-case tracking-normal leading-relaxed text-white shadow-lg"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Eyebrow - the uppercase field label, with an optional ⓘ help popover and an
 * optional right-aligned character counter (red past the max). Both opt-in, so
 * a bare `<Eyebrow>Label</Eyebrow>` renders exactly as it always did.
 */
export function Eyebrow({
  children,
  help,
  count,
  max,
}: {
  children: React.ReactNode;
  help?: string;
  count?: number;
  max?: number;
}) {
  const showCounter = typeof count === "number" && typeof max === "number";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 min-w-0">
        <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider truncate">
          {children}
        </label>
        {help && (
          <HelpTip text={help} label={typeof children === "string" ? children : undefined} />
        )}
      </span>
      {showCounter && (
        <span
          className={`text-[10px] tabular-nums shrink-0 ${count! > max! ? "text-red-500" : "text-zinc-300"}`}
        >
          {count}/{max}
        </span>
      )}
    </div>
  );
}

/**
 * Collapse - animates height-auto reveals with the grid-template-rows 0fr/1fr
 * trick. No measurement, no JS, no dependency. The inner div clips children
 * during the transition.
 */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/** Switch - the small pill toggle used across the tier cards. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-zinc-900" : "bg-zinc-300",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
