/**
 * Framework-agnostic seeded persona avatar — the "custom Cobuntu face" that
 * stands in when a user has no photo. Returns a complete <svg> STRING so React
 * and non-React callers render the exact same face for a given seed.
 *
 * ── Why this file is here, and what is still wrong ──────────────────────────
 *
 * Copied VERBATIM from the community app's `lib/persona/personaSvg.ts`, which
 * is the canonical implementation. This panel is mounted by both apps and
 * cannot reach into either one's lib folder, the same reason `listings/ui/
 * marks.tsx` carries its own copy of the brand marks.
 *
 * So this is now the THIRD copy of the face, and the other two have already
 * drifted: the community app builds a string with seed-derived gradient ids,
 * while the backoffice's `components/shared/UserPersonaAvatar.tsx` is a
 * separate React port that ids its gradients with `useId()`. Same seed, two
 * different faces depending on which app you are looking at.
 *
 * This copy is the string version on purpose: it is the deterministic one, so
 * server and client markup match and there is no hydration mismatch. The right
 * end state is both apps importing from here and deleting their own; this is a
 * step toward that, not the finished state.
 *
 * Deterministic: same seed → same SVG, always. Gradient IDs are derived from
 * the seed (not a render-time counter) so server and client output match —
 * no hydration mismatch — and two different seeds never collide.
 *
 * Ported from the original React-only UserPersonaAvatar (JSX → string).
 */

type FaceVariant = "smile" | "grin" | "joy" | "wonder" | "wink";

interface FacialMetrics {
  eyeSpacing: number;
  eyeY: number;
  eyeSize: number;
  mouthWidth: number;
  mouthHeight: number;
  mouthYOffset: number;
}

interface PersonaTheme {
  name: string;
  ringBase: string;
  ringAccent: string;
  faceBase: string;
  faceShade: string;
  feature: string;
  blush: string;
  highlight: string;
}

interface PersonaAttributes {
  theme: PersonaTheme;
  faceName: FaceVariant;
  ringPath: string;
  ringRadius: number;
  faceRadius: number;
  faceCenter: { x: number; y: number };
  faceTilt: number;
  cheekOpacity: number;
  metrics: FacialMetrics;
  highlightRotation: number;
}

const COBUNTU_COLORS = {
  tribalBlack: "#050404",
  campingGreen: "#d1d4c7",
  fireEnergy: "#d6904a",
  rainyBlue: "#20a4f3",
  sparkWhite: "#fffdfa",
  mudGrey: "#525252",
};

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "");
  const value = sanitized.length === 3
    ? sanitized.split("").map((c) => c + c).join("")
    : sanitized.padStart(6, "0");
  const intVal = parseInt(value, 16);
  return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function mixColor(base: string, mixWith: string, weight: number) {
  const w = Math.max(0, Math.min(1, weight));
  const a = hexToRgb(base);
  const b = hexToRgb(mixWith);
  return rgbToHex(a.r * (1 - w) + b.r * w, a.g * (1 - w) + b.g * w, a.b * (1 - w) + b.b * w);
}
function lightenColor(c: string, amount: number) { return mixColor(c, "#ffffff", amount); }
function darkenColor(c: string, amount: number) { return mixColor(c, "#000000", amount); }

