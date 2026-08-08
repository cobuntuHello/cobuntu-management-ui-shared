"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Fixed-height modal with header/body/footer slots.
 *
 * The previous shell in each consumer package let the modal grow to
 * whatever its content needed, which made tall modals jump on every
 * step change. Here the body is scroll-locked at min(content, 80vh) so
 * the chrome stays put while the inner step swaps.
 *
 * Width presets cover the common sizes; pass a Tailwind class via
 * `width` to override.
 */
export type ModalShellWidth = "sm" | "md" | "lg" | string;

const WIDTH_PRESETS: Record<"sm" | "md" | "lg", string> = {
  sm: "w-[420px]",
  md: "w-[560px]",
  lg: "w-[720px]",
};

export interface ModalShellProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Element rendered between title and close button — wizard progress, tabs, etc. */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: ModalShellWidth;
  /** Modal vertical room; defaults to 80vh so the body scroll lock is meaningful. */
  maxHeight?: string;
  /** Skip the default close button — useful when the parent renders a back arrow + custom close. */
  hideCloseButton?: boolean;
  /** Click on backdrop dismisses; set false for forms that should require explicit close. */
  dismissOnBackdrop?: boolean;
  className?: string;
}

export function ModalShell({
  open = true,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  width = "md",
  maxHeight = "80vh",
  hideCloseButton = false,
  dismissOnBackdrop = true,
  className,
}: ModalShellProps) {
  // SSR guard: createPortal needs document.
  if (typeof document === "undefined" || !open) return null;

  const widthClass =
    width === "sm" || width === "md" || width === "lg"
      ? WIDTH_PRESETS[width]
      : width;

  return createPortal(
    <div
      /*
       * z-[120], not z-50. The community app's left sidebar sits at z-[52]
       * / z-[53] / z-[60], so at z-50 the backdrop dimmed the page but the
       * nav stayed lit and clickable — reported 2026-08-08 against the tier
       * modal on /marketplace/new. The admin app never showed it because its
       * rail is z-30.
       *
       * The ceiling matters as much as the floor. This has to stay BELOW the
       * portalled popovers that open from inside a modal, or they render
       * behind it: the community app's Select is z-[200] and the admin's
       * DatePicker is z-[9999]. 120 clears every app shell and stays under
       * both. Anything opening from inside a modal must be above this.
       */
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[120] p-4"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        className={cn(
          "rounded-xl shadow-xl flex flex-col",
          widthClass,
          className,
        )}
        // Theme-aware: consuming apps that set --bg-color / --text-color / --brand-color
        // (the community-app, per community) get the community's theme; apps that don't
        // (the admin) fall back to the original white/zinc light look.
        style={{ maxHeight, background: "var(--bg-color, #ffffff)", color: "var(--text-color, #18181b)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || headerExtra || !hideCloseButton) && (
          <header
            className="flex items-start gap-3 px-6 pt-5 pb-4 border-b"
            style={{ borderColor: "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)" }}
          >
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-[15px] font-semibold leading-tight truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[13px] mt-0.5" style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 55%, transparent)" }}>{subtitle}</p>
              )}
              {headerExtra && <div className="mt-3">{headerExtra}</div>}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg cursor-pointer transition-colors"
                style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 45%, transparent)" }}
              >
                <X className="size-4" />
              </button>
            )}
          </header>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <footer
            className="px-6 py-4 border-t rounded-b-xl"
            style={{
              borderColor: "color-mix(in srgb, var(--text-color, #18181b) 10%, transparent)",
              background: "color-mix(in srgb, var(--text-color, #18181b) 3%, transparent)",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
