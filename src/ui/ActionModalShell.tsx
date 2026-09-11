"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * The full-bleed-on-mobile action modal used by every "do something to people"
 * surface: add attendees, invite guests, add a host, add a co-seller.
 *
 * ── Why it lives here now ───────────────────────────────────────────
 *
 * It was AttendeesActionModalShell inside the events package, and it was the
 * reason the events host flow felt good and the product co-seller flow did
 * not. The product package had its own plain ModalShell, so the two surfaces
 * for the same job (give this person management access to this thing) behaved
 * differently on mobile, animated differently, and dismissed differently.
 * Copying it would have made a third divergent copy; this is the same shell,
 * consumed twice.
 *
 * The events package re-exports it under the old name, so its existing
 * callers are untouched.
 *
 * Responsive posture:
 *   - mobile (<640px): full-screen, sticky header + sticky CTA bar,
 *     safe-area insets respected, swipe-down dismiss.
 *   - tablet/desktop (≥640px): centered 720px × min(80vh, 720px) card
 *     with rounded-2xl + backdrop blur.
 *
 * Animation:
 *   - mobile: slide-up 220ms ease-out.
 *   - desktop: scale 0.96 → 1 + fade 220ms ease-out.
 *   - `prefers-reduced-motion: reduce` drops everything to opacity-only.
 *
 * Dismiss:
 *   - ✕ button (always)
 *   - Esc key
 *   - Outside-click on backdrop (desktop only)
 *   - Drag-down past 80px on mobile (handled inside the shell)
 *   - Unsaved-changes guard via `unsavedCount` — when > 0, any dismiss path
 *     confirms first, using `unsavedMessage` so the wording can name whatever
 *     the consumer actually has staged.
 */
export interface ActionModalShellProps {
    title: string;
    subtitle?: string;
    isOpen: boolean;
    /**
     * Number of unsaved items staged. When > 0, dismiss paths confirm before
     * closing. Pass 0 to skip the guard.
     */
    unsavedCount?: number;
    /**
     * The confirm text for that guard, given the count. Defaults to the
     * events wording so the attendee modals read exactly as they did.
     */
    unsavedMessage?: (count: number) => string;
    onClose: () => void;
    /** Render slot for the CTA bar, positioned sticky with safe-area padding. */
    footer: React.ReactNode;
    children: React.ReactNode;
}

const REDUCED_MOTION = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function defaultUnsavedMessage(count: number): string {
    return `You have ${count} recipient${count === 1 ? "" : "s"} staged. Discard and close?`;
}

export function ActionModalShell({
    title,
    subtitle,
    isOpen,
    unsavedCount = 0,
    unsavedMessage = defaultUnsavedMessage,
    onClose,
    footer,
    children,
}: ActionModalShellProps) {
    const [mounted, setMounted] = React.useState(false);
    const [animating, setAnimating] = React.useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    // Mobile swipe-to-dismiss tracking. Touch start Y is captured at
    // touchstart; the card translates by (currentY - startY) when the
    // user drags; release past SWIPE_DISMISS_PX commits to close.
    const dragStartY = React.useRef<number | null>(null);
    const [dragOffsetY, setDragOffsetY] = React.useState(0);
    const SWIPE_DISMISS_PX = 80;

    React.useEffect(() => {
        if (isOpen) {
            setMounted(true);
            // Two RAFs so the browser commits the "hidden" frame before
            // the animate-in transition starts. Without this the card
            // appears already in its final position.
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
        } else {
            setAnimating(false);
            const t = setTimeout(() => setMounted(false), REDUCED_MOTION ? 0 : 240);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    function requestClose() {
        if (unsavedCount > 0) {
            const ok = window.confirm(unsavedMessage(unsavedCount));
            if (!ok) return;
        }
        onClose();
    }

    React.useEffect(() => {
        if (!isOpen) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault();
                requestClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, unsavedCount]);

    // Lock body scroll while open
    React.useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    function onTouchStart(e: React.TouchEvent) {
        dragStartY.current = e.touches[0]?.clientY ?? null;
    }
    function onTouchMove(e: React.TouchEvent) {
        if (dragStartY.current === null) return;
        const delta = (e.touches[0]?.clientY ?? 0) - dragStartY.current;
        if (delta > 0) setDragOffsetY(delta);
    }
    function onTouchEnd() {
        if (dragOffsetY > SWIPE_DISMISS_PX) {
            requestClose();
        }
        setDragOffsetY(0);
        dragStartY.current = null;
    }

    if (!mounted) return null;
    if (typeof document === "undefined") return null;

    const reduceMotion = REDUCED_MOTION;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div
                onClick={requestClose}
                className={[
                    "absolute inset-0 transition-opacity",
                    reduceMotion ? "" : "duration-300",
                    animating ? "bg-black/40 sm:backdrop-blur-md" : "bg-black/0",
                ].join(" ")}
            />

            {/* Card */}
            <div
                ref={cardRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={dragOffsetY > 0 ? { transform: `translateY(${dragOffsetY}px)` } : undefined}
                className={[
                    "relative w-full h-full sm:h-auto sm:w-[720px] sm:max-h-[min(80vh,720px)]",
                    "bg-white shadow-2xl flex flex-col overflow-hidden",
                    "sm:rounded-2xl",
                    "transition-all",
                    reduceMotion ? "" : "duration-300 ease-out",
                    animating
                        ? "translate-y-0 opacity-100 sm:scale-100"
                        : "translate-y-full opacity-0 sm:translate-y-0 sm:scale-95",
                    // Safe-area aware bottom padding on mobile (handled by footer)
                ].join(" ")}
            >
                {/* Drag handle (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
                    <div className="h-1 w-12 rounded-full bg-zinc-300" aria-hidden />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-5 pb-4 border-b border-zinc-100 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-zinc-900 truncate">{title}</h2>
                        {subtitle && (
                            <p className="text-[12px] text-zinc-500 mt-0.5 line-clamp-2">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={requestClose}
                        aria-label="Close"
                        className="w-9 h-9 shrink-0 rounded-lg hover:bg-zinc-100 flex items-center justify-center cursor-pointer -mr-1"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">{children}</div>

                {/* Footer (sticky CTA) */}
                <div
                    className="border-t border-zinc-100 px-5 sm:px-6 py-3 shrink-0 bg-white"
                    style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
                >
                    {footer}
                </div>
            </div>
        </div>,
        document.body,
    );
}
