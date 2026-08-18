import { useState } from "react";
import { Card, Pill, Who, inputCls } from "./primitives";

/**
 * Topics — the half of a listing negotiation that is not money.
 *
 * Ported from the negotiation MVP (`Conversation` / `Composer` / `Ask` in
 * `~/Desktop/dev/cobuntu-negotiation-mvp/src/components/Deal.tsx`), which is
 * the agreed design for this page rather than a throwaway mockup.
 *
 * ── Why a composer, not a modal ─────────────────────────────────────────────
 *
 * The MVP tried a dialog behind a button first. A modal is for a decision you
 * must finish or abandon; this is writing a sentence to someone, which every
 * feed on earth handles with a box at the top of the list. It also broke the
 * reading: you could not see what you were replying to while you typed.
 *
 * ── Why threads and not field anchors ───────────────────────────────────────
 *
 * An earlier cut hung each note off a FIELD, which made the commission "just
 * another property path" and made people pick a category before they could say
 * a sentence. Deliberately rebuilt so notes are CONVERSATIONS. What is lost:
 * you cannot show "open request" beside a field. What is gained: nobody has to
 * classify their thought before having it.
 *
 * ── The handshake ───────────────────────────────────────────────────────────
 *
 * Closing is MUTUAL, and the server derives it — this component only ever
 * posts "I am done" for the viewer's own side. One party ticking a topic off
 * would record their opinion of whether the other had done enough.
 */

export interface TopicComment {
    id: string;
    body: string;
    authorUserId: string;
    createdAt?: string;
    author?: { id: string; name?: string | null } | null;
}

export interface Topic {
    id: string;
    subject: string;
    status: "OPEN" | "RESOLVED";
    closedBySeller: boolean;
    closedByCommunity: boolean;
    openedByUserId: string;
    /** Derived server-side: the item was edited after this was raised. */
    changedSince?: boolean;
    comments: TopicComment[];
    openedByUser?: { id: string; name?: string | null } | null;
}

export type Viewer = "owner" | "leader";

/** Which side of the agreement the viewer is on, in the server's vocabulary. */
const sideOf = (viewer: Viewer) => (viewer === "owner" ? "seller" : "community");

/** Translate, with the same `{var}` interpolation the rest of the panel uses. */
type T = (key: string, vars?: Record<string, string | number>) => string;

