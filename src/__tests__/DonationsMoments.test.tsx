/**
 * An event's donations: ONE setting, two moments (docs/features/event-reviews.md
 * in the backend, "Donation moments").
 *
 * Before this, the one switch silently powered both the sign-up ask and the
 * after-event ask, while every word on screen said "at checkout". These pin
 * that the editor now says WHEN, lets the host choose, never lets them save a
 * setting that asks at no moment, and offers "Connect Stripe" instead of a
 * switch when there is nowhere for the money to go.
 */

import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DonationsField, DonationsSection, resolveMoments } from "../donations";
import type { DonationDraft, DonationReceive } from "../donations";

afterEach(() => cleanup());

const draft = (over: Partial<DonationDraft> = {}): DonationDraft => ({
  enabled: true, mode: "fixed", amounts: ["5", "10"], minAmount: "", label: "", currency: "EUR", ...over,
});
const TestShell = ({ children }: { onClose: () => void; width?: string; children: React.ReactNode }) => (
  <div data-testid="shell">{children}</div>
);
const symbolFor = (c: string) => (c === "EUR" ? "€" : c);

function field(over: Partial<DonationDraft> = {}, extra: { showMoments?: boolean; receive?: DonationReceive } = { showMoments: true }) {
  const onUpdate = vi.fn();
  render(
    <DonationsField
      donation={draft(over)} onUpdate={onUpdate} defaultCurrency="EUR" symbolFor={symbolFor}
      tierNoun="ticket tier" modalShell={TestShell} {...extra}
    />,
  );
  return { onUpdate, user: userEvent.setup() };
}

function section(over: Partial<DonationDraft> = {}) {
  const onUpdate = vi.fn();
  render(
    <DonationsSection
      donation={draft(over)} onUpdate={onUpdate} defaultCurrency="EUR" symbolFor={symbolFor}
      tierNoun="ticket tier" showMoments
    />,
  );
  return { onUpdate, user: userEvent.setup() };
}

describe("resolveMoments", () => {
  it("absent or partial means ask: an older event keeps both asks", () => {
    expect(resolveMoments(undefined)).toEqual({ checkout: true, afterEvent: true });
    expect(resolveMoments({ afterEvent: false })).toEqual({ checkout: true, afterEvent: false });
  });
});

describe("the row says WHEN", () => {
  it("an event's summary leads with the moments", () => {
    field({ moments: { checkout: true, afterEvent: true } });
    expect(screen.getByText(/^At sign-up and after ·/)).toBeInTheDocument();
  });

  it("after-only and sign-up-only read differently", () => {
    field({ moments: { checkout: false, afterEvent: true } });
    expect(screen.getByText(/^After the event ·/)).toBeInTheDocument();
    cleanup();
    field({ moments: { checkout: true, afterEvent: false } });
    expect(screen.getByText(/^At sign-up ·/)).toBeInTheDocument();
  });

  it("off, an event names both moments; a product keeps its checkout wording", () => {
    field({ enabled: false });
    expect(screen.getByText(/when they sign up or after the event/i)).toBeInTheDocument();
    cleanup();
    field({ enabled: false }, {});
    expect(screen.getByText(/contribution at checkout/i)).toBeInTheDocument();
  });
});

describe("When to ask", () => {
  it("shows both moments, ticked by default", () => {
    section();
    expect(screen.getByRole("checkbox", { name: /when they sign up/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /after the event/i })).toBeChecked();
  });

  it("unticking one moment saves the choice", async () => {
    const { onUpdate, user } = section();
    await user.click(screen.getByRole("checkbox", { name: /when they sign up/i }));
    expect(onUpdate).toHaveBeenCalledWith({ moments: { checkout: false, afterEvent: true } });
  });

  it("the last ticked moment cannot be unticked: donations on must ask at some moment", () => {
    section({ moments: { checkout: false, afterEvent: true } });
    expect(screen.getByRole("checkbox", { name: /after the event/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /when they sign up/i })).not.toBeDisabled();
  });

  it("is not shown for products", () => {
    const onUpdate = vi.fn();
    render(
      <DonationsSection donation={draft()} onUpdate={onUpdate} defaultCurrency="EUR" symbolFor={symbolFor} tierNoun="variant" />,
    );
    expect(screen.queryByRole("checkbox", { name: /after the event/i })).not.toBeInTheDocument();
  });
});

describe("no Stripe, no ask", () => {
  it("offers Connect Stripe instead of a switch that would fail on save", async () => {
    const onConnect = vi.fn();
    const { user } = field({ enabled: false }, { showMoments: true, receive: { ready: false, onConnect } });
    expect(screen.queryByRole("switch", { name: /enable donations/i })).not.toBeInTheDocument();
    expect(screen.getByText(/connect stripe to accept donations/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^connect stripe$/i }));
    expect(onConnect).toHaveBeenCalled();
  });

  it("an event that already takes donations and lost Stripe says it is not asking, and can still be switched off", () => {
    field({ enabled: true }, { showMoments: true, receive: { ready: false } });
    expect(screen.getByText(/not asking: connect stripe/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /enable donations/i })).toBeInTheDocument();
  });

  it("with Stripe ready, the row is the plain switch", () => {
    field({ enabled: false }, { showMoments: true, receive: { ready: true } });
    expect(screen.getByRole("switch", { name: /enable donations/i })).toBeInTheDocument();
  });
});
