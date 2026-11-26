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

describe("ListingReviewCard (the /marketplace card with the reviewer's layer)", () => {
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
    expect(screen.getByText(/· requested 6h ago/)).toBeInTheDocument();
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

  it("leads the taxonomy line with the kind for courses", () => {
    render(<ListingReviewCard {...base} kind={{ label: "Course", icon: "course" }} onReview={() => {}} />);
    expect(screen.getByText("Course · Design · UX")).toBeInTheDocument();
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

  it("product variant keeps the taxonomy and the /marketplace 4:3 frame", () => {
    const { container } = render(
      <ListingReviewCard {...base} data={{ ...DATA, taxonomy: "Design · UX", dateLabel: "ignored" }} onReview={() => {}} />,
    );
    expect(screen.getByText("Design · UX")).toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
    expect(container.querySelector(".aspect-\\[4\\/3\\]")).not.toBeNull();
  });

  it("says the state in words with a dot, never a pill on the picture (request cards, 26 Nov 2026)", () => {
    render(<ListingReviewCard {...base} onReview={() => {}} />);
    const state = screen.getByText("Pending");
    expect(state.className).not.toMatch(/rounded-full/);
    expect(state.className).toMatch(/text-amber-700/);
    expect(screen.getByText("10% commission").parentElement!.textContent).toBe("Asks for 10% commission");
  });

  it("says On, not Asks for, once the terms are agreed", () => {
    render(<ListingReviewCard {...base} status={{ label: "Live", tone: "approved" }} commission="PBN-promoted · 10%" onReview={() => {}} />);
    expect(screen.getByText("PBN-promoted · 10%").parentElement!.textContent).toBe("On PBN-promoted · 10%");
  });

  it("gives the review action a 44px target", () => {
    render(<ListingReviewCard {...base} onReview={() => {}} />);
    expect(screen.getByRole("button", { name: /Review request/ }).className).toMatch(/min-h-\[44px\]/);
  });
});

describe("StorefrontCard, the /marketplace anatomy", () => {
  it("draws who sells it, two lines of description, and the members' price against the full one", () => {
    render(<StorefrontCard data={{
      ...DATA, description: "Cybertech Texas Mission: Austin and SXSW 2027.",
      people: [{ name: "Thiago Vieira" }], peopleNote: "requested 9 days ago",
      priceLabel: "$3,597.30", listPriceLabel: "$3,997.00",
    }} />);
    expect(screen.getByText("Thiago Vieira")).toBeInTheDocument();
    expect(screen.getByText(/requested 9 days ago/)).toBeInTheDocument();
    expect(screen.getByText("Cybertech Texas Mission: Austin and SXSW 2027.").className).toMatch(/line-clamp-2/);
    expect(screen.getByText("$3,997.00").className).toMatch(/line-through/);
  });

  it("says when there is no description yet, instead of leaving a gap", () => {
    render(<StorefrontCard data={{ ...DATA, description: "", descriptionFallback: "No description yet." }} />);
    expect(screen.getByText("No description yet.")).toBeInTheDocument();
  });

  it("shows a state beside the price when given one", () => {
    render(<StorefrontCard data={DATA} state={{ label: "Live", tone: "live" }} />);
    expect(screen.getByText("Live").className).toMatch(/text-emerald-700/);
  });
});
