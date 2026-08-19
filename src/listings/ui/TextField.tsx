import { useId, useRef, useLayoutEffect, type ChangeEvent } from "react";

/**
 * The panel's text inputs, with a counter that behaves.
 *
 * ── Why a counter at all ────────────────────────────────────────────────────
 *
 * The server caps a topic's subject at 120 characters and its body at 4000. A
 * limit the writer cannot see is a limit they discover by losing work: they
 * finish a paragraph, press Post, and get a 400 telling them to shorten
 * something they can no longer see the end of.
 *
 * ── Why it stays hidden until it matters ────────────────────────────────────
 *
 * A counter visible from the first keystroke turns writing a sentence into
 * budgeting one -- people write to the number instead of to the point. It
 * appears at 80% and only then, which is the moment it starts being useful and
 * the last moment it can still be acted on cheaply.
 *
 * ── Why it does not hard-stop typing ────────────────────────────────────────
 *
 * `maxLength` on the element silently swallows keystrokes and, worse, silently
 * truncates a PASTE -- someone pastes three paragraphs, sees two, and has no
 * idea the third was eaten. Over the limit the field says so and the Post
 * button refuses; the text stays theirs to edit down.
 */

export function TextField({
    value, onChange, placeholder, limit, autoFocus, label,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    limit: number;
    autoFocus?: boolean;
    label: string;
}) {
    const id = useId();
    const over = value.length > limit;
    return (
        <div>
            <label htmlFor={id} className="sr-only">{label}</label>
            <input
                id={id}
                autoFocus={autoFocus}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-invalid={over || undefined}
                className="w-full bg-transparent text-[15px] font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-3)]"
            />
            <Counter length={value.length} limit={limit} />
        </div>
    );
}

export function TextArea({
    value, onChange, placeholder, limit, rows = 2, label,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    limit: number;
    rows?: number;
    label: string;
}) {
    const id = useId();
    const ref = useRef<HTMLTextAreaElement | null>(null);

    /*
     * GROWS WITH THE TEXT rather than scrolling inside a fixed box.
     *
     * A message this size is read while it is being written, and a two-line
     * window with a scrollbar hides the paragraph above the one you are
     * editing. Height is reset to auto first, or it can only ever grow -- the
     * box would keep the height of the longest thing ever typed into it.
     */
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const over = value.length > limit;
    return (
        <div>
            <label htmlFor={id} className="sr-only">{label}</label>
            <textarea
                id={id}
                ref={ref}
                rows={rows}
                value={value}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-invalid={over || undefined}
                className="w-full resize-none overflow-hidden bg-transparent text-[13.5px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
            />
            <Counter length={value.length} limit={limit} />
        </div>
    );
}

/**
 * Appears at 80%, counts DOWN, and turns once it is spent.
 *
 * Down rather than up because the useful number is how much room is left, not
 * how much has been used -- "18 left" is actionable and "102 / 120" is
 * arithmetic. Past the limit it shows how far over, which is the same number
 * the writer needs to remove.
 */
function Counter({ length, limit }: { length: number; limit: number }) {
    const remaining = limit - length;
    const show = length >= limit * 0.8;
    if (!show) return null;
    const over = remaining < 0;
    return (
        <p
            aria-live="polite"
            className={`mt-1 text-right text-[11px] tabular-nums transition-colors duration-200 ${
                over ? "font-semibold text-[var(--danger,#b91c1c)]" : "text-[var(--ink-3)]"
            }`}
            style={{ animation: "cbt-counter-in 160ms ease-out" }}
        >
            {over ? `${-remaining} too many` : `${remaining} left`}
        </p>
    );
}
