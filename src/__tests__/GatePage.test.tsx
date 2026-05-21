import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GatePage } from "../ui/GatePage";

describe("GatePage", () => {
  // ─── community_private ─────────────────────────────────────────────
  it("community_private: headlines with community name + sign-in CTA", () => {
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/events/sfn-01"
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: /PBN is a private community/i,
      }),
    ).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: /sign in/i });
    expect(signIn).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fevents%2Fsfn-01",
    );
  });

  it("community_private: shows secondary 'Apply to join' CTA for anonymous viewers", () => {
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/feed"
      />,
    );
    const apply = screen.getByRole("link", { name: /apply to join$/i });
    expect(apply).toHaveAttribute("href", "/apply?returnTo=%2Ffeed");
  });

  it("community_private + viewerLoggedIn: primary CTA flips to 'Apply to join $community', secondary hidden", () => {
    // Logged-in non-member can't be helped by /login (their auth already
    // works). Short-circuit to the apply form so they don't bounce off
    // the login page and back here.
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/events/sfn-01"
        viewerLoggedIn
      />,
    );
    const primary = screen.getByRole("link", { name: /apply to join PBN/i });
    expect(primary).toHaveAttribute(
      "href",
      "/apply?returnTo=%2Fevents%2Fsfn-01",
    );
    // No separate secondary "Apply" CTA — the primary already does it.
    const allLinks = screen.getAllByRole("link");
    expect(allLinks).toHaveLength(1);
  });

  // ─── page_members_only ─────────────────────────────────────────────
  it("page_members_only: headlines with page name, not community name", () => {
    render(
      <GatePage
        gate={{
          kind: "page_members_only",
          communityName: "Café Owners",
          pageName: "Marketplace",
        }}
        returnTo="/marketplace"
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Marketplace is for members/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/join Café Owners to see Marketplace/i)).toBeInTheDocument();
  });

  // ─── entity_members_only ───────────────────────────────────────────
  it("entity_members_only event: copy uses event title + entity type 'event'", () => {
    render(
      <GatePage
        gate={{
          kind: "entity_members_only",
          communityName: "PBN",
          entityName: "Q3 Strategy Session",
          entityType: "event",
        }}
        returnTo="/events/q3-strategy"
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: /Q3 Strategy Session is for members/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/this event/i)).toBeInTheDocument();
  });

  it("entity_members_only product: copy says 'this product'", () => {
    render(
      <GatePage
        gate={{
          kind: "entity_members_only",
          communityName: "Dimmo",
          entityName: "Mentor 1:1 Pack",
          entityType: "product",
        }}
        returnTo="/marketplace/mentor-pack"
      />,
    );
    expect(screen.getByText(/this product/i)).toBeInTheDocument();
  });

  // ─── channel_members_only ──────────────────────────────────────────
  it("channel_members_only: copy uses channel name + 'read' verb", () => {
    render(
      <GatePage
        gate={{
          kind: "channel_members_only",
          communityName: "Bela Escala",
          channelName: "#leaders",
        }}
        returnTo="/feed?channel=leaders-id"
      />,
    );
    expect(
      screen.getByRole("heading", { name: /#leaders is for members/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/read #leaders/i)).toBeInTheDocument();
  });

  // ─── wrong_tier ────────────────────────────────────────────────────
  it("wrong_tier single tier: collapses to one-line summary + shows tier in list with price", () => {
    render(
      <GatePage
        gate={{
          kind: "wrong_tier",
          communityName: "Bela Escala",
          channelName: "#gold-mentorship",
          requiredTiers: [
            { id: "seg-1", name: "Gold", priceLabel: "€50/month" },
          ],
        }}
        returnTo="/feed?channel=gold-mentorship-id"
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: /#gold-mentorship is for the Gold tier/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("€50/month")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /upgrade now/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/membership?returnTo="),
    );
  });

  it("wrong_tier multiple tiers: generalises headline + renders all tiers", () => {
    render(
      <GatePage
        gate={{
          kind: "wrong_tier",
          communityName: "Bela Escala",
          channelName: "#vip",
          requiredTiers: [
            { id: "seg-1", name: "Gold", priceLabel: "€50/month" },
            { id: "seg-2", name: "Platinum", priceLabel: "€100/month" },
          ],
        }}
        returnTo="/feed?channel=vip-id"
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: /#vip is for a higher membership tier/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("Platinum")).toBeInTheDocument();
    expect(screen.getByText("€50/month")).toBeInTheDocument();
    expect(screen.getByText("€100/month")).toBeInTheDocument();
  });

  it("wrong_tier: NO 'Apply to join' secondary CTA (viewer is already a member)", () => {
    render(
      <GatePage
        gate={{
          kind: "wrong_tier",
          communityName: "Bela Escala",
          channelName: "#gold-mentorship",
          requiredTiers: [{ id: "seg-1", name: "Gold" }],
        }}
        returnTo="/feed"
      />,
    );
    expect(screen.queryByRole("link", { name: /apply to join/i })).not.toBeInTheDocument();
  });

  // ─── Optional props ────────────────────────────────────────────────
  it("renders communityLogoUrl when provided", () => {
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/"
        communityLogoUrl="https://cdn.example/pbn-logo.png"
      />,
    );
    const img = screen.getByAltText(/PBN logo/i);
    expect(img).toHaveAttribute("src", "https://cdn.example/pbn-logo.png");
  });

  it("applies brandColor to the primary CTA background", () => {
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "Bela Escala" }}
        returnTo="/"
        brandColor="#D4AF37"
      />,
    );
    const cta = screen.getByRole("link", { name: /sign in/i });
    expect(cta).toHaveStyle({ backgroundColor: "#D4AF37" });
  });

  it("honors custom signInHref / upgradeHref / applyHref overrides", () => {
    // Community-app could mount /signin instead of /login, /tiers instead
    // of /membership, etc. The component must respect overrides.
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/events/sfn-01"
        signInHref="/signin"
        applyHref="/join"
      />,
    );
    expect(
      screen.getByRole("link", { name: /^sign in$/i }),
    ).toHaveAttribute("href", "/signin?returnTo=%2Fevents%2Fsfn-01");
    expect(
      screen.getByRole("link", { name: /^apply to join$/i }),
    ).toHaveAttribute("href", "/join?returnTo=%2Fevents%2Fsfn-01");
  });

  it("returnTo with special characters is URL-encoded safely (no open-redirect surface)", () => {
    // Defense check: returnTo carries through verbatim to the FE; the
    // backend (PR-2.5) handles the actual open-redirect sanitization.
    // This component must at minimum URL-encode the value so query-string
    // injection isn't trivially possible.
    render(
      <GatePage
        gate={{ kind: "community_private", communityName: "PBN" }}
        returnTo="/events/abc?utm_source=ig&q=hello world"
      />,
    );
    const signIn = screen.getByRole("link", { name: /sign in/i });
    expect(signIn.getAttribute("href")).toContain(encodeURIComponent("/events/abc?utm_source=ig&q=hello world"));
    // No raw `&` or `?` from the returnTo bleeds through into the
    // outer query string.
    expect(signIn.getAttribute("href")).not.toContain("&utm_source");
  });
});
