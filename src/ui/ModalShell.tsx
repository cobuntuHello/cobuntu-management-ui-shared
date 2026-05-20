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
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        className={cn(
          "bg-white rounded-xl shadow-xl text-zinc-900 flex flex-col",
          widthClass,
          className,
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || headerExtra || !hideCloseButton) && (
          <header className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-zinc-100">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-[15px] font-semibold text-zinc-900 leading-tight truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</p>
              )}
              {headerExtra && <div className="mt-3">{headerExtra}</div>}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
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
          <footer className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/60 rounded-b-xl">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
