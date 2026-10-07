/**
 * Shared listing FILTERS — the category / sub-category / price / sort facets and
 * search the community-app storefront browses by, so the admin review queues can
 * offer the same filtering. The pure facet helpers are ported from the
 * community-app (categoryFacets, sortProducts); ListingFilterBar is a clean,
 * next-intl-free bar (copy via props) both surfaces can render.
 */
import { useId } from "react";

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

export interface ListingFilterBarProps {
  /** Facets to render as chip rows (category first, then sub-category, price, sort…). */
  facets: Facet[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** Search box — omitted when onSearchChange is not given. */
  search?: string;
  onSearchChange?: (s: string) => void;
  searchPlaceholder?: string;
  /** Label for the "no filter" chip that leads each single-choice row. */
  allLabel?: string;
  className?: string;
}

/**
 * A quiet facet bar: a prominent category chip row up top (with the search box),
 * then any further facet rows (sub-category, price, sort) beneath. Single-choice
 * throughout — clicking the active chip clears it. No i18n, no router: values and
 * copy come from the caller.
 */
export function ListingFilterBar({
  facets, value, onChange, search, onSearchChange, searchPlaceholder = "Search", allLabel = "All", className,
}: ListingFilterBarProps) {
  const searchId = useId();
  if (facets.length === 0 && !onSearchChange) return null;

  const set = (key: string, next: string) => onChange({ ...value, [key]: next });
  const [primary, ...rest] = facets;

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    }`;

  const Row = ({ facet }: { facet: Facet }) => {
    const current = value[facet.key] ?? facet.neutral ?? "";
    const neutral = facet.neutral ?? "";
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={facet.title}>
        <button type="button" className={chip(current === neutral)} onClick={() => set(facet.key, neutral)}>
          {allLabel}
        </button>
        {facet.options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={chip(active)}
              aria-pressed={active}
              onClick={() => set(facet.key, active ? neutral : o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-[13px] border border-zinc-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_6px_22px_-14px_rgba(24,24,27,0.10)] dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">{primary && <Row facet={primary} />}</div>
        {onSearchChange && (
          <label htmlFor={searchId} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-[13px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id={searchId}
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-36 bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
          </label>
        )}
      </div>
      {rest.map((facet) => (
        <Row key={facet.key} facet={facet} />
      ))}
    </div>
  );
}