const personaThemes: PersonaTheme[] = [
  {
    name: "embers",
    ringBase: COBUNTU_COLORS.fireEnergy,
    ringAccent: mixColor(COBUNTU_COLORS.fireEnergy, COBUNTU_COLORS.sparkWhite, 0.35),
    faceBase: mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.sparkWhite, 0.6),
    faceShade: mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.mudGrey, 0.2),
    feature: COBUNTU_COLORS.tribalBlack,
    blush: mixColor(COBUNTU_COLORS.fireEnergy, "#ffbfa0", 0.45),
    highlight: mixColor(COBUNTU_COLORS.sparkWhite, COBUNTU_COLORS.fireEnergy, 0.08),
  },
  {
    name: "lagoon",
    ringBase: mixColor(COBUNTU_COLORS.rainyBlue, COBUNTU_COLORS.sparkWhite, 0.15),
    ringAccent: mixColor(COBUNTU_COLORS.rainyBlue, COBUNTU_COLORS.campingGreen, 0.25),
    faceBase: mixColor(COBUNTU_COLORS.rainyBlue, COBUNTU_COLORS.sparkWhite, 0.35),
    faceShade: mixColor(COBUNTU_COLORS.rainyBlue, COBUNTU_COLORS.mudGrey, 0.18),
    feature: mixColor(COBUNTU_COLORS.tribalBlack, COBUNTU_COLORS.rainyBlue, 0.18),
    blush: mixColor(COBUNTU_COLORS.rainyBlue, "#9cdcff", 0.55),
    highlight: mixColor(COBUNTU_COLORS.sparkWhite, COBUNTU_COLORS.rainyBlue, 0.16),
  },
  {
    name: "grove",
    ringBase: mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.fireEnergy, 0.25),
    ringAccent: mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.sparkWhite, 0.5),
    faceBase: mixColor(mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.sparkWhite, 0.45), COBUNTU_COLORS.fireEnergy, 0.22),
    faceShade: mixColor(COBUNTU_COLORS.campingGreen, COBUNTU_COLORS.fireEnergy, 0.4),
    feature: mixColor(COBUNTU_COLORS.tribalBlack, COBUNTU_COLORS.mudGrey, 0.15),
    blush: mixColor(COBUNTU_COLORS.fireEnergy, "#f3d5b7", 0.4),
    highlight: mixColor(COBUNTU_COLORS.sparkWhite, COBUNTU_COLORS.campingGreen, 0.25),
  },
  {
    name: "twilight",
    ringBase: mixColor(COBUNTU_COLORS.mudGrey, COBUNTU_COLORS.rainyBlue, 0.35),
    ringAccent: mixColor(COBUNTU_COLORS.mudGrey, COBUNTU_COLORS.sparkWhite, 0.35),
    faceBase: mixColor(COBUNTU_COLORS.rainyBlue, COBUNTU_COLORS.campingGreen, 0.3),
    faceShade: mixColor(COBUNTU_COLORS.mudGrey, COBUNTU_COLORS.rainyBlue, 0.28),
    feature: mixColor(COBUNTU_COLORS.tribalBlack, COBUNTU_COLORS.mudGrey, 0.12),
    blush: mixColor(COBUNTU_COLORS.rainyBlue, "#c6d0ff", 0.45),
    highlight: mixColor(COBUNTU_COLORS.sparkWhite, COBUNTU_COLORS.rainyBlue, 0.2),
  },
  {
    name: "aurora",
    ringBase: mixColor(COBUNTU_COLORS.fireEnergy, COBUNTU_COLORS.rainyBlue, 0.2),
    ringAccent: mixColor(COBUNTU_COLORS.fireEnergy, COBUNTU_COLORS.sparkWhite, 0.25),
    faceBase: mixColor(COBUNTU_COLORS.fireEnergy, COBUNTU_COLORS.sparkWhite, 0.35),
    faceShade: mixColor(COBUNTU_COLORS.fireEnergy, COBUNTU_COLORS.mudGrey, 0.2),
    feature: COBUNTU_COLORS.tribalBlack,
    blush: mixColor(COBUNTU_COLORS.fireEnergy, "#ffcfa4", 0.4),
    highlight: mixColor(COBUNTU_COLORS.sparkWhite, COBUNTU_COLORS.fireEnergy, 0.18),
  },
];

