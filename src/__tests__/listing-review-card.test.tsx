import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StorefrontCard, ListingReviewCard, type StorefrontCardData } from "../cards";

const DATA: StorefrontCardData = {
  title: "Notion Productivity Template",
  seed: "seed-1",
  taxonomy: "Design · UX",
  priceLabel: "€25.00",
  meta: "Digital product",
};

describe("StorefrontCard", () => {
  it("renders title, taxonomy, price and falls back to the placeholder with no image", () => {
    const { container } = render(<StorefrontCard data={DATA} />);
    expect(screen.getByText("Notion Productivity Template")).toBeInTheDocument();
    expect(screen.getByText("Design · UX")).toBeInTheDocument();
    expect(screen.getByText("€25.00")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull(); // no imageUrl → placeholder, not <img>
  });
  it("uses the real image when given", () => {
    const { container } = render(<StorefrontCard data={{ ...DATA, imageUrl: "https://x/i.jpg" }} />);
    expect(container.querySelector("img")).not.toBeNull();
  });
});

describe("ListingReviewCard (Option A overlay)", () => {
  const base = {
    data: DATA,
    status: { label: "Pending", tone: "pending" as const },
    commission: "10% commission",
    requester: { name: "Alice Rivera" },
    requestedAtLabel: "Requested 6h ago",
  };

  it("shows status, commission, requester and the review action", () => {
    render(<ListingReviewCard {...base} onReview={() => {}} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("10% commission")).toBeInTheDocument();
    expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    expect(screen.getByText("Requested 6h ago")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument(); // avatar initial
    expect(screen.getByText("Review request")).toBeInTheDocument();
  });

  it("the avatar initial skips leading punctuation (first letter/digit)", () => {
    render(<ListingReviewCard {...base} requester={{ name: "[pending] Bob" }} onReview={() => {}} />);
    expect(screen.getByText("P")).toBeInTheDocument(); // first letter after "[" is the P of "pending"
  });

  it("fires onReview when it has no href (button mode)", async () => {
    const onReview = vi.fn();
    render(<ListingReviewCard {...base} onReview={onReview} reviewLabel="Review" />);
    await userEvent.click(screen.getByText("Review"));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("renders a link when given an href", () => {
    render(<ListingReviewCard {...base} reviewHref="/community/learning/requests/abc" />);
    const link = screen.getByText("Review request").closest("a");
    expect(link).toHaveAttribute("href", "/community/learning/requests/abc");
  });

  it("hides the commission chip when there is none", () => {
    render(<ListingReviewCard {...base} commission={null} onReview={() => {}} />);
    expect(screen.queryByText(/commission/)).not.toBeInTheDocument();
  });

  it("renders a kind badge for courses/events", () => {
    render(<ListingReviewCard {...base} kind={{ label: "Course · 4 lessons", icon: "course" }} onReview={() => {}} />);
    expect(screen.getByText("Course · 4 lessons")).toBeInTheDocument();
  });
});
