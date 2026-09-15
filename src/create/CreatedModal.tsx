"use client";

import { useRouter } from "next/navigation";
import {
  type CreateOutcome,
  primaryDestination,
} from "./createOutcome";

/**
 * The last step: what just happened, and where to go next.
 *
 * This was a modal over the submitted form — which put the confirmation on top
 * of a page that had already done its job, and left the wizard's own progress
 * showing an unfinished flow behind it. It is a step now: the flow completes
 * rather than being covered up.
 *
 * ── It should feel like finishing something ─────────────────────────
 *
 * The step used to be a small bordered card with an icon in the corner: an
 * acknowledgement, not an arrival. Making something and putting it in front of
 * a community is the whole point of the flow, and the last screen was the one
 * screen that did not say so.
 *
 * So it opens on a large centred mark and the listing's own name, on a soft
 * brand wash that is the only place in the wizard using it. The wash is a tint
 * of the community's colour rather than a success green, because what is being
 * celebrated is joining THAT community's shelf.
 *
 * It stays a step, not a party: no confetti, no illustration. The reward is
 * that the thing is done and the next move is obvious.
 *
 * ── Four actions, ranked, and never four buttons ────────────────────
 *
 * In order of how much someone actually wants them after submitting:
 *
 *   1. Follow the review   — only when a leader has to approve it
 *   2. View                — the page itself
 *   3. Manage              — settings, publishing, the rest
 *   4. Create another      — sellers list in batches
 *
 * Which of them EXIST depends on the outcome. A published listing has no
 * review to follow, and a draft has no public page worth opening. Rendering a
 * disabled or dead action to keep the count at four would advertise a place
 * that does not exist yet — the same mistake as a settings card for a
 * capability the listing cannot have.
 *
 * Only the first is filled. Four solid buttons is a menu, not a
 * recommendation, and the ranking above is the whole point.
 *
 * Deliberately NOT dismissible to nowhere: every path leads somewhere, because
 * a step that can be closed onto a form which has already been submitted
 * invites a second submit.
 */

export interface CreatedModalProps {
  open: boolean;
  outcome: CreateOutcome;
  kind: "product" | "event";
  /** The created listing's name, so it is obvious the right thing saved. */
  name: string;
  viewHref: string;
  manageHref: string;
  /** Back to a fresh create flow. */
  createAnotherHref: string;
  /**
   * The review thread for THIS listing, when one exists.
   *
   * Only meaningful for a pending outcome — nothing else has a review. Left
   * optional so a caller that cannot resolve the thread omits the action
   * rather than rendering a button that goes nowhere.
   */
  reviewHref?: string;
}

