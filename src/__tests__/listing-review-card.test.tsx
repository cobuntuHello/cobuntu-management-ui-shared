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

  it("makes the WHOLE card the link when given an href (title is inside the <a>)", () => {
    render(<ListingReviewCard {...base} reviewHref="/community/learning/requests/abc" />);
    const cardLink = screen.getByText(DATA.title).closest("a");
    expect(cardLink).toHaveAttribute("href", "/community/learning/requests/abc");
    // The footer action is illustrative, not its own link — it resolves to the SAME
    // card link, i.e. there is no nested anchor.
    expect(screen.getByText("Review request").closest("a")).toBe(cardLink);
  });

  it("renders a static card (no link) in button mode, firing onReview", async () => {
    const onReview = vi.fn();
    render(<ListingReviewCard {...base} onReview={onReview} />);
    expect(screen.getByText(DATA.title).closest("a")).toBeNull(); // not a link
    await userEvent.click(screen.getByText("Review request"));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("hides the commission chip when there is none", () => {
    render(<ListingReviewCard {...base} commission={null} onReview={() => {}} />);
    expect(screen.queryByText(/commission/)).not.toBeInTheDocument();
  });

  it("renders a kind badge for courses/events", () => {
    render(<ListingReviewCard {...base} kind={{ label: "Course · 4 lessons", icon: "course" }} onReview={() => {}} />);
    expect(screen.getByText("Course · 4 lessons")).toBeInTheDocument();
  });

  it("event variant shows the date above the title (not a taxonomy) and a green price", () => {
    const { container } = render(
      <ListingReviewCard
        {...base}
        variant="event"
        data={{ ...DATA, taxonomy: "Design · UX", dateLabel: "Oct 17 · 7:00 PM", priceLabel: "Free", priceFree: true }}
        onReview={() => {}}
      />,
    );
    // The date leads the card; the taxonomy is not shown in the event layout.
    expect(screen.getByText("Oct 17 · 7:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("Design · UX")).not.toBeInTheDocument();
    // 4:3 image frame (event), not the product 16:10.
    expect(container.querySelector(".aspect-\\[4\\/3\\]")).not.toBeNull();
    // Price is green (event treatment), free or paid alike.
    const price = screen.getByText("Free");
    expect(price.className).toMatch(/text-green-600/);
  });

  it("product variant keeps the taxonomy and 16:10 frame", () => {
    const { container } = render(
      <ListingReviewCard {...base} data={{ ...DATA, taxonomy: "Design · UX", dateLabel: "ignored" }} onReview={() => {}} />,
    );
    expect(screen.getByText("Design · UX")).toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
    expect(container.querySelector(".aspect-\\[16\\/10\\]")).not.toBeNull();
  });
});
