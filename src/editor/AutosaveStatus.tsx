"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useSharedT } from "../i18n";
import type { AutosaveState } from "./useAutosave";

export interface AutosaveStatusProps {
  state: AutosaveState;
  /** Send the failed save again. */
  onRetry: () => void;
  /** How long "Saved" stays before it fades out. Default 2000ms. */
  savedVisibleMs?: number;
}

/**
 * The small line that says an autosaving field is being saved, has been, or
 * could not be. It sits in the editor's bottom row, next to the character
 * counter, rather than in a toast: it describes this one field, and a toast
 * every few seconds while someone writes would be noise.
 *
 * "Saved" fades after a couple of seconds, since once the writer has seen it,
 * it has done its job. A failure stays until the next attempt, with Retry
 * beside it: the text itself is never touched, so retrying is always safe.
 *
 * A polite live region, so a screen reader hears "Saving..." / "Saved" /
 * "Couldn't save." without the focus moving out of the text.
 */
export function AutosaveStatus({ state, onRetry, savedVisibleMs = 2000 }: AutosaveStatusProps) {
  const t = useSharedT("shared.managementUi.autosave");
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    setFaded(false);
    if (state !== "saved") return;
    const id = setTimeout(() => setFaded(true), savedVisibleMs);
    return () => clearTimeout(id);
  }, [state, savedVisibleMs]);

  return (
    <span
      role="status"
      aria-live="polite"
      data-state={state}
      data-faded={state === "saved" && faded ? "true" : undefined}
      className={`inline-flex min-w-0 items-center gap-1 text-[11px] leading-none transition-opacity duration-500 ${
        state === "saved" && faded ? "opacity-0" : "opacity-100"
      } ${state === "error" ? "text-red-500" : "text-zinc-400"}`}
    >
      {state === "saving" && (
        <>
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden="true" />
          {t("saving")}
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          {t("saved")}
        </>
      )}
      {state === "error" && (
        <>
          {t("failed")}
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
          >
            {t("retry")}
          </button>
        </>
      )}
    </span>
  );
}