export function CreatedModal({
  open,
  outcome,
  kind,
  name,
  viewHref,
  manageHref,
  createAnotherHref,
  reviewHref,
}: CreatedModalProps) {
  const router = useRouter();
  if (!open) return null;

  const isEvent = kind === "event";
  const noun = isEvent ? "event" : "product";
  const primary = primaryDestination(outcome);
  const isPending = outcome === "pending";

  /*
   * What the person just DID, in their own terms.
   *
   * The outcome titles below describe the resulting STATE ("With the
   * leaders"), which answers "what happened to it" but not "what did I just
   * do". Someone who has clicked Save & Request Listing wants confirmation
   * that the thing they pressed is the thing that happened.
   */
  const DID: Record<CreateOutcome, string> = {
    published: `Created and listed your ${noun}`,
    saved: `Created your ${noun} as a draft`,
    pending: `Created your ${noun} and requested a listing`,
    unlisted: `Created your ${noun}`,
  };

  const COPY: Record<CreateOutcome, { title: string; body: string }> = {
    published: {
      title: `Your ${noun} is live`,
      body: isEvent
        ? "People can find it and register now."
        : "People can find it and buy it now.",
    },
    saved: {
      title: "Saved as a draft",
      body: `Nobody can see this ${noun} yet. Publish it from the manage page when you are ready.`,
    },
    pending: {
      title: "It's with the leaders",
      body: `A leader reviews this ${noun} before it goes live. You can follow the review, and settle the terms, from the thread.`,
    },
    /*
     * Deliberately not "saved" and not "hidden".
     *
     * Both of those suggest a switch they could flip. This is the absence of a
     * relationship with a community: the ${noun} is finished and theirs, and no
     * community carries it. Naming the next move matters more here than in the
     * other three, because nothing is in motion — nobody is reviewing it and no
     * shelf is waiting.
     */
    unlisted: {
      title: `Your ${noun} is ready`,
      body: `Only you can see it. Ask a community to carry it from the manage page whenever you want, or leave it as it is.`,
    },
  };
  const copy = COPY[outcome];

  /*
   * One button, two weights. Filled marks the recommended next move; muted is
   * everything else. Reaching for a third treatment for a third action is how
   * a ranked list turns back into a menu.
   */
  function action(label: string, href: string, filled: boolean, key: string) {
    return (
      <button
        key={key}
        type="button"
        onClick={() => router.push(href)}
        className="w-full px-5 py-3 text-[14px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
        style={
          filled
            ? {
                borderRadius: "var(--button-radius, 12px)",
                background: "var(--primary-btn-bg, var(--brand-color, #1a1a1a))",
                color: "var(--brand-contrast, #ffffff)",
              }
            : {
                borderRadius: "var(--button-radius, 12px)",
                background: "color-mix(in srgb, currentColor 7%, transparent)",
              }
        }
      >
        {label}
      </button>
    );
  }

  /*
   * Built in rank order, skipping what does not apply, so the first surviving
   * action is the filled one whatever the outcome. No branch has to remember
   * to move the emphasis.
   */
  const actions: { label: string; href: string; key: string }[] = [];

  if (isPending && reviewHref) {
    actions.push({ label: "Follow the review", href: reviewHref, key: "review" });
  }
  // A draft has no public page worth opening — the view link would show the
  // author a page nobody else can reach, which reads as broken rather than
  // private.
  if (outcome !== "saved") {
    actions.push({ label: `View ${noun}`, href: viewHref, key: "view" });
  }
  actions.push({ label: `Manage ${noun}`, href: manageHref, key: "manage" });

  /*
   * When nothing outranks it, the outcome's own primary keeps the emphasis —
   * a draft wants Manage (to publish), a live listing wants View.
   */
  if (actions.length > 0 && !(isPending && reviewHref)) {
    const wanted = primary === "view" ? "view" : "manage";
    const i = actions.findIndex((a) => a.key === wanted);
    if (i > 0) actions.unshift(...actions.splice(i, 1));
  }

  return (
    <div className="w-full" role="status" aria-label={copy.title}>
      <div
        className="mx-auto w-full max-w-[520px] overflow-hidden"
        style={{
          background: "var(--bg-color, #fff)",
          color: "var(--text-color, #18181b)",
          border: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
          borderRadius: "var(--card-radius, 18px)",
        }}
      >
        {/* The arrival. Centred, and the only brand wash in the wizard. */}
        <div
          className="flex flex-col items-center px-6 pb-7 pt-9 text-center"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--brand-color, #18181b) 9%, transparent), transparent)",
          }}
        >
          <span
            className="grid size-14 place-items-center rounded-full"
            style={{
              background: "var(--brand-color, #18181b)",
              color: "var(--brand-contrast, #fff)",
            }}
          >
            {isPending ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-50">
            {DID[outcome]}
          </p>
          <h2 className="mt-1.5 text-[21px] font-semibold leading-tight">{copy.title}</h2>
          {/* The name, so it is obvious the right thing saved. */}
          <p className="mt-1 max-w-full truncate text-[14px] opacity-65">{name}</p>
        </div>

        <div className="px-6 pb-6">
          <p className="text-center text-[13.5px] leading-relaxed opacity-65">{copy.body}</p>

          {/* Ranked, not enumerated: the filled one is the recommendation. */}
          <div className="mt-6 flex flex-col gap-2">
            {actions.map((a, i) => action(a.label, a.href, i === 0, a.key))}
          </div>

          <button
            type="button"
            onClick={() => router.push(createAnotherHref)}
            className="mt-4 w-full py-2 text-[13px] font-medium cursor-pointer opacity-55 transition-opacity hover:opacity-100"
          >
            Create another {noun}
          </button>
        </div>
      </div>
    </div>
  );
}
