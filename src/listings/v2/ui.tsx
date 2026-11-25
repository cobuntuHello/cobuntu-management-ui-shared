"use client";

/**
 * The listing page v2's small parts: icons, party marks, the sheet and the
 * confirmation every lever goes through.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CobuntuMark } from "../ui/marks";
import { initials } from "./format";

export const ICON = {
    request: "M4 4h16v16H4zM4 9h16M9 4v5",
    money: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v.01M18 14v.01",
    talk: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
    live: "M5 21V4M5 4h11l-2 4 2 4H5",
    history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
    ticket: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2",
    card: "M3 6h18v12H3zM3 10h18M7 15h3",
    check: "M5 12l4 4 10-10",
    room: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
    sound: "M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
    camera: "M3 8h4l2-3h6l2 3h4v11H3zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z",
    chair: "M7 3v18M17 3v18M7 12h10M7 7h10",
    addon: "M12 5v14M5 12h14",
    external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
};

export function Icon({ d, size = 16, stroke = 1.8 }: { d: string; size?: number; stroke?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

/** The icon an add-on is drawn with, read from its name or slot. */
export function addonIcon(name: string, slot?: string | null): string {
    const s = `${slot ?? ""} ${name}`.toLowerCase();
    if (/sound|audio|dj|mic/.test(s)) return ICON.sound;
    if (/photo|video|camera|film/.test(s)) return ICON.camera;
    if (/light/.test(s)) return ICON.light;
    if (/chair|table|furniture/.test(s)) return ICON.chair;
    if (/room|space|house/.test(s)) return ICON.room;
    return ICON.addon;
}

/**
 * Stripe's glyph on its indigo, square as Stripe sets it. Inline-styled, not
 * the package's Tailwind StripeMark: a venue site without Tailwind would draw
 * that one as a bare glyph on nothing.
 */
