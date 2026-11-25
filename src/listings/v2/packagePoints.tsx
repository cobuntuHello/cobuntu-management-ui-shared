"use client";

/**
 * A package's description as a checklist (T-415): the Change package cards and
 * the seller's terms card on Earnings. Its own module so sections.tsx and
 * packageSwitch.tsx can both use it without importing each other.
 */

/** One line of what a package means: something the community does, or the seller's own part. */
export interface PackagePoint { text: string; yours: boolean }

/**
 * A package's description as a checklist.
 *
 * Communities write a sentence or two ("We put it in front of the community:
 * newsletter, feed and marketplace placement. You still handle delivery and
 * buyer questions."), sometimes a list. A list item, or else a sentence, is one
 * point; a point that starts with "You" is the seller's own part and reads as
 * such (a dash, not a tick). A community that wants exact points writes a list.
 */
export function packagePoints(description: string | null | undefined): PackagePoint[] {
    const text = (description ?? "").trim();
    if (!text) return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const LIST = /^([-*•]|\d+[.)])\s+/;
    const listed = lines.filter((l) => LIST.test(l)).map((l) => l.replace(LIST, ""));
    const items = listed.length > 0
        ? listed
        : (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) ?? [text]).map((s) => s.trim());
    return items
        .map((t) => t.replace(/[*_`#]/g, "").replace(/[.!]+$/, "").trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((t) => ({ text: t, yours: /^(you|your|voc[eê]|tu|o seu|a sua)\b/i.test(t) }));
}

export function PackagePoints({ points }: { points: PackagePoint[] }) {
    if (points.length === 0) return null;
    return (
        <span className="cbtl-chg-points">
            {points.map((p, i) => (
                <span key={i} data-yours={p.yours ? "" : undefined}>
                    {p.yours
                        ? <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 12h12" /></svg>
                        : <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    {p.text}
                </span>
            ))}
        </span>
    );
}
