import type { ReactNode } from "react";

/**
 * The pieces the negotiation MVP invented, and only those.
 *
 * ── What is deliberately NOT here ───────────────────────────────────────────
 *
 * Buttons, inputs, labels, switches and selects. The MVP's own note explains
 * why, and it is worth keeping: those files were the ADMIN APP'S OWN,
 * copied in verbatim, because "a prototype that invents its own primitives
 * teaches you how the prototype feels, not how the product will".
 *
 * So porting them back would be a round trip -- the apps already have them.
 * What lives here is only what neither app had a component for: the card, the
 * eyebrow, the pill, the party avatar, the segmented switch and the column
 * header.
 */

export function Card({
    children,
    className = "",
    tone = "default",
}: {
    children: ReactNode;
    className?: string;
    tone?: "default" | "good" | "warm";
}) {
    const tones = {
        default: "bg-[var(--card)] border-[var(--line)]",
        good: "bg-[var(--good-w)] border-[color-mix(in_srgb,var(--good)_25%,transparent)]",
        warm: "bg-[var(--warn-w)] border-[color-mix(in_srgb,var(--warn)_22%,transparent)]",
    };
    return (
        <div
            className={`rounded-2xl border ${tones[tone]} ${className}`}
            style={{ boxShadow: "0 1px 2px rgba(25,23,20,.03), 0 8px 24px -18px rgba(25,23,20,.16)" }}
        >
            {children}
        </div>
    );
}

export function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">
            {children}
        </p>
    );
}

export function Pill({
    children,
    tone = "zinc",
}: {
    children: ReactNode;
    tone?: "zinc" | "good" | "warm" | "info";
}) {
    const tones: Record<string, string> = {
        zinc: "bg-[var(--sunk)] text-[var(--ink-2)]",
        good: "bg-[var(--good-w)] text-[var(--good)]",
        warm: "bg-[var(--warn-w)] text-[var(--warn)]",
        info: "bg-[#eaf0f7] text-[#39618f]",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${tones[tone]}`}>
            {children}
        </span>
    );
}

/**
 * Square for the community, round for a person.
 *
 * The app's own rule, and it carries the meaning the whole screen rests on:
 * two parties, neither of whom may write to the other's side. Shape does that
 * work at 28px where colour alone would not.
 */
export function Who({ side, label }: { side: "seller" | "community"; label?: string }) {
    return side === "community" ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[var(--ink)] text-[9.5px] font-bold tracking-tight text-white">
            {(label ?? "CO").slice(0, 3).toUpperCase()}
        </span>
    ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--sunk)] text-[11px] font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">
            {(label ?? "S").slice(0, 1).toUpperCase()}
        </span>
    );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-3)]">{label}</span>
            {children}
        </label>
    );
}

/**
 * Matches the admin's Input exactly — same height, radius, border and focus.
 * A class string rather than a component because several call sites need a
 * textarea, which that Input does not cover.
 */
export const inputCls =
    "flex w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 disabled:opacity-50";

/** A segmented switch — used for personas and tabs, so the two agree. */
export function Segmented<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
}) {
    return (
        <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--card)] p-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 ease-[cubic-bezier(.22,.61,.36,1)] sm:px-3.5 sm:text-[13px] ${
                        value === o.value
                            ? "bg-[var(--commit)] text-white"
                            : "text-[var(--ink-2)] hover:bg-[var(--sunk)]"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

/**
 * A column heading.
 *
 * FIXED HEIGHT, and both columns must use it. The MVP records why: the first
 * version had a bare label on one side and a label-plus-control on the other,
 * so the two header rows were different heights and the cards beneath them
 * started at different y positions — visible immediately, and exactly the kind
 * of thing that makes a layout feel broken without anyone being able to say
 * why.
 */
export function ColumnHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return (
        <div className="mb-3 flex h-9 items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[var(--ink-3)]">{children}</p>
            {right}
        </div>
    );
}
