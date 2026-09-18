"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CreateStepId } from "./createWizard";

/**
 * The pane transition keyframes, injected as plain global CSS (see StepPane).
 * A bare <style>, not styled-jsx: this lives in a package both apps transpile,
 * and idempotent global CSS needs no styled-jsx plugin on either side.
 */
const PANE_ANIMATION_CSS = `
@keyframes cbtPaneFwd {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes cbtPaneBack {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}
.cbt-pane-fwd  { animation: cbtPaneFwd 240ms cubic-bezier(.22,.61,.36,1) both; }
.cbt-pane-back { animation: cbtPaneBack 240ms cubic-bezier(.22,.61,.36,1) both; }
@media (prefers-reduced-motion: reduce) {
  .cbt-pane-fwd, .cbt-pane-back { animation: cbtPaneFade 140ms ease both; }
  @keyframes cbtPaneFade { from { opacity: 0; } to { opacity: 1; } }
}
`;

/**
 * Progress through a stepped create flow, and the motion between steps.
 *
 * ── Progress, not a table of contents ───────────────────────────────
 *
 * The first version listed every step as a labelled node. That is a menu: it
 * spends the full width of the page telling you about screens you have not
 * reached, and the one fact you actually want — how far along am I — has to be
 * inferred from which dot is filled.
 *
 * This shows where you ARE: the step you are on, out of how many, with a bar
 * that fills as you go. What is coming is named in one short phrase rather
 * than laid out as furniture.
 *
 * ── One step, no bar ────────────────────────────────────────────────
 *
 * A member has a single step: no ownership choice (the backend refuses
 * community ownership for a non-leader whatever the client sends) and no
 * community access to configure on a listing that is not the community's. A
 * progress bar for one step claims there is progress to make when there is not.
 */

const LABELS: Record<"product" | "event", Record<CreateStepId, string>> = {
  // "Arrangement", not "Listing".
  //
  // "Listing" was apt when this step asked whether a community should carry the
  // item at all. That question is the footer buttons now, and the step decides
  // ONE thing: the commission the seller goes up under. Its own heading has
  // said "Your arrangement" since then, so the rail was the last place still
  // using the old word -- and the resume step, which names the step a draft was
  // left on, inherited it and showed "Left on Listing" for a screen titled
  // "Your arrangement".
  //
  // The word a step is called has to be the same in the rail, in its heading,
  // and anywhere else that names it. Three surfaces, one name.
  // "Continue", not "Drafts": the rail names what you DO at each step, and the
  // step exists to offer picking work back up rather than to file it.
  product: { resume: "Continue", ownership: "Who is selling", type: "What you are selling", details: "Details", commerce: "Deliverable Variants & Pricing", listing: "Arrangement", access: "Access", done: "Done" },
  event: { resume: "Continue", ownership: "Who is hosting", type: "What you are selling", details: "Details", commerce: "Pricing", listing: "Arrangement", access: "Access", done: "Done" },
};

/**
 * What a step is CALLED, for anything outside the rail that needs to name one.
 *
 * The rail's own words, deliberately: the resume step tells someone a draft was
 * "left on Details", and that has to be the label they saw in the progress bar
 * when they left it. A second set of names for the same steps is how the two
 * halves of a flow start describing different things.
 *
 * Returns null for steps that are not a place in the flow — "resume" is where
 * you are told about drafts, and "done" is after the work, so neither is
 * somewhere a draft can have been left.
 */
export function stepLabel(kind: "product" | "event", step: CreateStepId): string | null {
  if (step === "resume" || step === "done") return null;
  return LABELS[kind][step] ?? null;
}

