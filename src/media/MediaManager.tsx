"use client";

import * as React from "react";
import Cropper from "react-easy-crop";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, Image as ImageIcon, Loader2, RefreshCw, Star, Upload, X } from "lucide-react";
import { ModalShell } from "../ui/ModalShell";
import { useSharedT } from "../i18n";
import {
  dataUrlToFile, fileHasAiGeneratedLabel, frameToDataUrl, framedSize, readAsDataUrl, type FrameArea,
} from "./mediaFrame";

/**
 * THE PHOTOS OF AN EVENT, A PRODUCT OR A COURSE: one manager for all three.
 *
 *   empty      one wide area: drop photos on it, or click to open the modal
 *   modal      drag and drop or choose, several at once; the community's
 *              rules (a notice, a tick) when it has any; each file checked
 *   framing    after the upload choice, one photo at a time at the host's
 *              shape (events square, products and courses 4:3), with the
 *              framed size shown and a size floor enforced
 *   grid       the cover first and large, the rest after; drag to reorder
 *              (keyboard too), and per photo: re-frame, replace, make cover,
 *              remove
 *
 * THE HOST DECIDES WHAT A FRAMED PHOTO BECOMES (`commit`). Events upload it
 * at once and keep the hosted URL; products keep the file and upload on
 * save. `commit` gets the photo being replaced or re-framed too, so a host
 * can treat a saved photo's new framing as a new upload. Videos (products)
 * skip framing and go through `addVideo`.
 *
 * Re-framing starts from the photo's original when this browser still has it
 * (`source`), else from what is saved, so a saved photo can be re-framed but
 * not widened past its saved frame.
 */

export interface ManagedMedia {
  id: string;
  /** What the tile shows: a hosted URL, an object URL or a data URL. */
  preview: string;
  type: "image" | "video";
  /** The uncropped original, while this browser has it, for re-framing. */
  source?: string;
  /** Shown with a spinner and left out of what the host saves. */
  uploading?: boolean;
}

export interface FramedPhoto {
  dataUrl: string;
  file: File;
  width: number;
  height: number;
  /** The original it was framed from. */
  source: string;
  /** The community's tick, when it asks for one. */
  confirmed: boolean;
}

export interface MediaRules {
  /** Short side of the framed photo, in px. */
  minEdge?: number | null;
  requireConfirmation?: boolean;
  confirmationText?: string;
  notice?: string | null;
  /** Refuse files an AI tool labelled (checked on the original file). */
  blockAiLabelled?: boolean;
}

export interface MediaManagerProps<T extends ManagedMedia> {
  items: T[];
  onChange: (items: T[]) => void;
  /** Width / height of every photo: 1 for events, 4 / 3 for products and courses. */
  aspect: number;
  maxItems: number;
  /** A framed photo becomes an item. May upload; a throw shows its message. */
  commit: (photo: FramedPhoto, replacing?: T) => T | Promise<T>;
  /** Given: videos are accepted too, unframed. */
  addVideo?: (file: File) => T;
  rules?: MediaRules | null;
  /** A sizing hint under the drop area, e.g. "Best at 1600 × 1200". */
  hint?: string;
  disabled?: boolean;
}

type Mode = { kind: "add" } | { kind: "replace"; id: string } | { kind: "reframe"; id: string };
type Queued = { key: string; name: string; src: string };

