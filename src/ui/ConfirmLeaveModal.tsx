"use client";

import * as React from "react";
import { ModalShell } from "./ModalShell";

export interface ConfirmLeaveModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Generic "you're about to be taken somewhere else" dialog.
 *
 * Sibling of `DiscardPrompt`, not a replacement for it: that one confirms
 * losing unsaved edits, this one confirms a navigation away from the current
 * flow entirely (e.g. off to Stripe Connect onboarding). Both packages
 * (`@cobuntu/product-management-ui`, `@cobuntu/event-management-ui`) today
 * redirect via `window.location.href` the instant a buyer taps a "Paid"
 * pricing preset with no Stripe account connected -- a jarring pattern
 * interrupt with zero warning. This gives callers a confirm step first;
 * every string is overridable since the two destinations (and what comes
 * after "continue") differ.
 */
export function ConfirmLeaveModal({
  open,
  onCancel,
  onConfirm,
  title = "Leave this page?",
  message = "You'll be taken to another site. You can come back and finish afterward.",
  confirmLabel = "Continue",
  cancelLabel = "Not now",
}: ConfirmLeaveModalProps) {
  if (!open) return null;
  return (
    <ModalShell
      open
      onClose={onCancel}
      width="sm"
      dismissOnBackdrop
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-[13px] font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-zinc-600">{message}</p>
    </ModalShell>
  );
}
