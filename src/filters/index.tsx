/**
 * Shared listing FILTERS — the category / sub-category / price / sort facets and
 * search the community-app storefront browses by, so the admin review queues can
 * offer the same filtering. The pure facet helpers are ported from the
 * community-app (categoryFacets, sortProducts); ListingFilterBar is a clean,
 * next-intl-free bar (copy via props) both surfaces can render.
 */
import { useEffect, useId, useMemo, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
export interface CategoryOption {
  id: string;
  name: string;
  subcategories?: { id: string; name: string }[];
}
export interface FacetOption {
  value: string;
  label: string;
}
export interface Facet {
  key: string;
  title: string;
  /** Single-choice (the only mode used here); a chip toggles on/off. */
  single?: boolean;
  /** The value that means "no filter" (so the chip row can show it selected). */
  neutral?: string;
  options: FacetOption[];
}
export type FilterValue = Record<string, string>;

// ── Pure helpers (ported verbatim) ───────────────────────────────────────────

/**
 * The category row, and the sub-category row that follows once a parent is
 * chosen. Typed against CategoryOption with no cast (the community-app bug was a
 * `subCategories` vs `subcategories` typo behind an `as any`).
 */
export function buildCategoryFacets(
  categories: CategoryOption[],
  activeCategoryId: string,
  categoryTitle: string,
): Facet[] {
  if (categories.length === 0) return [];
  const out: Facet[] = [{
    key: "category",
    title: categoryTitle,
    single: true,
    options: categories.map((c) => ({ value: c.id, label: c.name })),
  }];
  const active = categories.find((c) => c.id === activeCategoryId);
  const subs = active?.subcategories ?? [];
  if (subs.length > 0) {
    out.push({
      key: "subCategory",
      title: active!.name,
      single: true,
      options: subs.map((sc) => ({ value: sc.id, label: sc.name })),
    });
  }
  return out;
}

/**
 * The order a listing grid renders in for a Sort value. Unknown/neutral keeps
 * the server order. Prices are in cents (exact numeric compare).
 */
export function sortProducts<T extends { name: string; price: number }>(items: T[], by: string): T[] {
  const orders: Record<string, (a: T, b: T) => number> = {
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    nameAsc: (a, b) => a.name.localeCompare(b.name),
  };
  const cmp = orders[by];
  return cmp ? [...items].sort(cmp) : items;
}

// ── The bar ──────────────────────────────────────────────────────────────────

/**
 * Copy the bar needs, injected so the package stays next-intl-free. Each app
 * threads its own translations; English defaults keep the component renderable
 * on its own (tests, Storybook).
 */
export interface ListingFilterBarCopy {
  all: string;
  filters: string;
  clear: string;
  close: string;
  /** e.g. "Show 7". */
  show: (count: number) => string;
}

const DEFAULT_COPY: ListingFilterBarCopy = {
  all: "All",
  filters: "Filters",
  clear: "Clear",
  close: "Close",
  show: (n) => `Show ${n}`,
};

export interface ListingFilterBarProps {
  /**
   * Primary facets rendered as always-visible scrolling CHIP rows (the category
   * taxonomy, then its sub-category once a parent is chosen). A category is how
   * you browse, not a refinement, so it stays in the open.
   */
  inlineFacets?: Facet[];
  /**
   * Secondary facets (Price, Sort) behind the Filters button, in a modal. A
   * refinement is reached with an intent already formed, so a click costs
   * nothing and keeps the toolbar from becoming a wall of chip rows.
   */
  facets: Facet[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** In-place search box — omitted when onSearchChange is not given. */
  search?: string;
  onSearchChange?: (s: string) => void;
  searchPlaceholder?: string;
  /** How many results the CURRENT selection yields (summary line + "Show N"). */
  resultCount?: number;
  /** The noun the summary counts, e.g. "results". */
  resultNoun?: string;
  /** How many results a hypothetical selection would leave (per-option counts). */
  countFor?: (next: FilterValue) => number;
  copy?: Partial<ListingFilterBarCopy>;
  className?: string;
}

/** The reset value — every facet back to its neutral. */
export function emptyValue(facets: Facet[]): FilterValue {
  const out: FilterValue = {};
  for (const f of facets) out[f.key] = f.neutral ?? "";
  return out;
}

/** Facet selections that actually narrow something (ignores a facet at neutral). */
function activeCount(facets: Facet[], value: FilterValue): number {
  let n = 0;
  for (const f of facets) {
    const v = value[f.key];
    if (v && v !== (f.neutral ?? "")) n += 1;
  }
  return n;
}

/**
 * The storefront filter bar, mirrored for the admin review queues: scrolling
 * category chip rows up top, a search box + a Filters button that opens a modal
 * for Price / Sort, and a one-line result summary. Single-choice throughout
 * (clicking the active chip clears it). Light-only + next-intl-free: the admin
 * runs un-branded, so the brand accent falls back to neutral ink; copy and
 * values come from the caller.
 */
export function ListingFilterBar({
  inlineFacets = [], facets, value, onChange,
  search, onSearchChange, searchPlaceholder = "Search",
  resultCount, resultNoun = "results", countFor, copy, className,
}: ListingFilterBarProps) {
  const t = { ...DEFAULT_COPY, ...copy };
  const searchId = useId();
  const [open, setOpen] = useState(false);

  /* The badge counts the MODAL facets only, so the Filters button never claims
     credit for a category the row above it already shows. Clear resets all. */
  const nModal = activeCount(facets, value);
  const allFacets = useMemo(() => [...inlineFacets, ...facets], [inlineFacets, facets]);
  const nAll = activeCount(allFacets, value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pick(f: Facet, option: string) {
    const neutral = f.neutral ?? "";
    const cur = value[f.key] ?? neutral;
    onChange({ ...value, [f.key]: cur === option ? neutral : option });
  }

  function hypothetical(f: Facet, option: string): number {
    const neutral = f.neutral ?? "";
    const cur = value[f.key] ?? neutral;
    return countFor ? countFor({ ...value, [f.key]: cur === option ? neutral : option }) : 0;
  }

  /* The applied line as a sentence, not a row of removable chips. */
  const applied = useMemo(() => {
    const words: string[] = [];
    for (const f of facets) {
      const v = value[f.key];
      if (v && v !== (f.neutral ?? "")) words.push(f.options.find((o) => o.value === v)?.label ?? v);
    }
    return words;
  }, [facets, value]);

  if (inlineFacets.length === 0 && facets.length === 0 && !onSearchChange) return null;

  /* Accent falls back to neutral ink: the admin review queue is un-branded, so
     --brand-color is usually unset; a plain #18181b keeps selected chips legible
     without pulling in a community palette. */
  const ACCENT = "var(--brand-color, #18181b)";

  return (
    <div className={`mb-1 ${className ?? ""}`}>
      {/* Primary category rows. */}
      {inlineFacets.map((f, depth) => {
        const neutral = f.neutral ?? "";
        const current = value[f.key] ?? neutral;
        return (
          <div
            key={f.key}
            className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label={f.title}
          >
            {[{ value: neutral, label: t.all }, ...f.options].map((o) => {
              const on = current === o.value;
              return (
                <button
                  key={o.value || "__all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(f, o.value)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-0 font-semibold transition-colors ${
                    depth === 0 ? "min-h-[36px] px-3.5 text-[13.5px]" : "min-h-[32px] px-3 text-[12.5px]"
                  }`}
                  style={{
                    background: on
                      ? depth === 0 ? ACCENT : "color-mix(in srgb, var(--brand-color, #18181b) 14%, transparent)"
                      : "rgba(128,128,128,0.08)",
                    color: on
                      ? depth === 0 ? "var(--brand-contrast, #fff)" : ACCENT
                      : "#3f3f46",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        {onSearchChange && (
          <label
            htmlFor={searchId}
            className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-[11px] border border-[rgba(128,128,128,0.18)] bg-[rgba(128,128,128,0.04)] px-3 text-zinc-500 transition-colors focus-within:border-[rgba(128,128,128,0.35)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-45" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
            </svg>
            <input
              id={searchId}
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>
        )}

        {facets.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.filters}
            className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-2 rounded-[11px] border-0 px-3.5 text-[14px] font-semibold transition-colors"
            style={{
              background: nModal ? "color-mix(in srgb, var(--brand-color, #18181b) 12%, transparent)" : "rgba(128,128,128,0.10)",
              color: nModal ? ACCENT : "#3f3f46",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M7 12h10M11 18h2" />
            </svg>
            <span className="hidden sm:inline">{t.filters}</span>
            {nModal > 0 && (
              <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full px-1.5 text-[11px] font-bold"
                style={{ background: ACCENT, color: "var(--brand-contrast, #fff)" }}>
                {nModal}
              </span>
            )}
          </button>
        )}

        {nAll > 0 && (
          <button
            type="button"
            onClick={() => onChange(emptyValue(allFacets))}
            className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center rounded-[11px] border-0 px-3.5 text-[14px] font-semibold text-zinc-700"
            style={{ background: "rgba(128,128,128,0.10)" }}
          >
            {t.clear}
          </button>
        )}
      </div>

      {typeof resultCount === "number" && (
        <div className="mt-2 text-[13px] text-zinc-500">
          <b className="font-semibold text-zinc-700">{resultCount}</b> {resultNoun}
          {applied.length > 0 && ` · ${applied.join(" · ")}`}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.filters}
            className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[18px] bg-white text-zinc-900 sm:max-h-[82vh] sm:max-w-[440px] sm:rounded-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-zinc-300 sm:hidden" />
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <span className="text-[16px] font-semibold">{t.filters}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-zinc-100 text-zinc-700"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2 pt-1">
              {facets.map((f) => {
                const neutral = f.neutral ?? "";
                const current = value[f.key] ?? neutral;
                return (
                  <div key={f.key} className="pt-4">
                    <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">{f.title}</p>
                    <div className="flex flex-col gap-0.5">
                      {[{ value: neutral, label: t.all }, ...f.options].map((o) => {
                        const on = current === o.value;
                        return (
                          <button
                            key={o.value || "__all"}
                            type="button"
                            aria-pressed={on}
                            onClick={() => pick(f, o.value)}
                            className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[9px] border-0 bg-transparent px-2 py-1.5 text-left text-[14.5px] text-zinc-900 transition-colors hover:bg-[rgba(128,128,128,0.09)]"
                          >
                            <span
                              className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full"
                              style={{
                                border: on ? "none" : "1.5px solid rgba(128,128,128,0.35)",
                                background: on ? ACCENT : "transparent",
                                color: on ? "var(--brand-contrast, #fff)" : "transparent",
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true">
                                <path d="m4 12 6 6L20 6" />
                              </svg>
                            </span>
                            <span className="min-w-0 flex-1 truncate">{o.label}</span>
                            {countFor && o.value !== neutral && (
                              <span className="shrink-0 text-[12.5px] tabular-nums text-zinc-400">{hypothetical(f, o.value)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 border-t border-zinc-100 px-4 py-3">
              <button
                type="button"
                disabled={nAll === 0}
                onClick={() => onChange(emptyValue(allFacets))}
                className="min-h-[44px] flex-1 rounded-[11px] border-0 bg-[rgba(128,128,128,0.10)] text-[14px] font-semibold text-zinc-700 enabled:cursor-pointer disabled:cursor-default disabled:opacity-40"
              >
                {t.clear}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] flex-1 cursor-pointer rounded-[11px] border-0 text-[14px] font-semibold"
                style={{ background: ACCENT, color: "var(--brand-contrast, #fff)" }}
              >
                {t.show(resultCount ?? 0)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
