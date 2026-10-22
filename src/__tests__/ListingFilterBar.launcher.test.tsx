import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListingFilterBar } from "../filters";

/**
 * Launcher mode on the shared filter bar (T-271).
 *
 * The community-app's FilterBar has always routed its search field to the
 * contextual palette rather than typing in place, and says why in its own
 * header: a page that renders this bar usually has a palette on the same
 * screen, and two identically-worded search boxes -- one of which can offer
 * things the other cannot -- is a choice nobody can make correctly, because
 * nothing tells them which is which.
 *
 * This bar only had the in-place input, so the admin surfaces using it
 * deviated from the community app on exactly that point. Launcher mode closes
 * the gap WITHOUT changing the existing callers: it is opt-in.
 */

const FACETS = [{ key: "sort", title: "Sort", single: true, options: [{ value: "new", label: "Newest" }] }];

describe("launcher mode", () => {
  it("renders a button, not a text input", () => {
    render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} onSearchLaunch={() => {}} searchPlaceholder="Search events" />);
    expect(screen.getByText("Search events").closest("button")).not.toBeNull();
    expect(document.querySelector('input[type="search"]')).toBeNull();
  });

  it("calls the host's opener when clicked", () => {
    const launch = vi.fn();
    render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} onSearchLaunch={launch} searchPlaceholder="Search events" />);
    fireEvent.click(screen.getByText("Search events"));
    expect(launch).toHaveBeenCalledTimes(1);
  });

  /* The field still REFLECTS the active query, so the bar shows what is
     filtering the list even though you typed it somewhere else. */
  it("shows the active query in place of the placeholder", () => {
    render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} onSearchLaunch={() => {}} search="brunch" searchPlaceholder="Search events" />);
    expect(screen.getByText("brunch")).toBeTruthy();
    expect(screen.queryByText("Search events")).toBeNull();
  });

  /*
   * The existing callers (the admin's Requests queues) pass onSearchChange and
   * must keep their input. Opt-in means opt-in.
   */
  it("leaves the in-place input alone when no launcher is given", () => {
    render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} search="" onSearchChange={() => {}} searchPlaceholder="Search" />);
    expect(document.querySelector('input[type="search"]')).not.toBeNull();
  });

  /* Both passed is a caller mistake rather than a configuration: the launcher
     wins, so a stray onSearchChange cannot resurrect the second search box. */
  it("prefers the launcher when both are passed", () => {
    const change = vi.fn();
    const launch = vi.fn();
    render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} search="" onSearchChange={change} onSearchLaunch={launch} searchPlaceholder="Search" />);
    expect(document.querySelector('input[type="search"]')).toBeNull();
    fireEvent.click(screen.getByText("Search"));
    expect(launch).toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  /* Same box either way: the two modes must be indistinguishable until
     clicked, or the bar looks like a different control per page. */
  it("wears the same chrome in both modes", () => {
    const { container: a } = render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} onSearchLaunch={() => {}} />);
    const { container: b } = render(<ListingFilterBar facets={FACETS} value={{}} onChange={() => {}} search="" onSearchChange={() => {}} />);
    const cls = (c: HTMLElement) => (c.querySelector("button[type=button], label")!.getAttribute("class") || "");
    expect(cls(a)).toContain("min-h-[40px]");
    expect(cls(b)).toContain("min-h-[40px]");
  });
});