export function StripeGlyph({ size }: { size: number }) {
    return (
        <span role="img" aria-label="Stripe" style={{ width: size, height: size, borderRadius: 5, background: "#635BFF", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
        </span>
    );
}

export type PartyKey = "stripe" | "cobuntu" | "community" | "seller" | "ticket";

/**
 * Every party with its real mark (decided 22 Nov 2026): Stripe's and
 * Cobuntu's marks, the community's own icon, the seller's avatar; ringed in
 * the colour of its slice of the ring.
 */
export function Face({ who, ring, communityIcon, communityName, sellerImage, sellerName, size = 32 }: {
    who: PartyKey; ring?: string; communityIcon?: string | null; communityName?: string; sellerImage?: string | null; sellerName?: string | null; size?: number;
}) {
    const style = { width: size, height: size, ["--cbtl-face-ring" as any]: ring ?? "var(--cbtl-line)" };
    if (who === "ticket") return <span className="cbtl-face" data-ticket="" style={style}><Icon d={ICON.ticket} size={15} stroke={1.9} /></span>;
    if (who === "stripe") return <span className="cbtl-face" style={style}><StripeGlyph size={size - 12} /></span>;
    if (who === "cobuntu") return <span className="cbtl-face" style={style}><CobuntuMark size={size - 8} /></span>;
    if (who === "community") {
        return (
            <span className="cbtl-face" style={style}>
                {communityIcon ? <img src={communityIcon} alt={communityName ?? ""} /> : <i>{initials(communityName)}</i>}
            </span>
        );
    }
    return (
        <span className="cbtl-face" style={style}>
            {sellerImage ? <img src={sellerImage} alt={sellerName ?? ""} /> : <i>{initials(sellerName)}</i>}
        </span>
    );
}

/** Where the avatar library is served (the app's lib/avatar-urls.ts, the same URLs). */
const AVATAR_ORIGIN = "https://api.cobuntu.com";
const NEUTRAL_AVATAR = `${AVATAR_ORIGIN}/api/avatars/cobuntu-campfire.svg`;

/**
 * A person's picture, tried in the app's order (components/shared/UserAvatar):
 * their own photo or chosen library avatar, then the library avatar they were
 * given (by id, else by @usertag), then the neutral one. A person never shows
 * as a bare letter (seen live, 24 Nov 2026: "B" for Buntu).
 */
export function personAvatarCandidates(image: string | null | undefined, person: { id?: string | null; usertag?: string | null } | null | undefined): string[] {
    const given = person?.id
        ? `${AVATAR_ORIGIN}/api/avatars/auto/${encodeURIComponent(person.id)}.svg`
        : person?.usertag ? `${AVATAR_ORIGIN}/api/avatars/tag/${encodeURIComponent(person.usertag)}.svg` : null;
    return [image, given, NEUTRAL_AVATAR].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
}

/** An image that walks its candidates when one fails to load; initials only when every one has. */
export function FallbackImg({ candidates, name }: { candidates: string[]; name?: string | null }) {
    const [at, setAt] = useState(0);
    const key = candidates.join("|");
    useEffect(() => { setAt(0); }, [key]);
    const src = candidates[at];
    if (!src) return <>{initials(name)}</>;
    return <img src={src} alt="" onError={() => setAt((n) => n + 1)} />;
}

/**
 * A round picture. Pass `person` for a person: a missing photo then falls back
 * to their library avatar, never to initials. Without it (a community's icon),
 * a missing image shows initials.
 */
export function Avatar({ image, name, size = 28, person }: { image?: string | null; name?: string | null; size?: number; person?: { id?: string | null; usertag?: string | null } | null }) {
    return (
        <span className="cbtl-avatar" style={{ width: size, height: size }} aria-hidden="true">
            {person !== undefined
                ? <FallbackImg candidates={personAvatarCandidates(image, person)} name={name} />
                : image ? <img src={image} alt="" /> : initials(name)}
        </span>
    );
}

/**
 * A sheet on the page: a dialog on a wide screen, a bottom sheet on a phone.
 * Escape and the backdrop close it, unless it is busy.
 */
export function Sheet({ title, onClose, busy, children, label }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode; label?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
    }, [busy, onClose]);
    return (
        <div className="cbtl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="cbtl-sheet" role="dialog" aria-modal="true" aria-label={label ?? title} tabIndex={-1} ref={ref}>
                <h3>{title}</h3>
                {children}
            </div>
        </div>
    );
}

export interface ConfirmSpec {
    title: string;
    body: string;
    confirm: string;
    danger?: boolean;
    /** A free-text note sent with the act (a decline reason). */
    note?: { label: string };
    run: (note?: string) => Promise<void>;
}

/**
 * EVERY LEVER CONFIRMS FIRST, and says what happens rather than asking "are
 * you sure" (the old panel's rule, kept: a confirmation that only repeats the
 * button teaches people to click through it).
 */
export function Confirm({ spec, onClose, cancel, failed }: { spec: ConfirmSpec; onClose: () => void; cancel: string; failed: string }) {
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    return (
        <Sheet title={spec.title} onClose={onClose} busy={busy}>
            <p>{spec.body}</p>
            {spec.note && (
                <label className="cbtl-field">
                    <span className="cbtl-label">{spec.note.label}</span>
                    <textarea className="cbtl-textarea" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </label>
            )}
            {error && <span className="cbtl-error" role="alert">{error}</span>}
            <div className="cbtl-sheet-foot">
                <button type="button" className="cbtl-btn" onClick={onClose} disabled={busy}>{cancel}</button>
                <button
                    type="button"
                    className="cbtl-btn"
                    data-kind={spec.danger ? "no" : "go"}
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        setError("");
                        try { await spec.run(note.trim() || undefined); onClose(); } catch (e: any) { setError(e?.message || failed); setBusy(false); }
                    }}
                >
                    {spec.confirm}
                </button>
            </div>
        </Sheet>
    );
}
