/**
 * Shrinking an image before it leaves the browser.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Every photo picked in the create wizards passes through one crop modal, and
 * that modal rendered to a canvas sized `img.width` — the camera's resolution.
 * A modern phone shoots 4000px wide, so a listing card that displays at maybe
 * 600px was carrying a 4000px JPEG at quality 0.92.
 *
 * The cost lands in two different places, because the two domains send media
 * differently. Products upload up to five `File`s as multipart. Events embed
 * the banner as a base64 data URL inside a JSON body, which is a further ~33%
 * on the wire. Both are dominated by the same thing: pixels nobody will ever
 * see.
 *
 * Nothing resizes them afterwards either — the server stores what it is given.
 * So the browser is the only place this can be fixed, and it is also the right
 * place: bytes not sent are faster than bytes sent efficiently.
 *
 * ── Why a cap and not a quality drop ────────────────────────────────────────
 *
 * Lowering quality alone blurs detail while keeping the pixel count, which is
 * the worst of both. Capping the LONG EDGE keeps the image sharp at any size it
 * is actually displayed and cuts the byte count roughly with the square of the
 * scale factor — a 4000px photo capped to 2000px is a quarter of the pixels
 * before compression even starts.
 */

/**
 * The longest edge any wizard image needs.
 *
 * 2000px covers every surface that displays these: cards render a few hundred
 * pixels wide, the detail hero is viewport-width, and a 2x retina display at
 * full width still lands under this. Above it, the extra pixels are paid for on
 * every upload and discarded by every browser that renders them.
 */
export const MAX_IMAGE_EDGE = 2000;

/**
 * JPEG quality for wizard images.
 *
 * 0.92 is close to visually lossless and roughly twice the bytes of 0.82, which
 * is where artefacts are still invisible on photographic content at these
 * dimensions. Combined with the edge cap this is the second of the two levers,
 * and the smaller one — the cap does most of the work.
 */
export const IMAGE_QUALITY = 0.82;

/** A source with intrinsic dimensions: an <img>, a canvas, or a bitmap. */
export interface Sized {
    width: number;
    height: number;
}

/**
 * The size this image should be drawn at, capped on its longest edge.
 *
 * Returns the ORIGINAL dimensions when it is already within the cap. Never
 * enlarges: upscaling a small image would add bytes and no detail, and someone
 * uploading a 400px logo means it.
 *
 * Pure, so it can be tested without a DOM.
 */
export function fitWithin(source: Sized, maxEdge: number = MAX_IMAGE_EDGE): Sized {
    const longest = Math.max(source.width, source.height);
    if (longest <= maxEdge || longest === 0) {
        return { width: source.width, height: source.height };
    }
    const scale = maxEdge / longest;
    return {
        // Round rather than floor: flooring both edges on a near-square image
        // shifts the aspect ratio by up to a pixel each way, which is visible
        // as a hairline crop on a banner that was cropped to fit exactly.
        width: Math.round(source.width * scale),
        height: Math.round(source.height * scale),
    };
}

/**
 * Draw a source onto a canvas at no more than `maxEdge` on its longest side.
 *
 * The canvas is sized to the FITTED dimensions and the source is drawn to fill
 * it, so the browser does the resampling — which is both faster and better than
 * anything hand-rolled, and is why this takes a canvas rather than returning
 * pixels.
 *
 * `imageSmoothingQuality` is set explicitly because the default varies by
 * browser, and "low" on a 4x downscale is visibly worse than "high" at no
 * meaningful cost for a one-off operation.
 */
export function drawFitted(
    canvas: HTMLCanvasElement,
    source: CanvasImageSource & Sized,
    maxEdge: number = MAX_IMAGE_EDGE,
): CanvasRenderingContext2D | null {
    const fitted = fitWithin(source, maxEdge);
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, fitted.width, fitted.height);
    return ctx;
}
