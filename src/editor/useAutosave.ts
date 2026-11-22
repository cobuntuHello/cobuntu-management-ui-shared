"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Save a field while it is being written, with no Save button.
 *
 * Built for the description on the manage pages' Details tab (events, products
 * and courses), where a lone Save button sat above the editor. The button
 * asked the writer to remember a step the page could take for them, and an
 * edit left without pressing it was lost on navigation.
 *
 * The rules, each of them load-bearing:
 *
 *   - Debounced: a save goes out `delayMs` after the writer stops typing, so
 *     a paragraph costs one request, not one per keystroke.
 *   - `flush()` saves NOW (the editor calls it on blur), skipping the wait.
 *   - An unchanged value is never sent. "Unchanged" means equal to the last
 *     value known to be on the server: the last successful save, or `saved`,
 *     the server's own value, which the hook adopts whenever it changes (a
 *     refetch must not be echoed straight back as a save).
 *   - One request in flight at a time. A change made while one is in flight is
 *     queued, and only the LATEST value goes out once it settles: the
 *     intermediate ones would be overwritten anyway, and two concurrent PUTs
 *     can land out of order and leave the older text on the server.
 *   - A pending change is flushed when the component unmounts (switching tab)
 *     and on `pagehide` / `beforeunload` (closing the tab, reloading). Those
 *     two pass `keepalive: true` to `save`, so a fetch made with it outlives
 *     the page.
 *   - A failed save never touches the value. The text stays exactly as typed,
 *     the state says "error", and `retry()` (or the next edit, or a blur) sends
 *     it again. The hook never reverts anything: it only reports.
 *   - `enabled: false` (read-only viewers) never saves anything.
 *
 * The hook only decides WHEN to call `save` and reports the state; the caller
 * owns the value and the request. `AutosaveStatus` renders the state.
 */

export type AutosaveState = "idle" | "saving" | "saved" | "error";

export interface AutosaveSaveOptions {
  /**
   * True when the page itself is going away (pagehide / beforeunload). A
   * `fetch` should pass `keepalive: true` then, or the browser cancels it with
   * the page.
   */
  keepalive: boolean;
}

export interface UseAutosaveOptions<T> {
  /** What would be saved right now, already normalised (e.g. trimmed). */
  value: T;
  /** The value the server holds, normalised the same way as `value`. */
  saved: T;
  /** Persist `value`. Reject to report a failure. */
  save: (value: T, options: AutosaveSaveOptions) => Promise<unknown>;
  /** False for a read-only viewer: nothing is ever saved. Default true. */
  enabled?: boolean;
  /** Quiet time after the last change before saving. Default 800ms. */
  delayMs?: number;
  /** Default `Object.is`, right for strings. */
  isEqual?: (a: T, b: T) => boolean;
}

export interface UseAutosaveResult {
  state: AutosaveState;
  /** What the last failed save rejected with, until a save succeeds. */
  error: unknown;
  /** Save now if there is anything unsaved (blur). */
  flush: () => void;
  /** Same as flush, named for the status line's Retry. */
  retry: () => void;
}

export const AUTOSAVE_DELAY_MS = 800;

export function useAutosave<T>({
  value,
  saved,
  save,
  enabled = true,
  delayMs = AUTOSAVE_DELAY_MS,
  isEqual = Object.is,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>("idle");
  const [error, setError] = useState<unknown>(null);

  // The latest props, for callbacks that outlive the render that made them
  // (a timer, a settling request, an unload listener).
  const latest = useRef({ value, save, enabled, isEqual });
  latest.current = { value, save, enabled, isEqual };

  const lastSaved = useRef<T>(saved);
  const inFlight = useRef(false);
  const queued = useRef<AutosaveSaveOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /*
   * Everything run() reads is a ref, so one instance for the component's life
   * is correct, and it is what lets a settling request call it again.
   */
  const run: (options: AutosaveSaveOptions) => void = useCallback((options: AutosaveSaveOptions) => {
    clearTimer();
    const current = latest.current;
    if (!current.enabled) return;
    if (inFlight.current) {
      // Keep keepalive if any caller asked for it: the page may be leaving.
      queued.current = { keepalive: !!queued.current?.keepalive || options.keepalive };
      return;
    }
    const next = current.value;
    if (current.isEqual(next, lastSaved.current)) {
      // Nothing unsaved. A failure the writer has since typed their way back
      // out of is no longer worth reporting.
      if (mounted.current) setState((s) => (s === "error" ? "idle" : s));
      return;
    }

    inFlight.current = true;
    if (mounted.current) setState("saving");
    let ok = false;
    /*
     * Called synchronously: from pagehide / beforeunload the request has to
     * START inside the handler. A synchronous throw counts as a failure.
     */
    let request: Promise<unknown>;
    try {
      request = Promise.resolve(current.save(next, options));
    } catch (e) {
      request = Promise.reject(e);
    }
    request
      .then(
        () => {
          ok = true;
          lastSaved.current = next;
          if (mounted.current) setError(null);
        },
        (e: unknown) => {
          if (mounted.current) setError(e);
        },
      )
      .finally(() => {
        inFlight.current = false;
        const again = queued.current;
        queued.current = null;
        const now = latest.current;
        const unsaved = !now.isEqual(now.value, lastSaved.current);
        /*
         * Send again when something asked while this one was out (the latest
         * value only), or when a SUCCESS leaves the text ahead of the server
         * with no timer coming to save it (it changed, then changed back to
         * what the server had BEFORE this save). Never straight after a
         * failure on its own: that would retry a broken request forever.
         */
        if (unsaved && (again || (ok && timer.current === null))) {
          run(again ?? { keepalive: false });
          return;
        }
        if (!mounted.current) return;
        if (unsaved) setState(ok ? "idle" : "error");
        else setState(ok ? "saved" : "idle");
      });
  }, []);

  // The server's value is the baseline. Declared before the value effect, so
  // a commit that changes both compares against the new baseline.
  useEffect(() => {
    lastSaved.current = saved;
  }, [saved]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }
    if (latest.current.isEqual(value, lastSaved.current)) {
      clearTimer();
      if (!inFlight.current) setState((s) => (s === "error" ? "idle" : s));
      return;
    }
    // Unsaved again: "Saved" would now be a lie. An error stays up until the
    // next attempt replaces it.
    setState((s) => (s === "saved" ? "idle" : s));
    clearTimer();
    timer.current = setTimeout(() => run({ keepalive: false }), delayMs);
  }, [value, enabled, delayMs, run]);

  useEffect(() => {
    mounted.current = true;
    const onLeave = () => run({ keepalive: true });
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      mounted.current = false;
      // Leaving the tab (or the page, in-app): the document stays, so an
      // ordinary request finishes on its own.
      run({ keepalive: false });
    };
  }, [run]);

  const flush = useCallback(() => run({ keepalive: false }), [run]);

  return { state, error, flush, retry: flush };
}