// Face renderers — return SVG markup STRINGS (mirror of the original JSX).
const faceRenderers: Record<FaceVariant, (p: { featureColor: string; mouthColor: string; accentColor: string; metrics: FacialMetrics }) => string> = {
  smile: ({ featureColor, mouthColor, metrics }) => {
    const half = metrics.mouthWidth / 2;
    const stroke = metrics.eyeSize * 0.65;
    return `
      <circle cx="${-metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize}" fill="${featureColor}" />
      <circle cx="${metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize}" fill="${featureColor}" />
      <path d="M ${-half} ${metrics.mouthYOffset} Q 0 ${metrics.mouthYOffset + metrics.mouthHeight} ${half} ${metrics.mouthYOffset}" stroke="${mouthColor}" stroke-width="${stroke}" stroke-linecap="round" fill="none" />`;
  },
  grin: ({ featureColor, mouthColor, metrics }) => {
    const half = metrics.mouthWidth / 2;
    const eyeCurve = metrics.eyeSize * 1.6;
    const mouthY = metrics.mouthYOffset - metrics.eyeSize * 0.1;
    const peak = mouthY + metrics.mouthHeight * 1.35;
    return `
      <path d="M ${-metrics.eyeSpacing - 3} ${metrics.eyeY} Q ${-metrics.eyeSpacing} ${metrics.eyeY - eyeCurve} ${-metrics.eyeSpacing + 3} ${metrics.eyeY}" stroke="${featureColor}" stroke-width="${metrics.eyeSize * 0.55}" stroke-linecap="round" fill="none" />
      <path d="M ${metrics.eyeSpacing - 3} ${metrics.eyeY} Q ${metrics.eyeSpacing} ${metrics.eyeY - eyeCurve} ${metrics.eyeSpacing + 3} ${metrics.eyeY}" stroke="${featureColor}" stroke-width="${metrics.eyeSize * 0.55}" stroke-linecap="round" fill="none" />
      <path d="M ${-half} ${mouthY} Q 0 ${peak} ${half} ${mouthY}" stroke="${mouthColor}" stroke-width="${metrics.eyeSize * 0.8}" stroke-linecap="round" fill="none" />`;
  },
  joy: ({ featureColor, mouthColor, metrics }) => {
    const half = metrics.mouthWidth / 2;
    const mouthY = metrics.mouthYOffset;
    return `
      <path d="M ${-metrics.eyeSpacing - 3} ${metrics.eyeY} Q ${-metrics.eyeSpacing} ${metrics.eyeY - metrics.eyeSize * 1.4} ${-metrics.eyeSpacing + 3} ${metrics.eyeY}" stroke="${featureColor}" stroke-width="${metrics.eyeSize * 0.5}" stroke-linecap="round" fill="none" />
      <path d="M ${metrics.eyeSpacing - 3} ${metrics.eyeY} Q ${metrics.eyeSpacing} ${metrics.eyeY - metrics.eyeSize * 1.4} ${metrics.eyeSpacing + 3} ${metrics.eyeY}" stroke="${featureColor}" stroke-width="${metrics.eyeSize * 0.5}" stroke-linecap="round" fill="none" />
      <path d="M ${-half} ${mouthY} Q 0 ${mouthY + metrics.mouthHeight * 1.3} ${half} ${mouthY}" stroke="${mouthColor}" stroke-width="${metrics.eyeSize * 0.9}" stroke-linecap="round" fill="none" />`;
  },
  wonder: ({ featureColor, mouthColor, accentColor, metrics }) => {
    const eyeHighlight = metrics.eyeSize * 0.45;
    return `
      <circle cx="${-metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize + 1}" fill="${accentColor}" opacity="0.3" />
      <circle cx="${metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize + 1}" fill="${accentColor}" opacity="0.3" />
      <circle cx="${-metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize}" fill="${featureColor}" />
      <circle cx="${metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize}" fill="${featureColor}" />
      <circle cx="${-metrics.eyeSpacing - eyeHighlight * 0.2}" cy="${metrics.eyeY - eyeHighlight * 0.4}" r="${eyeHighlight}" fill="white" opacity="0.55" />
      <circle cx="${metrics.eyeSpacing - eyeHighlight * 0.2}" cy="${metrics.eyeY - eyeHighlight * 0.4}" r="${eyeHighlight}" fill="white" opacity="0.55" />
      <circle cx="0" cy="${metrics.mouthYOffset + metrics.mouthHeight * 0.2}" r="${metrics.mouthHeight}" fill="${mouthColor}" opacity="0.92" />`;
  },
  wink: ({ featureColor, mouthColor, metrics }) => {
    const half = metrics.mouthWidth / 2;
    return `
      <circle cx="${-metrics.eyeSpacing}" cy="${metrics.eyeY}" r="${metrics.eyeSize}" fill="${featureColor}" />
      <path d="M ${metrics.eyeSpacing - 4} ${metrics.eyeY} Q ${metrics.eyeSpacing} ${metrics.eyeY + metrics.eyeSize * 0.9} ${metrics.eyeSpacing + 4} ${metrics.eyeY}" stroke="${featureColor}" stroke-width="${metrics.eyeSize * 0.45}" stroke-linecap="round" fill="none" />
      <path d="M ${-half} ${metrics.mouthYOffset} Q 0 ${metrics.mouthYOffset + metrics.mouthHeight * 1.1} ${half} ${metrics.mouthYOffset}" stroke="${mouthColor}" stroke-width="${metrics.eyeSize * 0.6}" stroke-linecap="round" fill="none" />`;
  },
};

const faceNames = Object.keys(faceRenderers) as FaceVariant[];

