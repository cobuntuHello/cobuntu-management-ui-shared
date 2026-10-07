import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  buildCategoryFacets, sortProducts, ListingFilterBar,
  type CategoryOption, type Facet,
} from "../filters";

const CATS: CategoryOption[] = [
  { id: "c1", name: "Design", subcategories: [{ id: "s1", name: "UX" }, { id: "s2", name: "UI" }] },
  { id: "c2", name: "Business" },
];

describe("buildCategoryFacets", () => {
  it("returns a category row, and a sub-category row only once a parent is active", () => {
    expect(buildCategoryFacets(CATS, "", "Category")).toHaveLength(1);
    const withSub = buildCategoryFacets(CATS, "c1", "Category");
    expect(withSub).toHaveLength(2);
    expect(withSub[1].title).toBe("Design"); // sub-row titled by the parent
    expect(withSub[1].options.map((o) => o.label)).toEqual(["UX", "UI"]);
  });
  it("is empty when there are no categories (so the bar hides)", () => {
    expect(buildCategoryFacets([], "", "Category")).toEqual([]);
  });
});

describe("sortProducts", () => {
  const items = [{ name: "B", price: 300 }, { name: "A", price: 100 }];
  it("sorts by price and name, keeps server order otherwise", () => {
    expect(sortProducts(items, "priceAsc").map((i) => i.price)).toEqual([100, 300]);
    expect(sortProducts(items, "nameAsc").map((i) => i.name)).toEqual(["A", "B"]);
    expect(sortProducts(items, "")).toBe(items);
  });
});

describe("ListingFilterBar (no i18n provider)", () => {
  const facets: Facet[] = buildCategoryFacets(CATS, "", "Category");

  it("renders category chips + an All reset, and selects on click", async () => {
    const onChange = vi.fn();
    render(<ListingFilterBar facets={facets} value={{}} onChange={onChange} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Design"));
    expect(onChange).toHaveBeenCalledWith({ category: "c1" });
  });

  it("clicking the active chip clears it", async () => {
    const onChange = vi.fn();
    render(<ListingFilterBar facets={facets} value={{ category: "c1" }} onChange={onChange} />);
    await userEvent.click(screen.getByText("Design"));
    expect(onChange).toHaveBeenCalledWith({ category: "" });
  });

  it("shows a search box only when onSearchChange is given", async () => {
    const onSearch = vi.fn();
    const { rerender } = render(<ListingFilterBar facets={facets} value={{}} onChange={() => {}} />);
    expect(screen.queryByPlaceholderText("Find")).not.toBeInTheDocument();
    rerender(<ListingFilterBar facets={facets} value={{}} onChange={() => {}} search="" onSearchChange={onSearch} searchPlaceholder="Find" />);
    await userEvent.type(screen.getByPlaceholderText("Find"), "x");
    expect(onSearch).toHaveBeenCalledWith("x");
  });
});