let seq = 0;
const nextKey = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function MediaManager<T extends ManagedMedia>(props: MediaManagerProps<T>) {
  const { items, onChange, aspect, maxItems, commit, addVideo, rules, hint, disabled } = props;
  const t = useSharedT("shared.managementUi.mediaManager");
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [dropped, setDropped] = React.useState<File[] | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  // The latest list, for async commits to write into without a stale closure.
  const latest = React.useRef(items);
  latest.current = items;

  const needsTick = !!rules?.requireConfirmation;
  const room = maxItems - items.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over: target } = e;
    if (!target || active.id === target.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === target.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to));
  }

  function move(id: string, to: number) {
    const from = items.findIndex((i) => i.id === id);
    if (from < 0 || to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  }

  function remove(id: string) {
    setError(null);
    onChange(items.filter((i) => i.id !== id));
  }

  /** Commit one framed photo: a placeholder at once, the host's item when it lands. */
  async function place(photo: FramedPhoto, target: Mode) {
    const replacing = target.kind === "add" ? undefined : latest.current.find((i) => i.id === target.id);
    const tempId = nextKey();
    const placeholder = { id: tempId, preview: photo.dataUrl, type: "image", source: photo.source, uploading: true } as T;
    onChange(replacing
      ? latest.current.map((i) => (i.id === replacing.id ? placeholder : i))
      : [...latest.current, placeholder]);
    try {
      const item = await commit(photo, replacing);
      onChange(latest.current.map((i) => (i.id === tempId ? ({ ...item, source: item.source ?? photo.source } as T) : i)));
    } catch (err) {
      // Put back what was there, or drop the new one.
      onChange(replacing
        ? latest.current.map((i) => (i.id === tempId ? replacing : i))
        : latest.current.filter((i) => i.id !== tempId));
      setError(err instanceof Error && err.message ? err.message : t("uploadFailed"));
    }
  }

  function openAdd(files?: File[]) {
    if (disabled || room <= 0) return;
    setError(null);
    setDropped(files ?? null);
    setMode({ kind: "add" });
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!disabled && room > 0) setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) openAdd(files);
    },
  };

  const target = mode && mode.kind !== "add" ? items.find((i) => i.id === mode.id) : undefined;

  return (
    <div className="space-y-3" data-media-manager="">
      {items.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => openAdd()}
          {...dropProps}
          className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors disabled:cursor-not-allowed ${over ? "border-[var(--brand-color,#18181b)] bg-zinc-100" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"}`}
          style={{ minHeight: 220 }}
        >
          <span className="w-14 h-14 rounded-2xl bg-white ring-1 ring-zinc-100 flex items-center justify-center">
            <ImageIcon className="h-7 w-7 text-zinc-300" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold text-zinc-800">{t("addTitle")}</span>
          <span className="text-[13px] text-zinc-500">{t("addHint", { max: maxItems })}</span>
          {hint && <span className="text-[12px] text-zinc-400">{hint}</span>}
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" {...dropProps}>
              {items.map((item, index) => (
                <Tile
                  key={item.id}
                  item={item}
                  index={index}
                  count={items.length}
                  aspect={aspect}
                  disabled={disabled}
                  onReframe={() => { setError(null); setMode({ kind: "reframe", id: item.id }); }}
                  onReplace={() => { setError(null); setDropped(null); setMode({ kind: "replace", id: item.id }); }}
                  onRemove={() => remove(item.id)}
                  onMove={(to) => move(item.id, to)}
                />
              ))}
              {room > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openAdd()}
                  className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-zinc-500 cursor-pointer transition-colors disabled:cursor-not-allowed ${over ? "border-[var(--brand-color,#18181b)] bg-zinc-100" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"}`}
                  style={{ aspectRatio: String(aspect) }}
                >
                  <Upload className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[13px] font-semibold">{t("addMore")}</span>
                  <span className="text-[11px] text-zinc-400">{t("count", { count: items.length, max: maxItems })}</span>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {items.length > 1 && <p className="text-[12px] text-zinc-400">{t("reorderHint")}</p>}
      {error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}

      {mode && (
        <UploadModal
          key={mode.kind === "add" ? "add" : `${mode.kind}-${mode.id}`}
          mode={mode}
          room={mode.kind === "add" ? room : 1}
          aspect={aspect}
          maxItems={maxItems}
          rules={rules ?? null}
          needsTick={needsTick}
          confirmed={confirmed}
          onConfirmed={setConfirmed}
          initialFiles={dropped}
          reframeSource={mode.kind === "reframe" ? (target?.source ?? target?.preview) : undefined}
          allowVideo={!!addVideo && mode.kind === "add"}
          onVideo={(file) => { if (addVideo) onChange([...latest.current, addVideo(file)]); }}
          onFramed={(photo) => { void place(photo, mode); }}
          onClose={() => { setMode(null); setDropped(null); }}
        />
      )}
    </div>
  );
}

/* ── one photo in the grid ─────────────────────────────────────────────── */

function Tile<T extends ManagedMedia>({
  item, index, count, aspect, disabled, onReframe, onReplace, onRemove, onMove,
}: {
  item: T; index: number; count: number; aspect: number; disabled?: boolean;
  onReframe: () => void; onReplace: () => void; onRemove: () => void; onMove: (to: number) => void;
}) {
  const t = useSharedT("shared.managementUi.mediaManager");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: disabled || item.uploading });
  const cover = index === 0;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    aspectRatio: String(aspect),
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };
  const btn = "h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors";
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200 ${cover && count > 1 ? "col-span-2 row-span-2" : ""}`}
    >
      <div {...attributes} {...listeners} className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none" aria-label={`${t("actions")} ${index + 1}`}>
        {item.type === "video" ? (
          <video src={item.preview} className="w-full h-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.preview} alt="" draggable={false} className={`w-full h-full object-cover ${item.uploading ? "opacity-60" : ""}`} />
        )}
      </div>
      {cover && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-800">{t("coverBadge")}</span>
      )}
      {item.uploading ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-label={t("uploading")}>
          <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
        </span>
      ) : !disabled && (
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-end gap-1.5">
          {item.type === "image" && (
            <button type="button" className={btn} onClick={onReframe} aria-label={t("recrop")} title={t("recrop")}>
              <Crop className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button type="button" className={btn} onClick={onReplace} aria-label={t("replace")} title={t("replace")}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          {!cover && (
            <button type="button" className={btn} onClick={() => onMove(0)} aria-label={t("makeCover")} title={t("makeCover")}>
              <Star className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button type="button" className={btn} onClick={onRemove} aria-label={t("remove")} title={t("remove")}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── the modal: choose, then frame each ────────────────────────────────── */

function UploadModal({
  mode, room, aspect, maxItems, rules, needsTick, confirmed, onConfirmed, initialFiles, reframeSource,
  allowVideo, onVideo, onFramed, onClose,
}: {
  mode: Mode; room: number; aspect: number; maxItems: number; rules: MediaRules | null;
  needsTick: boolean; confirmed: boolean; onConfirmed: (v: boolean) => void;
  initialFiles: File[] | null; reframeSource?: string; allowVideo: boolean;
  onVideo: (file: File) => void; onFramed: (photo: FramedPhoto) => void; onClose: () => void;
}) {
  const t = useSharedT("shared.managementUi.mediaManager");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [queue, setQueue] = React.useState<Queued[]>(
    reframeSource ? [{ key: "reframe", name: "", src: reframeSource }] : [],
  );
  const [stage, setStage] = React.useState<"pick" | "frame">(reframeSource ? "frame" : "pick");
  const [at, setAt] = React.useState(0);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [over, setOver] = React.useState(false);
  const single = mode.kind !== "add";

  const accept = React.useCallback(async (files: File[]) => {
    const notes: string[] = [];
    const picked: Queued[] = [];
    let videos = 0;
    let free = room - queue.length;
    for (const file of files) {
      if (free <= 0) { notes.push(t("tooMany", { max: maxItems })); break; }
      if (allowVideo && file.type.startsWith("video/")) { onVideo(file); videos++; free--; continue; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { notes.push(t("notImage", { name: file.name })); continue; }
      if (rules?.blockAiLabelled && (await fileHasAiGeneratedLabel(file))) { notes.push(t("aiLabelled", { name: file.name })); continue; }
      picked.push({ key: nextKey(), name: file.name, src: await readAsDataUrl(file) });
      free--;
    }
    setProblems(notes);
    setQueue((q) => [...q, ...picked]);
    // Videos only: nothing to frame.
    if (videos && !picked.length && !queue.length && !notes.length) onClose();
  }, [room, queue.length, allowVideo, onVideo, rules, maxItems, t, onClose]);

  // Files dropped straight on the form arrive with the modal.
  React.useEffect(() => { if (initialFiles?.length) void accept(initialFiles); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tickOk = !needsTick || confirmed;
  const title = mode.kind === "replace" ? t("replaceTitle") : stage === "frame" ? t("frameTitle") : t("modalTitle");

  return (
    <ModalShell open onClose={onClose} width="md" hideCloseButton title={title}
      subtitle={stage === "pick" && !single ? t("modalSubtitle", { max: maxItems }) : undefined}>
      {stage === "pick" ? (
        <div className="space-y-4">
          {rules?.notice && <p className="rounded-xl bg-zinc-100 px-4 py-3 text-[13px] leading-snug text-zinc-600">{rules.notice}</p>}
          {needsTick && (
            <label className="flex items-start gap-3 text-[14px] text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-color,#18181b)]" />
              <span>{rules?.confirmationText}</span>
            </label>
          )}
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void accept(Array.from(e.dataTransfer?.files ?? [])); }}
            className={`rounded-2xl border-2 border-dashed px-6 py-8 flex flex-col items-center justify-center gap-2.5 text-center transition-colors ${over ? "border-[var(--brand-color,#18181b)] bg-zinc-100" : "border-zinc-300 bg-zinc-50"}`}
            style={{ minHeight: 220 }}
          >
            <Upload className="h-8 w-8 text-zinc-400" aria-hidden="true" />
            <span className="text-[16px] font-semibold text-zinc-800">{single ? t("dropOne") : t("dropHere")}</span>
            <span className="text-[13px] text-zinc-500">{t("or")}</span>
            <button type="button" onClick={() => inputRef.current?.click()}
              className="rounded-[var(--button-radius,10px)] border border-zinc-300 bg-white px-4 py-2 text-[14px] font-semibold text-zinc-800 cursor-pointer hover:bg-zinc-50">
              {t("choose")}
            </button>
            <span className="text-[12px] text-zinc-400">{allowVideo ? t("formatsVideo") : t("formats")}</span>
            <input ref={inputRef} type="file" className="hidden" multiple={!single}
              accept={allowVideo ? "image/*,video/*" : "image/*"}
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void accept(f); }} />
          </div>
          {queue.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {queue.map((q) => (
                <div key={q.key} className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.src} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label={t("remove")} onClick={() => setQueue((x) => x.filter((y) => y.key !== q.key))}
                    className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {queue.length > 0 && <p className="text-[13px] text-zinc-500">{t("picked", { count: queue.length })}</p>}
          {problems.map((p) => <p key={p} role="alert" className="text-[13px] text-red-600">{p}</p>)}
          {!tickOk && queue.length > 0 && <p className="text-[13px] text-zinc-500">{t("tickFirst")}</p>}
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" disabled={!queue.length || !tickOk} onClick={() => { setAt(0); setStage("frame"); }}
              className="w-full rounded-[var(--button-radius,10px)] px-4 py-3 text-[15px] font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-color, #18181b)" }}>
              {t("continue")}
            </button>
            <button type="button" onClick={onClose}
              className="w-full rounded-[var(--button-radius,10px)] bg-zinc-100 px-4 py-3 text-[15px] font-medium text-zinc-700 cursor-pointer hover:bg-zinc-200">
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <Framer
          key={queue[at]?.key}
          item={queue[at]}
          position={at}
          total={queue.length}
          queue={queue}
          aspect={aspect}
          minEdge={rules?.minEdge ?? null}
          needsTick={needsTick && !confirmed}
          tickText={rules?.confirmationText}
          onConfirmed={onConfirmed}
          onUse={(framed) => {
            onFramed({ ...framed, confirmed: !needsTick || confirmed });
            if (at + 1 < queue.length) setAt(at + 1); else onClose();
          }}
          onSkip={() => { if (at + 1 < queue.length) setAt(at + 1); else onClose(); }}
          onCancel={onClose}
        />
      )}
    </ModalShell>
  );
}

function Framer({
  item, position, total, queue, aspect, minEdge, needsTick, tickText, onConfirmed, onUse, onSkip, onCancel,
}: {
  item: Queued | undefined; position: number; total: number; queue: Queued[]; aspect: number; minEdge: number | null;
  needsTick: boolean; tickText?: string; onConfirmed: (v: boolean) => void;
  onUse: (framed: Omit<FramedPhoto, "confirmed">) => void; onSkip: () => void; onCancel: () => void;
}) {
  const t = useSharedT("shared.managementUi.mediaManager");
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [area, setArea] = React.useState<FrameArea | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  if (!item) return null;
  const size = area ? framedSize(area) : null;
  const small = !!(minEdge && size && Math.min(size.width, size.height) < minEdge);
  const last = position + 1 >= total;

  async function use() {
    if (!area || !item) return;
    setBusy(true);
    setFailed(null);
    try {
      // Let the spinner paint before the synchronous canvas encode.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const out = await frameToDataUrl(item.src, area);
      onUse({ ...out, file: dataUrlToFile(out.dataUrl), source: item.src });
    } catch {
      setFailed(t("uploadFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {total > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {queue.map((q, i) => (
              <div key={q.key} className={`h-11 w-11 overflow-hidden rounded-md ${i === position ? "ring-2 ring-[var(--brand-color,#18181b)] ring-offset-2" : i < position ? "" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <span className="text-[13px] text-zinc-500">{t("frameOf", { n: position + 1, total })}</span>
        </div>
      )}
      <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900" style={{ height: 340 }}>
        <Cropper image={item.src} crop={crop} zoom={zoom} aspect={aspect} showGrid={false}
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />
      </div>
      <div className="flex items-center gap-3 text-[13px] text-zinc-500">
        <label htmlFor={`zoom-${item.key}`}>{t("zoom")}</label>
        <input id={`zoom-${item.key}`} type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--brand-color,#18181b)]" />
        {size && <span className="tabular-nums">{t("size", { width: size.width, height: size.height })}</span>}
      </div>
      {small && size && minEdge && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
          {t("tooSmall", { width: size.width, height: size.height, min: minEdge })}
        </p>
      )}
      {needsTick && (
        <label className="flex items-start gap-3 text-[14px] text-zinc-700 cursor-pointer">
          <input type="checkbox" checked={false} onChange={(e) => onConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-color,#18181b)]" />
          <span>{tickText}</span>
        </label>
      )}
      {failed && <p role="alert" className="text-[13px] text-red-600">{failed}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={total > 1 ? onSkip : onCancel} disabled={busy}
          className="flex-1 rounded-[var(--button-radius,10px)] bg-zinc-100 px-4 py-3 text-[15px] font-medium text-zinc-700 cursor-pointer hover:bg-zinc-200">
          {total > 1 ? t("skip") : t("cancel")}
        </button>
        <button type="button" onClick={() => { void use(); }} disabled={busy || !area || small || needsTick}
          className="flex-1 rounded-[var(--button-radius,10px)] px-4 py-3 text-[15px] font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--brand-color, #18181b)" }}>
          {busy ? t("saving") : last ? t("useDone") : t("useNext")}
        </button>
      </div>
    </div>
  );
}
