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
 * ── It has to LOOK like a step, and it did not ──────────────────────
 *
 * Becoming a step changed where it rendered, not how it was drawn: a centred,
 * bordered card on a brand gradient, with a 56px circle and stacked
 * full-width buttons. Every other step is left-aligned content at 560px with
 * no chrome at all, so the last screen of the flow read as a dialog that had
 * been dropped into the page — the modal it used to be, still wearing modal
 * clothes.
 *
 * It is drawn like the other steps now: same width, same alignment, no card,
 * no wash, buttons in a row rather than a stack.
 *
 * The TITLE moved out entirely. The page heading names the step someone is on,
 * every step, and here it was still showing the previous step's title while
 * this card announced its own — two headings, disagreeing, one of them wrong.
 * The heading does the titling; the pane says what happened to WHICH item and
 * offers the next move.
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
 * ── Why "Follow the review" ─────────────────────────────────────────
 *
 * It is one thread that does two jobs: it shows where the request stands, and
 * it is where the leader and the member settle terms. Names that only describe
 * the first ("Track your request", "See status") make the negotiation look
 * like it lives somewhere else, and someone waiting on a reply would not think
 * to open it. "Follow" says both watch it and take part.
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
        className="px-6 py-2.5 max-md:w-full max-md:py-3.5 text-[14.5px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
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
    /*
     * `role="status"` is load-bearing, not decoration: this content replaces a
     * form the person just submitted, and a screen reader is otherwise given no
     * reason to announce that anything happened.
     */
    <div className="max-w-[560px]" role="status" aria-label={copy.title}>
      <div className="flex items-start gap-3.5">
        {/*
          * A mark, at the size of the icons everywhere else in this flow. It
          * was a 56px circle centred on the page, which is a dialog's gesture;
          * the community's colour still carries the meaning at this size.
          */}
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--brand-color, #18181b) 12%, transparent)",
            color: "var(--brand-color, #18181b)",
          }}
          aria-hidden="true"
        >
          {isPending ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>

        <div className="min-w-0">
          {/*
            * What happened, and to WHAT. The outcome line stays here rather
            * than becoming the page heading, because it varies with the result
            * (awaiting review, live, saved) while the step is always "Done" —
            * and the name is the part that proves the right thing saved.
            */}
          <p className="text-[15px] font-semibold leading-snug">{copy.title}</p>
          <p className="mt-0.5 truncate text-[13.5px] opacity-65">{name}</p>
        </div>
      </div>

      <p className="mt-4 text-[13.5px] leading-relaxed opacity-65">{copy.body}</p>

      {/* Ranked, not enumerated: the filled one is the recommendation. In a
          ROW, like the wizard footer, rather than a stack of full-width bars —
          three equally wide buttons read as a menu, which is the opposite of
          a ranking. */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {actions.map((a, i) => action(a.label, a.href, i === 0, a.key))}
      </div>

      <button
        type="button"
        onClick={() => router.push(createAnotherHref)}
        className="mt-5 text-[13px] font-medium cursor-pointer opacity-55 transition-opacity hover:opacity-100"
      >
        Create another {noun}
      </button>
    </div>
  );
}
