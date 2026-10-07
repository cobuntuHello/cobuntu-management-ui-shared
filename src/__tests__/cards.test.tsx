import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { htmlToPlainText, StarRating, ListingStateChip } from "../cards";

/**
 * The shared storefront-card foundation (PR 1): the pieces must behave exactly
 * like the community-app originals they replace, and — the point of the
 * extraction — render with NO i18n provider, falling back to English copy, so
 * the admin app can use them as-is.
 */

describe("htmlToPlainText", () => {
  it("strips tags and decodes entities, &amp; last", () => {
    expect(htmlToPlainText("<p>Two&nbsp;rooms &amp; one&#39;s free</p>"))
      .toBe("Two rooms & one's free");
  });
  it("keeps emoji (codepoint decode, not charCode)", () => {
    expect(htmlToPlainText("hi &#128512;")).toBe("hi 😀");
  });
  it("is empty for nullish input", () => {
    expect(htmlToPlainText(null)).toBe("");
    expect(htmlToPlainText(undefined)).toBe("");
  });
});

describe("StarRating (no i18n provider)", () => {
  it("renders the rating and count with default English copy", () => {
    render(<StarRating value={4.67} count={12} />);
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });
  it("an unrated listing shows 0/5 (0), not a sentence, with the aria saying unrated", () => {
    const { container } = render(<StarRating value={null} count={0} />);
    expect(container.textContent).toBe("0/5★(0)");
    expect(container.querySelector("span[aria-label]")?.getAttribute("aria-label")).toBe("No reviews yet");
  });
  it("accepts injected copy (for the community-app's translations)", () => {
    render(<StarRating value={4.5} count={12} size="full" copy={{ reviewSuffixFull: (c) => `${c} avis` }} />);
    expect(screen.getByText("12 avis")).toBeInTheDocument();
  });
  it("the full size has a distinct suffix; compact is always '(n)'", () => {
    const { container } = render(<StarRating value={4.5} count={12} size="full" />);
    expect(container.textContent).toContain("12 reviews");
    expect(container.textContent).not.toContain("(12)");
  });
});

describe("ListingStateChip (no i18n provider)", () => {
  it("renders default English labels and dots only the actionable states", () => {
    const { rerender, container } = render(<ListingStateChip status="PENDING" />);
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(container.querySelector("span[aria-hidden]")).not.toBeNull(); // dot shown
    rerender(<ListingStateChip status="DRAFT" />);
    expect(screen.getByText("Unpublished")).toBeInTheDocument();
    rerender(<ListingStateChip status="UNFINISHED" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
  it("accepts injected labels", () => {
    render(<ListingStateChip status="LIVE" labels={{ LIVE: "Em directo" }} />);
    expect(screen.getByText("Em directo")).toBeInTheDocument();
  });
});
