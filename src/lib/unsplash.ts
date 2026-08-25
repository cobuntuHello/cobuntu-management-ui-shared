/**
 * Unsplash, on the terms Unsplash actually sets.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * The stock-photo picker exists in THREE copies (the admin app, and the two
 * management packages). Each one called `api.unsplash.com` directly with
 * `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` in the query string. That had two problems
 * beyond the duplication:
 *
 *   1. `NEXT_PUBLIC_` puts the key in the JS bundle. Anyone could read it out
 *      of devtools and spend the quota, which is shared across every user of
 *      the app because it is one key.
 *   2. Unsplash's API Guidelines require crediting the photographer and
 *      pinging a per-photo download endpoint when a photo is used. Neither was
 *      implemented, so the app could not be approved for the Production tier
 *      (5,000 requests/hour) and was stuck on Demo (50/hour).
 *
 * The calls now go through a same-origin proxy route that each host app
 * implements, holding the key server-side. What stays shared is the part that
 * must be identical in all three copies to keep the app compliant: the request
 * shapes, the attribution links, and the download ping.
 *
 * ── The two Guidelines rules encoded here ───────────────────────────────────
 *
 * `photographerUrl` / `UNSPLASH_URL` build the attribution links. Unsplash
 * requires the credit to link back with `utm_source` set to the application
 * name registered with them, and `utm_medium=referral`. A credit without those
 * params does not count as attribution.
 *
 * `notifyDownload` pings `links.download_location` when a photo is CHOSEN.
 * This is how photographers get credited with a download, and Unsplash checks
 * for it during Production review. It is deliberately fire-and-forget: the
 * person picked a picture, and a failed analytics ping must not stop them.
 */

/** The application name registered with Unsplash. Must match, or attribution does not count. */
export const UNSPLASH_APP_NAME = "cobuntu";

const UTM = `utm_source=${UNSPLASH_APP_NAME}&utm_medium=referral`;

/** Unsplash itself, with the referral params the Guidelines require. */
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;

/** The shape the proxy returns. A subset of Unsplash's photo object. */
export interface UnsplashPhoto {
  id: string;
  urls: { regular: string; thumb: string; full: string };
  alt_description?: string | null;
  user: {
    name: string;
    username?: string;
    links?: { html?: string };
  };
  /**
   * Unsplash's per-photo download-tracking endpoint. Optional because a photo
   * that somehow arrives without it must still be selectable -- we skip the
   * ping rather than block the pick.
   */
  links?: { download_location?: string };
}

/** Same-origin proxy routes. Each host app implements both. */
export const UNSPLASH_PHOTOS_PATH = "/api/unsplash/photos";
export const UNSPLASH_DOWNLOAD_PATH = "/api/unsplash/download";

/** Append the referral params the Guidelines require to an unsplash.com URL. */
export function withReferral(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

/**
 * The photographer's profile, with referral params.
 *
 * Prefers the `links.html` Unsplash returns; falls back to building it from
 * the username so a partial payload still produces a working credit rather
 * than a dead link.
 */
export function photographerUrl(photo: UnsplashPhoto): string {
  const base =
    photo.user?.links?.html ||
    (photo.user?.username ? `https://unsplash.com/@${photo.user.username}` : "https://unsplash.com");
  return withReferral(base);
}

/** The request URL for the proxy. An empty query means "random photos". */
export function photosRequestUrl(query: string): string {
  const trimmed = query.trim();
  return trimmed
    ? `${UNSPLASH_PHOTOS_PATH}?query=${encodeURIComponent(trimmed)}`
    : UNSPLASH_PHOTOS_PATH;
}

/**
 * What the picker needs to render, kept separate from HOW it failed.
 *
 * `unconfigured` is its own case rather than an error because it is not a
 * fault: the deployment has no Unsplash key, the picker says so calmly, and
 * the upload button beside it still works. Collapsing it into `error` is what
 * made the old copy read as broken.
 */
export type StockPhotoResult =
  | { status: "ok"; photos: UnsplashPhoto[] }
  | { status: "unconfigured" }
  | { status: "error" };

export interface StockPhotoRequestOptions {
  /** Extra headers, e.g. the host app's `Authorization`. Cookie-auth apps pass nothing. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Ask the proxy for photos.
 *
 * Never throws -- an aborted or failed request becomes a status the picker can
 * render, because this runs on every keystroke-debounce and a rejected promise
 * there is just an unhandled rejection in the console.
 */
export async function fetchStockPhotos(
  query: string,
  opts: StockPhotoRequestOptions = {},
): Promise<StockPhotoResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(photosRequestUrl(query), {
      credentials: "same-origin",
      headers: opts.headers,
      signal: opts.signal,
    });
    // 503 is the proxy saying "no key configured here", which is not a fault.
    if (res.status === 503) return { status: "unconfigured" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    const photos = Array.isArray(data?.photos) ? (data.photos as UnsplashPhoto[]) : [];
    return { status: "ok", photos };
  } catch {
    return { status: "error" };
  }
}

/**
 * Tell Unsplash the photo was used. Fire-and-forget, by design.
 *
 * The proxy holds the key and re-checks that the location is an Unsplash URL,
 * so this only ever hands over the value Unsplash itself supplied.
 */
export function notifyDownload(
  photo: UnsplashPhoto,
  opts: StockPhotoRequestOptions = {},
): void {
  const location = photo.links?.download_location;
  if (!location) return;
  const doFetch = opts.fetchImpl ?? fetch;
  void doFetch(UNSPLASH_DOWNLOAD_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify({ downloadLocation: location }),
    // keepalive: the pick usually closes the modal and can navigate away
    // immediately after. Without this the ping is cancelled and the
    // photographer loses the credit.
    keepalive: true,
  }).catch(() => {
    /* Attribution analytics must never surface to the person picking a photo. */
  });
}
