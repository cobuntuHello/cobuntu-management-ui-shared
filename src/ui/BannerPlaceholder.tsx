"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The designed banner fallback for a listing (product or event) with no image.
 *
 * A deterministic gradient chosen from the seed, so a given listing always gets
 * the same one. It reads as that listing's artwork rather than as a random
 * swatch that changes on every render.
 *
 * WHY NOT AN ICON PLACEHOLDER. A small outline glyph on a tinted ground looks
 * fine in isolation and fails at card size in a grid: three cards in a row all
 * showing the same faint bag icon read as a loading failure, not as a design.
 * Reported 2026-08-14 on the admin marketplace, where every image-less product
 * rendered an identical grey square and a leader reasonably assumed the images
 * were broken.
 *
 * LIVES HERE because it had drifted into three copies — the community app's
 * canonical one, an identical copy in the admin's components/ui, and a third
 * defined inline inside the admin's EventPreview. They agreed at the time of
 * writing and had no mechanism to keep agreeing: a palette change in one would
 * silently not reach the others, and the fallback would look like a different
 * product on each surface. One source, two consumers.
 *
 * Consumers must have this package in their Tailwind `@source` list (both
 * already do) or the `w-full h-full` utilities will not be generated.
 */

const PALETTES = [
  { angle: 135, from: "#c87038", via: "#e09050", to: "#eda870" },
  { angle: 145, from: "#1080c0", via: "#20a4f3", to: "#55c0f5" },
  { angle: 125, from: "#3a7050", via: "#4a8a68", to: "#65a880" },
  { angle: 155, from: "#6840a0", via: "#8060c0", to: "#9a80d8" },
  { angle: 135, from: "#a03828", via: "#c05040", to: "#d07060" },
  { angle: 130, from: "#3a4858", via: "#4a5a6a", to: "#6a7a8a" },
  { angle: 140, from: "#50685a", via: "#688070", to: "#84a090" },
  { angle: 150, from: "#805830", via: "#a07040", to: "#c09060" },
];

const OVERLAYS = [
  ["linear-gradient(158deg, transparent 42%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0.12) 58%, transparent 58%)", "linear-gradient(148deg, transparent 62%, rgba(0,0,0,0.08) 62%, rgba(0,0,0,0.08) 80%, transparent 80%)"],
  ["linear-gradient(125deg, transparent 25%, rgba(255,255,255,0.10) 25%, rgba(255,255,255,0.10) 40%, transparent 40%)", "linear-gradient(170deg, transparent 55%, rgba(0,0,0,0.09) 55%, rgba(0,0,0,0.09) 72%, transparent 72%)"],
  ["linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 50%, transparent 50%)", "linear-gradient(160deg, transparent 50%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0.06) 70%, transparent 70%)"],
  ["linear-gradient(145deg, transparent 20%, rgba(255,255,255,0.07) 20%, rgba(255,255,255,0.07) 35%, transparent 35%)", "linear-gradient(155deg, transparent 60%, rgba(0,0,0,0.07) 60%, rgba(0,0,0,0.07) 75%, transparent 75%)"],
  ["linear-gradient(140deg, transparent 35%, rgba(255,255,255,0.09) 35%, rgba(255,255,255,0.09) 48%, transparent 48%)", "linear-gradient(165deg, transparent 45%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.05) 65%, transparent 65%)"],
];

/**
 * Stable across processes and releases, unlike a hash that could vary by
 * runtime — the same listing must keep the same artwork, so this cannot change
 * without every existing listing's fallback changing with it.
 */
export function bannerPlaceholderHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** The composed CSS `background-image` for a seed. Exported for tests. */
export function bannerPlaceholderGradient(seed: string): string {
  const hash = bannerPlaceholderHash(seed || "listing");
  const p = PALETTES[hash % PALETTES.length]!;
  const o = OVERLAYS[(hash >>> 3) % OVERLAYS.length]!;
  const base = `linear-gradient(${p.angle}deg, ${p.from} 0%, ${p.via} 50%, ${p.to} 100%)`;
  return [...o, base].join(", ");
}

export interface BannerPlaceholderProps {
  /** Stable per listing — its name or id. The same seed always yields the same
   *  gradient, which is what makes this read as artwork rather than noise. */
  seed: string;
  className?: string;
}

export function BannerPlaceholder({ seed, className }: BannerPlaceholderProps) {
  const gradient = React.useMemo(() => bannerPlaceholderGradient(seed), [seed]);
  return <div className={cn("w-full h-full", className)} style={{ backgroundImage: gradient }} />;
}
