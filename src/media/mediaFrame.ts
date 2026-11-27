import { fitWithin, IMAGE_QUALITY } from "../lib/image";

/**
 * The pieces MediaManager uses to turn a picked file into a framed photo:
 * the AI-label check on the ORIGINAL file, loading, and the crop itself.
 * Pure enough to test without a browser canvas, apart from frameToDataUrl.
 */

/*
 * THE AI LABEL. Generative tools increasingly say so inside the file, in the
 * IPTC "digital source type" vocabulary, written either as XMP (Midjourney,
 * Adobe Firefly, Google) or inside a C2PA Content Credentials manifest
 * (OpenAI, Adobe). Both spell the value with the same IPTC term, so a plain
 * byte search finds either, with no parser:
 *
 *   trainedAlgorithmicMedia               made by a generative model
 *   compositeWithTrainedAlgorithmicMedia  a photo with generated parts
 *
 * It must run on the ORIGINAL file: framing redraws the picture on a canvas,
 * which drops all metadata, so the server never sees the label. And it only
 * catches files that still carry it (a screenshot or a re-save loses it):
 * a first filter, not a detector.
 */
const AI_TERMS = ["trainedAlgorithmicMedia", "compositeWithTrainedAlgorithmicMedia"];

/** Does this file's own metadata say an AI tool made it? */
export function hasAiGeneratedLabel(bytes: Uint8Array): boolean {
  // latin1: every byte one character, so any ASCII term appears verbatim.
  let text = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return AI_TERMS.some((term) => text.includes(term));
}

/** The same check for a picked file. */
export async function fileHasAiGeneratedLabel(file: Blob): Promise<boolean> {
  // Blob.arrayBuffer is missing in older Safari and in jsdom; FileReader is everywhere.
  const buf: ArrayBuffer = typeof file.arrayBuffer === "function"
    ? await file.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  return hasAiGeneratedLabel(new Uint8Array(buf));
}

/** A picked file as a data URL, the cropper's source. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The cropper's selection, in the source image's own pixels. */
export interface FrameArea { x: number; y: number; width: number; height: number }

/**
 * The size the framed photo will actually have: the selection, capped on its
 * long edge at MAX_IMAGE_EDGE (fitWithin). What a size floor is checked on:
 * zooming into a big photo can still leave a small one.
 */
export function framedSize(area: FrameArea): { width: number; height: number } {
  return fitWithin({ width: Math.round(area.width), height: Math.round(area.height) });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // A saved photo is re-framed from its hosted URL; the public bucket sends CORS.
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image could not be read"));
    img.src = src;
  });
}

/**
 * The zoom at which the WHOLE photo fits inside the frame.
 *
 * WHY. The cropper's zoom 1 is "the frame filled": the photo covers it and the
 * longer side spills over. A photo of another shape (a portrait poster in a
 * square frame) therefore always lost its top and bottom, and the host had no
 * way to keep them: the zoom stopped at 1. Zooming out to this value shows the
 * whole photo, and the strips beside it are filled (frameToDataUrl). A photo
 * already the frame's shape gives 1: there is nothing to zoom out to.
 */
export function fitZoom(imageWidth: number, imageHeight: number, aspect: number): number {
  if (!(imageWidth > 0 && imageHeight > 0 && aspect > 0)) return 1;
  const ratio = imageWidth / imageHeight;
  return Math.min(1, aspect / ratio, ratio / aspect);
}

/**
 * Does the frame reach past the photo's own edges (zoomed out below "filled")?
 * A pixel of slack either way: rounding at zoom 1 can put a filled frame a
 * fraction outside, and that must keep the ordinary path, not grow a strip.
 */
export function reachesPast(area: FrameArea, imageWidth: number, imageHeight: number): boolean {
  return area.x < -1 || area.y < -1 || area.x + area.width > imageWidth + 1 || area.y + area.height > imageHeight + 1;
}

/**
 * Where the photo lands on a framed canvas `outWidth` wide when the frame
 * reaches past it: the part of the photo inside the frame (s*) and where it is
 * drawn (d*). Null when the frame holds none of the photo.
 */
export function placement(area: FrameArea, imageWidth: number, imageHeight: number, outWidth: number) {
  const scale = outWidth / area.width;
  const sx = Math.max(0, area.x);
  const sy = Math.max(0, area.y);
  const ex = Math.min(imageWidth, area.x + area.width);
  const ey = Math.min(imageHeight, area.y + area.height);
  if (ex <= sx || ey <= sy) return null;
  return {
    sx, sy, sw: ex - sx, sh: ey - sy,
    dx: (sx - area.x) * scale, dy: (sy - area.y) * scale, dw: (ex - sx) * scale, dh: (ey - sy) * scale,
  };
}

