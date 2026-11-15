import type { DiscountCode, DiscountCodeDraft, DiscountPreview } from "./types";

/**
 * The discount-code routes for one item, managed from one community. The host
 * passes the same `apiBaseUrl` and headers it uses for its other calls (the
 * community app injects "" so the call stays same-origin and the session
 * cookie goes with it).
 */
export interface DiscountCodesEndpoint {
  apiBaseUrl: string;
  communityTag: string;
  item: { kind: "product" | "event"; id: string };
  headers?: () => Record<string, string>;
}

export class DiscountCodeApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly body?: any) {
    super(message);
  }
}

function base(e: DiscountCodesEndpoint): string {
  const kind = e.item.kind === "product" ? "products" : "events";
  return `${e.apiBaseUrl}/api/communities/${encodeURIComponent(e.communityTag)}/${kind}/${encodeURIComponent(e.item.id)}/discount-codes`;
}

async function call<T>(e: DiscountCodesEndpoint, path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(base(e) + path, {
    method,
    headers: { "Content-Type": "application/json", ...(e.headers?.() ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DiscountCodeApiError(json?.error ?? `Request failed (${res.status})`, res.status, json?.code, json);
  return json as T;
}

export const discountCodesApi = {
  list: (e: DiscountCodesEndpoint) => call<{ codes: DiscountCode[] }>(e, "", "GET").then((r) => r.codes),
  preview: (e: DiscountCodesEndpoint, draft: Partial<DiscountCodeDraft>) => call<DiscountPreview>(e, "/preview", "POST", draft),
  create: (e: DiscountCodesEndpoint, draft: DiscountCodeDraft, confirm: boolean) =>
    call<{ code: DiscountCode }>(e, "", "POST", { ...draft, confirm }).then((r) => r.code),
  update: (e: DiscountCodesEndpoint, id: string, patch: Partial<DiscountCodeDraft> & { isActive?: boolean }, confirm = false) =>
    call<{ code: DiscountCode }>(e, `/${encodeURIComponent(id)}`, "PATCH", { ...patch, confirm }).then((r) => r.code),
  archive: (e: DiscountCodesEndpoint, id: string) =>
    call<{ code: DiscountCode }>(e, `/${encodeURIComponent(id)}`, "DELETE").then((r) => r.code),
};