export function Topics({
    topics,
    viewer,
    otherPartyName,
    busy,
    onOpen,
    onComment,
    onToggleDone,
    t,
}: {
    topics: Topic[];
    viewer: Viewer;
    /** Who the viewer is talking TO — the community's name, or the seller's. */
    otherPartyName: string;
    busy?: boolean;
    onOpen: (subject: string, body: string) => void | Promise<void>;
    onComment: (topicId: string, body: string) => void | Promise<void>;
    onToggleDone: (topicId: string, done: boolean) => void | Promise<void>;
    t: T;
}) {
    const open = topics.filter((c) => c.status === "OPEN");
    const done = topics.filter((c) => c.status === "RESOLVED");

    return (
        <div className="space-y-3">
            <Composer viewer={viewer} otherPartyName={otherPartyName} busy={busy} onPost={onOpen} t={t} />

            {topics.length === 0 && (
                <Card className="p-8 text-center">
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{t("topicsEmptyTitle")}</p>
                    <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] leading-relaxed text-[var(--ink-2)]">
                        {viewer === "owner"
                            ? t("topicsEmptyOwner", { community: otherPartyName })
                            : t("topicsEmptyLeader", { seller: otherPartyName })}
                    </p>
                </Card>
            )}

            {open.map((topic) => (
                <Ask
                    key={topic.id}
                    topic={topic}
                    viewer={viewer}
                    otherPartyName={otherPartyName}
                    busy={busy}
                    onComment={onComment}
                    onToggleDone={onToggleDone}
                    t={t}
                />
            ))}

            {done.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer list-none rounded-xl px-1 py-2 text-[12.5px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink-2)]">
                        {t("topicsSettledCount", { count: done.length })}
                    </summary>
                    <div className="mt-2 space-y-2">
                        {done.map((topic) => (
                            <Ask
                                key={topic.id}
                                topic={topic}
                                viewer={viewer}
                                otherPartyName={otherPartyName}
                                busy={busy}
                                onComment={onComment}
                                onToggleDone={onToggleDone}
                                t={t}
                            />
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

/**
 * The box at the top of the feed.
 *
 * Collapsed it is one line, the way a status box is, and it opens in place
 * when you start. A subject is REQUIRED because a thread you can close needs a
 * name — "settled" is meaningless against an untitled pile of messages. The
 * server enforces the same rule; this only avoids a pointless round trip.
 */
function Composer({
    viewer,
    otherPartyName,
    busy,
    onPost,
    t,
}: {
    viewer: Viewer;
    otherPartyName: string;
    busy?: boolean;
    onPost: (subject: string, body: string) => void | Promise<void>;
    t: T;
}) {
    const [expanded, setExpanded] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    const reset = () => {
        setExpanded(false);
        setSubject("");
        setBody("");
    };

    const post = async () => {
        if (!subject.trim() || !body.trim()) return;
        await onPost(subject.trim(), body.trim());
        reset();
    };

    return (
        <Card className="p-3.5">
            <div className="flex gap-3">
                <Who side={sideOf(viewer)} label={viewer === "leader" ? otherPartyName : undefined} />
                {!expanded ? (
                    <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        className="flex-1 cursor-pointer rounded-xl bg-[var(--sunk)] px-4 py-2.5 text-left text-[13.5px] text-[var(--ink-3)] transition-colors hover:bg-[var(--line-soft)]"
                    >
                        {t("topicsComposerPlaceholder", { other: otherPartyName })}
                    </button>
                ) : (
                    <div className="min-w-0 flex-1">
                        <input
                            autoFocus
                            className="w-full bg-transparent text-[15px] font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
                            placeholder={t("topicsSubjectPlaceholder")}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                        <textarea
                            className="mt-1.5 min-h-20 w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
                            placeholder={t("topicsBodyPlaceholder")}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                        {/*
                          * Reversed on mobile so the primary action sits at the
                          * bottom, under the thumb, and Cancel is not what you
                          * hit first. Same rule as the rest of the panel.
                          */}
                        <div className="mt-2 flex flex-col-reverse gap-2 border-t border-[var(--line-soft)] pt-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={reset}
                                className="cursor-pointer rounded-lg bg-zinc-100 px-3.5 py-2 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 sm:w-auto"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                disabled={!subject.trim() || !body.trim() || busy}
                                onClick={() => void post()}
                                className="cursor-pointer rounded-lg bg-[var(--commit)] px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                            >
                                {t("topicsPost")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

/** One topic: the subject, the conversation under it, and the handshake. */
function Ask({
    topic,
    viewer,
    otherPartyName,
    busy,
    onComment,
    onToggleDone,
    t,
}: {
    topic: Topic;
    viewer: Viewer;
    otherPartyName: string;
    busy?: boolean;
    onComment: (topicId: string, body: string) => void | Promise<void>;
    onToggleDone: (topicId: string, done: boolean) => void | Promise<void>;
    t: T;
}) {
    const [body, setBody] = useState("");
    // Open by default while it is still just the opening message — a thread of
    // one has nothing to collapse, and collapsing it hides the whole point.
    const [expanded, setExpanded] = useState(topic.comments.length <= 1);

    const mine = viewer === "owner" ? topic.closedBySeller : topic.closedByCommunity;
    const theirs = viewer === "owner" ? topic.closedByCommunity : topic.closedBySeller;

    const send = async () => {
        if (!body.trim()) return;
        await onComment(topic.id, body.trim());
        setBody("");
    };

    return (
        <Card className="overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((o) => !o)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--sunk)]"
            >
                <span
                    className={`mt-[1px] grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                        topic.status === "RESOLVED"
                            ? "bg-[var(--good-w)] text-[var(--good)]"
                            : "bg-[var(--warn-w)] text-[var(--warn)]"
                    }`}
                >
                    {topic.status === "RESOLVED" ? "✓" : "!"}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[var(--ink)]">{topic.subject}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-[var(--ink-3)]">
                        {topic.comments[0]?.body}
                    </span>
                </span>
                {/*
                  * "changed since" is the one thing here the reader cannot work
                  * out for themselves: the item was edited AFTER this was
                  * raised, so what they are looking at is not what was objected
                  * to. Derived server-side from the item's revision.
                  */}
                {topic.changedSince && topic.status === "OPEN" && <Pill tone="info">{t("topicsChangedSince")}</Pill>}
            </button>

            {expanded && (
                <div className="border-t border-[var(--line-soft)] bg-[var(--sunk)] px-4 py-4">
                    <div className="space-y-3">
                        {topic.comments.map((c) => (
                            <div key={c.id} className="flex gap-2.5">
                                <Who
                                    side={c.authorUserId === topic.openedByUserId ? sideOf(viewer) : sideOf(viewer === "owner" ? "leader" : "owner")}
                                    label={c.author?.name ?? undefined}
                                />
                                <p className="min-w-0 flex-1 pt-1 text-[13px] leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap">
                                    {c.body}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex gap-2">
                        <input
                            className={inputCls}
                            placeholder={t("topicsReplyPlaceholder")}
                            value={body}
                            disabled={busy}
                            onChange={(e) => setBody(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void send();
                            }}
                        />
                    </div>

                    {/*
                      * Closing is MUTUAL. Either side can say a topic is done;
                      * it only closes when both have. One party ticking it off
                      * would record their opinion of whether the other had done
                      * enough — so this posts the viewer's own flag and nothing
                      * else, and the server derives the status.
                      */}
                    {topic.status === "OPEN" && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--line-soft)] pt-3">
                            <Shake mine={mine} theirs={theirs} viewer={viewer} otherPartyName={otherPartyName} />
                            <p className="min-w-0 flex-1 text-[12px] text-[var(--ink-3)]">
                                {mine ? t("topicsWaitingOnThem", { other: otherPartyName }) : t("topicsClosesWhenBoth")}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onToggleDone(topic.id, !mine)}
                                className={`cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    mine
                                        ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                                        : "bg-[var(--good)] text-white hover:opacity-90"
                                }`}
                            >
                                {mine ? t("topicsUndo") : t("topicsDone")}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

/** Two lights: who has agreed. The handshake, in miniature. */
function Shake({
    mine,
    theirs,
    viewer,
    otherPartyName,
}: {
    mine: boolean;
    theirs: boolean;
    viewer: Viewer;
    otherPartyName: string;
}) {
    const other = otherPartyName.slice(0, 3).toUpperCase();
    return (
        <span className="flex shrink-0 items-center gap-1">
            <Lamp on={mine} label="YOU" />
            <Lamp on={theirs} label={other} square={viewer === "owner"} />
        </span>
    );
}

function Lamp({ on, label, square }: { on: boolean; label: string; square?: boolean }) {
    return (
        <span
            title={on ? "agreed" : "not yet"}
            className={`grid h-6 min-w-6 place-items-center px-1.5 text-[9px] font-bold transition-colors duration-300 ${
                square ? "rounded-[7px]" : "rounded-full"
            } ${on ? "bg-[var(--good)] text-white" : "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200"}`}
        >
            {label}
        </span>
    );
}
