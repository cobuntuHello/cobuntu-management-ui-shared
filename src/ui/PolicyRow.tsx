"use client";

import type { ReactNode } from "react";
import { ChevronRight, Lock } from "lucide-react";

/**
 * A settings row that shows its answer instead of explaining it.
 *
 * ── The problem it solves ───────────────────────────────────────────────────
 *
 * The event wizard's "Policies & access" step was four rows, each a title plus
 * a full explanatory sentence:
 *
 *   (people)  Who can see the guest list
 *             Everyone · Anyone who can see the event sees who is going
 *
 * Two things went wrong. The subtitle did two jobs at once -- it stated the
 * current value AND defined the concept -- so the only thing carrying state
 * was a clause you had to read, and four settings cost about forty-five words
 * to take in. And two of the rows were near-identical strings ("Who can see
 * the X / Everyone · Anyone who can see the event sees the ..."), which at a
 * glance read as repetition rather than two separate decisions.
 *
 * On a phone it was worse: the explanation is the part that truncates, so the
 * row still cost two lines and explained nothing.
 *
 *   (people)  Who can see the guest list              ●●●
 *   + lock    Everyone
 *
 * ── Three signals, none of which lie ────────────────────────────────────────
 *
 * The GLYPH says what the setting is for -- people for a guest list, a pin for
 * a location. It is the consumer's own icon and is never swapped out.
 *
 * A LOCK BADGE appears on that glyph the moment the thing stops being public,
 * and fills in solid when nobody can see it.
 *
 * The METER says how much of the audience is included.
 *
 * The sentence that explains the concept moves into the picker sheet, which is
 * where the choice is actually made and where the alternatives can be compared
 * -- the progressive disclosure the rest of these forms already use.
 *
 * ── What was tried and rejected ─────────────────────────────────────────────
 *
 * The first cut replaced the topic glyph with one describing the AUDIENCE: a
 * globe for Everyone, a ticket for attendees-only, a padlock for nobody.
 * Rendered, it was wrong in three ways at once. A ticket on "who can see the
 * location" means "a ticket", two hops from the question, on a row about a
 * place. A people glyph on "just the number" says the opposite of what that
 * setting does -- the whole point is that you do NOT see the people. And a
 * globe reads as "the internet" rather than "everyone can see this".
 *
 * The underlying mistake: these rows ask who can SEE a thing, and an icon
 * describing who the audience IS is a different question. The topic glyph
 * stays; state goes in the badge and the meter.
 *
 * An eye / crossed-eye family was also tried. It answers the right question
 * but collapses to binary -- every visible state is the same open eye -- and
 * it costs the ability to tell a guest-list row from a location row at a
 * glance.
 *
 * ── Why it lives here ───────────────────────────────────────────────────────
 *
 * Events, products and courses all have rows of this shape in three separate
 * packages. Built three times it would be three designs within a month; the
 * filter bar is the cautionary tale. The packages pass their own icon,
 * options and level; this owns what the row LOOKS like.
 *
 * The row markup is otherwise unchanged from the event form's existing button
 * -- same radius, fill, hover lift and chevron -- because the ask was to make
 * the row easier to understand, not to restyle it.
 */

/**
 * How much of the audience a choice includes, from nobody to everybody.
 *
 * A SCALE rather than a set of named values, because the three packages do not
 * share an enum: an event's guest list has four settings, its location two,
 * and a product's are different again. What they share is "how open is this",
 * which is the thing being pictured. Each package maps its own options onto
 * this once, next to the options themselves.
 */
export type AudienceLevel = 0 | 1 | 2 | 3;

/**
 * Three dots: filled for the part of the audience included.
 *
 * Dots rather than a bar because the quantity is tiny and exact -- a bar at
 * this size reads as a progress indicator, which implies something is
 * incomplete. Hollow RINGS rather than dim dots for the excluded ones: the
 * first version drew both states as solid greys at 5px and, rendered, read as
 * an ellipsis "..." beside the chevron. Three dots in a row is already a
 * glyph, and its meaning is "more to come". A ring is unmistakably an empty
 * slot, so the pair reads as "two of three" at a glance.
 *
 * aria-hidden, with the row's real value stated in text beside it. This is a
 * picture of the label, not a second source of truth, and a screen reader
 * reading out three dots would be noise.
 */
export function AudienceMeter({ level, className = "" }: { level: AudienceLevel; className?: string }) {
    return (
        <span className={`flex shrink-0 items-center gap-[4px] ${className}`} aria-hidden="true">
            {[1, 2, 3].map((i) => {
                const on = level >= i;
                return (
                    <span
                        key={i}
                        className="h-[7px] w-[7px] rounded-full"
                        style={{
                            /* The filled dots take the brand colour; the rings
                               a neutral grey over whatever the surface is, so
                               the pair holds on a light or dark community
                               without a second token. */
                            background: on ? "var(--brand-color, #52525b)" : "transparent",
                            border: on ? "none" : "1.5px solid rgba(128,128,128,0.35)",
                        }}
                    />
                );
            })}
        </span>
    );
}

export interface PolicyRowProps {
    /**
     * The glyph for what this setting GOVERNS -- people for a guest list, a pin
     * for a location. Passed in, never derived: only the consumer knows what
     * its own row is about, and deriving it from the value is exactly the
     * mistake described in the header.
     */
    icon: ReactNode;
    /** The question this row answers, e.g. "Who can see the guest list". */
    title: string;
    /** The ANSWER, e.g. "Everyone". Short: the explanation lives in the sheet. */
    value: string;
    /** How open that answer is. Drives the lock badge and the meter. */
    level: AudienceLevel;
    onClick: () => void;
    /** Drops the meter and the badge on a row where "how open" means nothing. */
    hideAudience?: boolean;
    disabled?: boolean;
}

export function PolicyRow({
    icon, title, value, level, onClick, hideAudience = false, disabled = false,
}: PolicyRowProps) {
    const restricted = !hideAudience && level < 3;
    const sealed = !hideAudience && level === 0;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left ring-1 ring-zinc-100/0 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-16px_rgba(60,40,30,0.5)] hover:ring-zinc-200 active:translate-y-0 disabled:cursor-default disabled:opacity-50"
        >
            <span className="relative shrink-0">
                {icon}
                {restricted && (
                    /* Ringed in the row's own fill so the badge reads as sitting
                       ON the glyph rather than colliding with it. */
                    <span className="absolute -bottom-[3px] -right-[3px] grid h-[14px] w-[14px] place-items-center rounded-full bg-zinc-50 ring-2 ring-zinc-50">
                        <Lock
                            className={`h-[10px] w-[10px] ${sealed ? "text-zinc-600" : "text-zinc-500"}`}
                            /* Solid for "nobody": the strongest state should be
                               the heaviest mark, so the one row that shuts
                               everyone out is the one that looks shut. */
                            {...(sealed ? { fill: "currentColor", strokeWidth: 1.5 } : { strokeWidth: 2.4 })}
                        />
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-800">{title}</span>
                {/* The value alone. What it MEANS is in the sheet, next to the
                    alternatives it has to be weighed against. */}
                <span className="block truncate text-[12.5px] text-zinc-500">{value}</span>
            </span>
            {!hideAudience && <AudienceMeter level={level} />}
            <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-zinc-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-400" />
        </button>
    );
}