export function CreateStepRail({
  steps,
  current,
  kind,
}: {
  steps: CreateStepId[];
  current: CreateStepId;
  kind: "product" | "event";
  /** Accepted for call-site compatibility; the bar is not a navigation control. */
  onStepClick?: (step: CreateStepId) => void;
}) {
  if (steps.length < 2) return null;

  const index = steps.indexOf(current);
  const labels = LABELS[kind];
  const next = steps[index + 1];
  /*
   * Fill measures the steps BEHIND you, not the one you are standing on.
   *
   * It used to be `(index + 1) / length`, which made the bar jump the moment
   * someone picked "You" on step one: choosing personal deletes the access
   * step, so the denominator went 3 -> 2 and the fill went 33% -> 50% without
   * anyone advancing. The scale moved under the marker.
   *
   * Measuring completed transitions makes step one 0% in BOTH flows, so
   * changing the answer cannot move the bar. The "of N" count still changes,
   * and should: the flow genuinely got shorter, and that is the one honest
   * thing to say about it.
   */
  const pct = steps.length > 1 ? Math.round((index / (steps.length - 1)) * 100) : 0;

  /** The stub shown when `pct` is 0, so the bar never renders empty. */
  const MIN_FILL = "14px";

  return (
    <div className="mb-7">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13.5px] font-semibold" style={{ color: "var(--text-color)" }}>
          <span className="opacity-50 font-medium">
            Step {index + 1} of {steps.length}
          </span>
          <span className="mx-2 opacity-25">·</span>
          {labels[current]}
        </p>
        {next && (
          <p className="text-[12.5px] opacity-45 whitespace-nowrap">Next: {labels[next]}</p>
        )}
      </div>

      <div
        className="mt-2 h-[5px] w-full overflow-hidden rounded-full"
        /*
         * The unfilled track.
         *
         * Reported as invisible THREE times now, and the first two fixes both
         * reached for the percentage (12% -> 22%) when the percentage was only
         * half the story. Two things were actually wrong:
         *
         *  1. It mixed against ambient `currentColor`, while the sibling <p>
         *     right above it explicitly paints `var(--text-color)`. Nothing in
         *     the chain between them sets `color`, so the track was tinting
         *     against whatever the shell happened to inherit rather than
         *     against the text colour the page deliberately pins. Same markup,
         *     two different answers, depending on the host app.
         *  2. On step one the fill is 0% by design (see `pct`), so the track is
         *     the ENTIRE bar. A faint track is survivable when it frames a
         *     visible fill; it is the whole widget when there is nothing in it.
         *
         * So: tint against the same `--text-color` the label uses, and fall
         * back to currentColor only where that var is unset. Still
         * theme-relative, now deterministic.
         */
        style={{ background: "color-mix(in srgb, var(--text-color, currentColor) 26%, transparent)" }}
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={`Step ${index + 1} of ${steps.length}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            /*
             * Never render an EMPTY bar.
             *
             * `pct` is 0 on step one, on purpose — it measures transitions
             * completed, so that answering a question which SHORTENS the flow
             * cannot slide the marker (see the note on `pct`). That maths is
             * right and stays. What it produced was a progress bar with nothing
             * in it, which does not read as "0% done", it reads as broken or
             * missing — which is exactly how it kept getting reported.
             *
             * A fixed stub in PIXELS, not percent, because a percentage floor
             * would scale with the step count and reintroduce the very jump
             * `pct` exists to prevent: 14px is 14px whether the flow has two
             * steps or six.
             *
             * A plain conditional rather than CSS `max()`: the smallest real
             * increment any flow produces is ~20% of a 760px rail, which is
             * never anywhere near 14px, so `max()` bought nothing — and jsdom
             * drops width values it cannot parse, which silently made this
             * untestable.
             */
            width: pct > 0 ? `${pct}%` : MIN_FILL,
            background: "var(--brand-color, #18181b)",
            // Matches the step transition, so the bar advances WITH the content
            // instead of snapping ahead of it.
            transition: "width 240ms cubic-bezier(.22,.61,.36,1)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * One pane of the wizard.
 *
 * ── Why this is not `{active && <Form/>}` ───────────────────────────
 *
 * Both create forms hold their own draft state — the tier wizard, the media
 * gallery, the cropped banner — and `formDataRef` only mirrors what onChange
 * last emitted. It cannot restore a File. Unmounting a step on Next therefore
 * destroys the draft, so every pane stays MOUNTED and is hidden with CSS.
 *
 * Which is exactly why the first cut did not appear to animate: a keyed
 * wrapper only animates on mount, and the pane that matters most — the form —
 * never mounts again. So the animation is re-triggered by hand: when a pane
 * becomes active, the class is removed and re-applied across a frame, which
 * restarts the CSS animation on an element that never left the tree.
 *
 * Direction comes from the step INDEX rather than the button pressed, because
 * jumping back two steps at once still has to read as "backwards".
 */
export function StepPane({
  active,
  direction,
  children,
}: {
  active: boolean;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  const [animating, setAnimating] = useState(false);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      // Off, then on across a frame — assigning the same animation to an
      // element that already has it is a no-op, so it has to be removed first.
      setAnimating(false);
      const id = requestAnimationFrame(() => setAnimating(true));
      return () => cancelAnimationFrame(id);
    }
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    wasActive.current = active;
  }, [active]);

  return (
    <div
      className={
        active
          ? animating
            ? direction === "forward"
              ? "cbt-pane-fwd"
              : "cbt-pane-back"
            : undefined
          : "hidden"
      }
    >
      {children}
      {/* Plain <style>, not styled-jsx — see PANE_ANIMATION_CSS. */}
      <style dangerouslySetInnerHTML={{ __html: PANE_ANIMATION_CSS }} />
    </div>
  );
}

/** Kept as an alias so existing call sites keep working. */
export const StepTransition = ({
  children,
  direction,
}: {
  stepKey?: string;
  direction: "forward" | "back";
  children: ReactNode;
}) => (
  <StepPane active direction={direction}>
    {children}
  </StepPane>
);

/** The footer buttons, styled to the community's theme. */
export function WizardButton({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-7 py-2.5 max-md:w-full max-md:py-3.5 text-[14.5px] font-semibold disabled:opacity-30 cursor-pointer transition-opacity hover:opacity-90"
      style={
        primary
          ? {
              borderRadius: "var(--button-radius, 12px)",
              background: "var(--primary-btn-bg, var(--brand-color, #1a1a1a))",
              color: "var(--brand-contrast, #ffffff)",
            }
          : {
              borderRadius: "var(--button-radius, 12px)",
              background: "color-mix(in srgb, currentColor 8%, transparent)",
            }
      }
    >
      {children}
    </button>
  );
}
