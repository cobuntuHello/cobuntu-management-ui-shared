"use client";

import * as React from "react";
import { useSharedT } from "../i18n";
import { ModalShell } from "./ModalShell";

export interface DiscardPromptProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Standard "you have unsaved changes" dialog. Sits on top of the modal
 * triggering it; the outer ModalShell's `dismissOnBackdrop` should be
 * false while this is open to avoid double-dismiss races.
 */
export function DiscardPrompt({
  open,
  onCancel,
  onConfirm,
  title: titleProp,
  message: messageProp,
  confirmLabel: confirmLabelProp,
  cancelLabel: cancelLabelProp,
}: DiscardPromptProps) {
  const t = useSharedT("shared.managementUi.discardPrompt");
  const title = titleProp ?? t("title");
  const message = messageProp ?? t("message");
  const confirmLabel = confirmLabelProp ?? t("confirmLabel");
  const cancelLabel = cancelLabelProp ?? t("cancelLabel");
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
          {/* Secondary action = muted-bg button, not a bare text link,
              matching this wizard's other modal footers. */}
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
            className="px-4 py-2 text-[13px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer"
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
