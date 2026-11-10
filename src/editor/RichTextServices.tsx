"use client";

import * as React from "react";
import { searchPeople, type PersonSearchResult } from "../lib/searchPeople";

/**
 * What the description editor needs from its host to offer @mentions and
 * images (T-321). Both optional: an editor with no services is the plain
 * markdown editor it always was, so a host that mounts nothing loses nothing.
 */
export interface RichTextServices {
  /** People to offer for an `@` query. "Anyone on Cobuntu" (decided 2026-11-10). */
  searchPeople?: (query: string, signal: AbortSignal) => Promise<PersonSearchResult[]>;
  /** Store one image; resolve to its PERMANENT public URL (never a signed one). */
  uploadImage?: (file: File) => Promise<string>;
}

/*
 * The context object lives on globalThis, not in this module.
 *
 * The event and product packages each pin their own copy of this package, so
 * one page can load it two or three times. A plain createContext() per copy
 * would make the app's provider invisible to an editor rendered from inside
 * another package's copy, and the editor would quietly lose mentions and
 * images there. Symbol.for gives every copy the same key, so the first copy to
 * load creates the context and every other copy reuses it.
 */
const CONTEXT_KEY = Symbol.for("cobuntu.management-ui-shared.richTextServices");
type GlobalWithContext = typeof globalThis & { [CONTEXT_KEY]?: React.Context<RichTextServices> };
const g = globalThis as GlobalWithContext;
const RichTextServicesContext: React.Context<RichTextServices> =
  g[CONTEXT_KEY] ?? (g[CONTEXT_KEY] = React.createContext<RichTextServices>({}));

export function RichTextServicesProvider({ value, children }: { value: RichTextServices; children: React.ReactNode }) {
  return <RichTextServicesContext.Provider value={value}>{children}</RichTextServicesContext.Provider>;
}

export function useRichTextServices(): RichTextServices {
  return React.useContext(RichTextServicesContext);
}

/** An upload the server refused, with the message it gave (shown as-is). */
export class ImageUploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/**
 * The services against the Cobuntu API: global people search
 * (`GET /api/discovery/users`, which lists live accounts only) and
 * `POST /api/users/me/description-images`.
 */
export function createRichTextServices(opts: {
  apiBaseUrl: string;
  /** Auth headers for the upload; read on every call so a refreshed token is used. */
  headers?: () => Record<string, string>;
  /** Excluded from search results: you do not mention yourself. */
  currentUserId?: string | null;
}): RichTextServices {
  return {
    searchPeople: (query, signal) =>
      searchPeople({
        apiBaseUrl: opts.apiBaseUrl,
        communityTag: null,
        query,
        currentUserId: opts.currentUserId ?? null,
        signal,
      }),
    uploadImage: async (file) => {
      const body = new FormData();
      body.append("image", file);
      const headers = { ...(opts.headers?.() ?? {}) };
      // The browser sets the multipart boundary; a JSON content type would break it.
      delete headers["Content-Type"];
      delete headers["content-type"];
      const res = await fetch(`${opts.apiBaseUrl}/api/users/me/description-images`, {
        method: "POST",
        body,
        headers,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.url !== "string") {
        throw new ImageUploadError(typeof data?.error === "string" ? data.error : "", res.status);
      }
      return data.url as string;
    },
  };
}