/** What fills the strips when the colour cannot be read. */
export const FALLBACK_GROUND = "rgb(0, 0, 0)";

/**
 * Which edges the strips touch: "x" for strips beside the photo (left and
 * right, a tall poster in a square), "y" for strips above and below (a wide
 * photo). Only those edges are sampled: a poster's header or footer on the
 * OTHER edges (a logo, a cream bar) would otherwise tint strips that never
 * meet it, and the seam shows.
 */
export type StripSides = "x" | "y" | "all";

/** The sides a frame's strips fall on: the axis the frame overhangs most. */
export function stripSides(area: FrameArea, imageWidth: number, imageHeight: number): StripSides {
  return area.width - imageWidth >= area.height - imageHeight ? "x" : "y";
}

/**
 * The average colour along the outer edge of an RGBA pixel grid, as
 * "rgb(r, g, b)", over the edges `sides` names. A poster on a plain ground
 * (most are) then carries on into the strips instead of meeting a bar of
 * another colour. Mostly transparent edges give white: a JPEG has no
 * transparency, and white is what a transparent PNG is usually meant to sit on.
 */
export function averageEdge(data: ArrayLike<number>, width: number, height: number, sides: StripSides = "all"): string {
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n += 1;
  };
  if (sides === "x") {
    for (let y = 0; y < height; y++) { add(0, y); if (width > 1) add(width - 1, y); }
  } else if (sides === "y") {
    for (let x = 0; x < width; x++) { add(x, 0); if (height > 1) add(x, height - 1); }
  } else {
    for (let x = 0; x < width; x++) { add(x, 0); if (height > 1) add(x, height - 1); }
    for (let y = 1; y < height - 1; y++) { add(0, y); if (width > 1) add(width - 1, y); }
  }
  if (n === 0) return FALLBACK_GROUND;
  if (a / n < 128) return "rgb(255, 255, 255)";
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

/** The edge colour of a loaded photo; FALLBACK_GROUND when the browser keeps
 *  its pixels closed (a cross-origin photo without CORS) or has no canvas. */
function edgeColourOf(image: HTMLImageElement, sides: StripSides): string {
  try {
    const n = 48;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    if (!ctx) return FALLBACK_GROUND;
    ctx.drawImage(image, 0, 0, n, n);
    return averageEdge(ctx.getImageData(0, 0, n, n).data, n, n, sides);
  } catch {
    return FALLBACK_GROUND;
  }
}

/** The edge colour of a photo by its source, for the framing preview. */
export async function edgeColour(src: string, sides: StripSides = "all"): Promise<string> {
  return edgeColourOf(await loadImage(src), sides);
}

/** Draw the selection at its framed size and encode it as a JPEG data URL. */
export async function frameToDataUrl(src: string, area: FrameArea): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(src);
  if (reachesPast(area, image.naturalWidth, image.naturalHeight)) return frameBeyondPhoto(image, area);
  const x = Math.max(0, Math.round(area.x));
  const y = Math.max(0, Math.round(area.y));
  const w = Math.min(Math.round(area.width), image.naturalWidth - x);
  const h = Math.min(Math.round(area.height), image.naturalHeight - y);
  const out = fitWithin({ width: w, height: h });
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, w, h, 0, 0, out.width, out.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", IMAGE_QUALITY), width: out.width, height: out.height };
}

/** A frame zoomed out past the photo: the frame's whole size, filled with the
 *  photo's edge colour, the photo drawn where it sits inside the frame. */
function frameBeyondPhoto(image: HTMLImageElement, area: FrameArea): { dataUrl: string; width: number; height: number } {
  const out = fitWithin({ width: Math.round(area.width), height: Math.round(area.height) });
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = edgeColourOf(image, stripSides(area, image.naturalWidth, image.naturalHeight));
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const p = placement(area, image.naturalWidth, image.naturalHeight, out.width);
  if (p) ctx.drawImage(image, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  return { dataUrl: canvas.toDataURL("image/jpeg", IMAGE_QUALITY), width: out.width, height: out.height };
}

/** A data URL as a File, for hosts that upload files rather than data URLs. */
export function dataUrlToFile(dataUrl: string, name = "photo.jpg"): File {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
