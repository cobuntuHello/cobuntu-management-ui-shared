/**
 * The three seams that let ONE donations editor serve both management packages,
 * and the no-radix HelpTip that let it live here at all (T-123).
 *
 * The editor existed as byte-identical copies in cobuntu-product-management-ui
 * and cobuntu-event-management-ui, and was fixed one copy at a time — an
 * empty-modal bug reached events weeks late, and a wording bug ("variant" on an
 * event, which sells ticket tiers) shipped in both for months because the file
 * was duplicated verbatim and the noun was never localised.
 *
 * Consolidating meant naming exactly what differs between the two packages and
 * injecting only that: currency resolution, the tier noun, and the modal shell.
 * These cases pin each seam, because a seam that silently falls back to a
 * default is how the copies drift apart again.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DonationsField, DonationsSection } from "../donations";
import type { DonationDraft } from "../donations";

afterEach(() => cleanup());

const draft = (over: Partial<DonationDraft> = {}): DonationDraft => ({
  enabled: true, mode: "fixed", amounts: ["5"], minAmount: "", label: "",
  currency: "EUR", ...over,
});

const TestShell = ({ children }: { onClose: () => void; width?: string; children: React.ReactNode }) => (
  <div data-testid="shell">{children}</div>
);

describe("seam 1 — currency resolution is injected, not owned here", () => {
  it("renders whatever symbol the caller's resolver returns", () => {
    /*
     * Both packages carry their own SUPPORTED_CURRENCIES list. Pulling that
     * DATA in here would have traded one duplication for another and forced a
     * decision about which list wins; a resolver is the cheaper seam.
     */
    render(
      <DonationsSection
        donation={draft({ currency: "BRL", amounts: ["7"] })}
        onUpdate={vi.fn()} defaultCurrency="BRL"
        symbolFor={(code) => (code === "BRL" ? "R$" : code)}
        tierNoun="variant"
      />,
    );
    /*
     * getAllByText: the symbol prefixes BOTH the suggested-amount inputs and
     * the pay-what-you-want minimum. Only one branch is visible at a time, but
     * Collapse keeps the other mounted (it animates height, it does not
     * unmount), so two nodes is correct here, not a duplicate-render bug.
     */
    expect(screen.getAllByText("R$").length).toBeGreaterThan(0);
  });

  it("falls back to the caller's answer even when that is the bare code", () => {
    render(
      <DonationsSection
        donation={draft({ currency: "XYZ", amounts: ["7"] })}
        onUpdate={vi.fn()} defaultCurrency="XYZ"
        symbolFor={(code) => code}
        tierNoun="variant"
      />,
    );
    expect(screen.getAllByText("XYZ").length).toBeGreaterThan(0);
  });
});

describe("seam 2 — the tier noun is the caller's word", () => {
  /*
   * THE bug this seam exists for: an event does not sell "variants". Both
   * copies said it anyway.
   */
  it("says 'ticket tier' for events", () => {
    render(
      <DonationsSection
        donation={draft({ enabled: false })} onUpdate={vi.fn()} defaultCurrency="EUR"
        symbolFor={(c) => c} tierNoun="ticket tier"
      />,
    );
    expect(screen.getByText(/no matter which ticket tier they pick/i)).toBeInTheDocument();
    expect(screen.queryByText(/variant/i)).not.toBeInTheDocument();
  });

  it("says 'variant' for products", () => {
    render(
      <DonationsSection
        donation={draft({ enabled: false })} onUpdate={vi.fn()} defaultCurrency="EUR"
        symbolFor={(c) => c} tierNoun="variant"
      />,
    );
    expect(screen.getByText(/no matter which variant they pick/i)).toBeInTheDocument();
    expect(screen.queryByText(/ticket tier/i)).not.toBeInTheDocument();
  });
});

describe("seam 3 — the modal shell belongs to the caller", () => {
  it("opens the editor inside the shell it was handed", async () => {
    /*
     * Each package's ModalShell is a centred dialog on desktop and a bottom
     * sheet with drag-to-dismiss on mobile. THIS package's own ModalShell is a
     * different component with a different API, and using it would have quietly
     * replaced the mobile drawer on both apps.
     */
    const user = userEvent.setup();
    const Shell = vi.fn(({ children }: any) => <div data-testid="caller-shell">{children}</div>);
    render(
      <DonationsField
        donation={draft()} onUpdate={vi.fn()} defaultCurrency="EUR"
        symbolFor={(c) => c} tierNoun="variant" modalShell={Shell as any}
      />,
    );

    expect(Shell).not.toHaveBeenCalled(); // closed: the shell is never mounted
    await user.click(screen.getByRole("button", { name: /edit donation settings/i }));

    expect(screen.getByTestId("caller-shell")).toBeInTheDocument();
    expect(screen.getByText(/how buyers give/i)).toBeInTheDocument();
  });
});

describe("HelpTip — rebuilt without radix", () => {
  /*
   * The package version uses @radix-ui/react-popover. This package depends on
   * cva, clsx, lucide-react and tailwind-merge and nothing else; adding radix
   * would push it onto every consumer of shared to render one tooltip. So the
   * behaviours Radix provided are asserted here by hand.
   */
  const openSection = () =>
    render(
      <DonationsSection
        donation={draft()} onUpdate={vi.fn()} defaultCurrency="EUR"
        symbolFor={(c) => c} tierNoun="variant"
      />,
    );

  it("is closed until asked, then shows the explainer", async () => {
    const user = userEvent.setup();
    openSection();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^help:/i })[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("portals to document.body, so ModalShell's overflow cannot clip it", async () => {
    // The reason the original reached for a portal at all — not optional.
    const user = userEvent.setup();
    const { container } = openSection();
    await user.click(screen.getAllByRole("button", { name: /^help:/i })[0]);

    const tip = screen.getByRole("tooltip");
    expect(container.contains(tip)).toBe(false);
    expect(document.body.contains(tip)).toBe(true);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    openSection();
    await user.click(screen.getAllByRole("button", { name: /^help:/i })[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on scroll, because its position is a snapshot and not tracked", async () => {
    const user = userEvent.setup();
    openSection();
    await user.click(screen.getAllByRole("button", { name: /^help:/i })[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on an outside pointer-down", async () => {
    const user = userEvent.setup();
    openSection();
    await user.click(screen.getAllByRole("button", { name: /^help:/i })[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
