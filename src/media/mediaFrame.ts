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

/** Draw the selection at its framed size and encode it as a JPEG data URL. */
export async function frameToDataUrl(src: string, area: FrameArea): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(src);
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

/** A data URL as a File, for hosts that upload files rather than data URLs. */
export function dataUrlToFile(dataUrl: string, name = "photo.jpg"): File {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
