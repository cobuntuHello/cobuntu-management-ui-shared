"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { usePortalTarget } from "./portalContainer";
import { LAYERS } from "./layers";

/**
 * A detail panel that slides in from the side on md+ and up from the bottom
 * on phones, instead of expanding in place.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Products' Buyers tab used to expand a row in place to show a customer's
 * download/licence detail -- every row below it shoved down the page, and a
 * data panel (multiple download-usage lines + a licence paragraph) crammed
 * into an indented strip under a list row reads cramped no matter how it's
 * styled. Events already had a similar need (AttendeeDetailDrawer) and solved
 * it with a right-side drawer, but that one slides in from the right on EVERY
 * viewport, including phone width, where a from-the-side sheet reads oddly
 * next to the thumb's natural up/down gesture. This generalizes both: one
 * primitive, two edges, picked by viewport rather than by which package wrote
 * it.
 *
 * ── Why the edge is a CSS breakpoint, not a JS media query ──────────────────
 *
 * A `matchMedia` listener needs a mount effect and reads wrong on the very
 * first paint (SSR has no `window`), which is exactly the kind of flash this
 * component cannot afford mid-animation. Both edges render in the DOM at
 * once, Tailwind's `md:` prefix decides which is visible, and only ONE of
 * them ever actually transitions -- the other is `hidden` and skips layout
 * entirely, so there's no cost to always rendering both.
 *
 * ── Layering ─────────────────────────────────────────────────────────────
 *
 * Takes LAYERS.modal, exactly like ModalShell -- the two are mutually
 * exclusive in practice (a drawer opened from a list page, a modal opened
 * from a form), and sharing the number means a popover opened from inside
 * either one is already pitched correctly relative to both.
 */
export interface ResponsiveDrawerProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Element rendered beside the avatar/title, e.g. a status pill. */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Side-panel width at md+. Ignored on the phone (bottom sheet is full-width). */
  width?: string;
  dismissOnBackdrop?: boolean;
  className?: string;
}

export function ResponsiveDrawer({
  open = true,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  width = "max-w-lg",
  dismissOnBackdrop = true,
  className,
}: ResponsiveDrawerProps) {
  const portalTarget = usePortalTarget();

  /*
   * Mount/unmount is staggered from `open` by one transition, the same
   * pattern AttendeeDetailDrawer already uses: `visible` keeps the panel in
   * the DOM long enough for the close transition to play, `animating` is
   * flipped a frame after mount so the initial "off-screen" position is
   * what actually paints first (otherwise the panel opens already in place,
   * with no slide).
   */
  const [visible, setVisible] = React.useState(open);
  const [animating, setAnimating] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setVisible(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      return () => cancelAnimationFrame(raf);
    }
    setAnimating(false);
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setAnimating(false);
    setTimeout(onClose, 300);
  }

  if (typeof document === "undefined" || !visible || !portalTarget) return null;

  const panelStyle: React.CSSProperties = {
    background: "var(--bg-color, #ffffff)",
    color: "var(--text-color, #18181b)",
  };
  const borderColor = "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)";

  const header = (title || headerExtra || true) && (
    <header className="flex items-start gap-3 px-5 pt-5 pb-4 border-b shrink-0" style={{ borderColor }}>
      <div className="flex-1 min-w-0">
        {title && <h2 className="text-[15px] font-semibold leading-tight truncate">{title}</h2>}
        {subtitle && (
          <p className="text-[12.5px] mt-0.5" style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 55%, transparent)" }}>
            {subtitle}
          </p>
        )}
        {headerExtra && <div className="mt-2.5">{headerExtra}</div>}
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close"
        className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg cursor-pointer transition-colors"
        style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 45%, transparent)" }}
      >
        <X className="size-4" />
      </button>
    </header>
  );

  const body = <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>;

  const footerEl = footer && (
    <footer
      className="px-5 py-4 border-t shrink-0"
      style={{ borderColor, background: "color-mix(in srgb, var(--text-color, #18181b) 3%, transparent)" }}
    >
      {footer}
    </footer>
  );

  return createPortal(
    <>
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{ zIndex: LAYERS.modal, background: animating ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)" }}
        onClick={dismissOnBackdrop ? handleClose : undefined}
      />

      {/* md+: side panel, slides in from the right. */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "hidden md:flex fixed inset-y-0 right-0 w-full flex-col rounded-l-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out",
          width,
          animating ? "translate-x-0" : "translate-x-full",
          className,
        )}
        style={{ zIndex: LAYERS.modal, ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        {body}
        {footerEl}
      </div>

      {/* Below md: bottom sheet, slides up. Capped height so a long detail
          panel scrolls inside the sheet rather than the sheet covering the
          whole screen edge to edge. */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex md:hidden fixed inset-x-0 bottom-0 flex-col rounded-t-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out max-h-[85vh]",
          animating ? "translate-y-0" : "translate-y-full",
          className,
        )}
        style={{ zIndex: LAYERS.modal, ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab-handle affordance. Decorative only -- backdrop tap and the
            close button both already dismiss, this just signals "sheet". */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span className="h-1 w-9 rounded-full" style={{ background: "color-mix(in srgb, var(--text-color, #18181b) 18%, transparent)" }} />
        </div>
        {header}
        {body}
        {footerEl}
      </div>
    </>,
    portalTarget,
  );
}