function cyrb128(str: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point { x: number; y: number; }
function createOrganicRingPath(random: () => number, center = 40, radius = 36, points = 7): string {
  const pts: Point[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points;
    const r = radius * (0.88 + random() * 0.18);
    pts.push({ x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r });
  }
  if (pts.length < 3) return `M ${center - radius} ${center} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
  const commands: string[] = [];
  const firstMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  commands.push(`M ${firstMid.x.toFixed(2)} ${firstMid.y.toFixed(2)}`);
  for (let i = 1; i < pts.length; i++) {
    const current = pts[i];
    const next = pts[(i + 1) % pts.length];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    commands.push(`Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`);
  }
  commands.push(`Q ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} ${firstMid.x.toFixed(2)} ${firstMid.y.toFixed(2)}`);
  commands.push("Z");
  return commands.join(" ");
}

/** Deterministic persona attributes for a seed. Exported so the React layer can
 *  share the exact same algorithm if it ever needs the raw attributes. */
export function generatePersonaAttributes(seedSource: string): PersonaAttributes {
  const seed = cyrb128(seedSource || "cobuntu");
  const random = mulberry32(seed);
  const theme = personaThemes[Math.floor(random() * personaThemes.length)];
  const faceName = faceNames[Math.floor(random() * faceNames.length)];
  const ringRadius = 39.2 + random() * 0.6;
  const ringPath = createOrganicRingPath(random, 40, ringRadius, 8);
  const faceRadius = ringRadius - (4 + random() * 1.8);
  const faceCenter = { x: 40 + (random() - 0.5) * 2.6, y: 40 + (random() - 0.5) * 2.6 };
  const metrics: FacialMetrics = {
    eyeSpacing: 8.5 + random() * 2.2,
    eyeY: -4.5 + random() * 1.5,
    eyeSize: 2.6 + random() * 0.6,
    mouthWidth: 16 + random() * 5,
    mouthHeight: 6 + random() * 2.2,
    mouthYOffset: 6 + random() * 2,
  };
  return { theme, faceName, ringPath, ringRadius, faceRadius, faceCenter, faceTilt: (random() - 0.5) * 8, cheekOpacity: 0.3 + random() * 0.25, metrics, highlightRotation: random() * 360 };
}

/**
 * Build the full <svg> markup string for a seed. Gradient/clip IDs are derived
 * from the seed so SSR and client render byte-identical markup (no hydration
 * mismatch). Used by the React wrapper (dangerouslySetInnerHTML) and the
 * vanilla widgets (el.innerHTML).
 */
export function buildPersonaSvgString(seedSource: string): string {
  const a = generatePersonaAttributes(seedSource);
  const uid = cyrb128(seedSource || "cobuntu").toString(36);
  const rg = `cbp-rg-${uid}`;   // ring gradient
  const rh = `cbp-rh-${uid}`;   // ring highlight
  const fg = `cbp-fg-${uid}`;   // face gradient
  const cl = `cbp-cl-${uid}`;   // clip
  const { theme, faceName, ringPath, faceRadius, faceCenter, faceTilt, cheekOpacity, metrics, highlightRotation } = a;
  const faceRenderer = faceRenderers[faceName] ?? faceRenderers.smile;
  const cheekRadiusX = metrics.eyeSize * 2.1;
  const cheekRadiusY = metrics.eyeSize * 1.3;
  const cheekY = metrics.mouthYOffset + metrics.eyeSize * 0.4;

  return `<svg viewBox="0 0 80 80" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true" style="display:block">
  <defs>
    <linearGradient id="${rg}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="80" y2="0" gradientTransform="rotate(${highlightRotation} 40 40)">
      <stop offset="0%" stop-color="${lightenColor(theme.ringBase, 0.2)}" />
      <stop offset="100%" stop-color="${darkenColor(theme.ringAccent, 0.05)}" />
    </linearGradient>
    <linearGradient id="${rh}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="80" y2="0" gradientTransform="rotate(${highlightRotation + 45} 40 40)">
      <stop offset="0%" stop-color="${theme.highlight}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${theme.highlight}" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="${fg}" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${lightenColor(theme.faceBase, 0.18)}" />
      <stop offset="65%" stop-color="${theme.faceBase}" />
      <stop offset="100%" stop-color="${theme.faceShade}" />
    </radialGradient>
    <clipPath id="${cl}"><rect x="0" y="0" width="80" height="80" rx="40" ry="40" /></clipPath>
  </defs>
  <g clip-path="url(#${cl})">
    <path d="${ringPath}" fill="url(#${rg})" />
    <path d="${ringPath}" fill="url(#${rh})" />
    <path d="${ringPath}" fill="none" stroke="${darkenColor(theme.ringBase, 0.2)}" stroke-width="1.4" stroke-linecap="round" opacity="0.28" />
  </g>
  <circle cx="${faceCenter.x}" cy="${faceCenter.y}" r="${faceRadius + 1.5}" fill="${lightenColor(theme.ringAccent, 0.2)}" opacity="0.35" />
  <circle cx="${faceCenter.x}" cy="${faceCenter.y}" r="${faceRadius}" fill="url(#${fg})" />
  <ellipse cx="${faceCenter.x - faceRadius * 0.25}" cy="${faceCenter.y - faceRadius * 0.5}" rx="${faceRadius * 0.55}" ry="${faceRadius * 0.32}" fill="white" opacity="0.08" />
  <g transform="translate(${faceCenter.x}, ${faceCenter.y}) rotate(${faceTilt})">
    <g opacity="${cheekOpacity}">
      <ellipse cx="${-cheekRadiusX}" cy="${cheekY}" rx="${cheekRadiusX}" ry="${cheekRadiusY}" fill="${theme.blush}" />
      <ellipse cx="${cheekRadiusX}" cy="${cheekY}" rx="${cheekRadiusX}" ry="${cheekRadiusY}" fill="${theme.blush}" />
    </g>
    ${faceRenderer({ featureColor: theme.feature, accentColor: theme.highlight, mouthColor: theme.feature, metrics })}
  </g>
</svg>`;
}
