import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagementCopyProvider } from "../i18n";
import { GatePage } from "../ui/GatePage";
import { DiscardPrompt } from "../ui/DiscardPrompt";
import { BillingRadio } from "../ui/BillingRadio";
import { RefundPolicyField, describeRefundBand } from "../listings/RefundPolicyField";
import { tierAccessSummary } from "../lib/tierAccess";
import { resolveSubmitActions } from "../lib/submitActions";

/**
 * The components the community app renders with no copy prop now read the
 * HOST's translator, and still say exactly what they said before without one.
 *
 * A pt-PT community (Finance Social Club) saw English on the gate page, the
 * donation and refund settings, the create-flow steps and every modal's close
 * button, because these strings never went through next-intl. The host mounts
 * <ManagementCopyProvider t={...}> once; these tests pin both sides of that.
 */

const hostT = (key: string) => `PT:${key}`;
const withHost = (ui: React.ReactElement) => render(<ManagementCopyProvider t={hostT}>{ui}</ManagementCopyProvider>);
/*
 * A provider with NO host t, rather than none at all: getSharedT reads the
 * last provider rendered, so this resets it to English for the plain helpers.
 */
const withEnglish = (ui: React.ReactElement) => render(<ManagementCopyProvider>{ui}</ManagementCopyProvider>);

describe("with a host translator", () => {
  it("GatePage asks for its fully qualified keys", () => {
    withHost(<GatePage gate={{ kind: "community_private", communityName: "PBN" }} returnTo="/feed" />);
    expect(screen.getByRole("heading", { name: "PT:shared.managementUi.gatePage.privateHeadline" })).toBeInTheDocument();
    expect(screen.getAllByText("PT:shared.managementUi.gatePage.signIn").length).toBeGreaterThan(0);
    expect(screen.getByText("PT:shared.managementUi.gatePage.noAccessFootnote")).toBeInTheDocument();
  });

  it("DiscardPrompt defaults come from the host; explicit props still win", () => {
    withHost(<DiscardPrompt open onCancel={() => {}} onConfirm={() => {}} confirmLabel="Throw away" />);
    expect(screen.getByText("PT:shared.managementUi.discardPrompt.message")).toBeInTheDocument();
    expect(screen.getByText("PT:shared.managementUi.discardPrompt.cancelLabel")).toBeInTheDocument();
    expect(screen.getByText("Throw away")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PT:shared.managementUi.modalChrome.close" })).toBeInTheDocument();
  });

  it("BillingRadio's built-in options are translated", () => {
    withHost(<BillingRadio value="ONE_TIME" onChange={() => {}} />);
    expect(screen.getByText("PT:shared.managementUi.billingRadio.oneTime")).toBeInTheDocument();
    expect(screen.getByText("PT:shared.managementUi.billingRadio.legend")).toBeInTheDocument();
  });

  it("RefundPolicyField and the plain helpers read the host translator", () => {
    withHost(<RefundPolicyField value={null} onChange={() => {}} anchor="EVENT_START" />);
    expect(screen.getByText("PT:shared.managementUi.refundPolicyField.standardTitle")).toBeInTheDocument();
    expect(describeRefundBand({ days: 3, pct: 50 }, "PURCHASE")).toBe("PT:shared.managementUi.refundPolicyField.bandWithinDays");
    expect(tierAccessSummary({ mode: "public", tierIds: [] }, [])).toBe("PT:shared.managementUi.tierAccess.summaryEveryone");
  });
});

describe("without a host translator (English defaults, unchanged)", () => {
  it("GatePage", () => {
    withEnglish(<GatePage gate={{ kind: "community_private", communityName: "PBN" }} returnTo="/feed" viewerLoggedIn accessibility="OPEN" />);
    expect(screen.getByRole("heading", { name: "PBN is a private community" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to access content for members, or join instantly.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join PBN" })).toBeInTheDocument();
    expect(screen.getByText("You're seeing this because you don't have access to this content yet.")).toBeInTheDocument();
  });

  it("GatePage renders English with no provider mounted at all", () => {
    render(<GatePage gate={{ kind: "wrong_tier", communityName: "PBN", channelName: "#vip", requiredTiers: [{ id: "a", name: "Gold" }] }} returnTo="/feed" />);
    expect(screen.getByRole("heading", { name: "#vip is for the Gold tier" })).toBeInTheDocument();
    expect(screen.getByText("Upgrade now")).toBeInTheDocument();
  });

  it("DiscardPrompt and BillingRadio", () => {
    withEnglish(
      <>
        <DiscardPrompt open onCancel={() => {}} onConfirm={() => {}} />
        <BillingRadio value="ONE_TIME" onChange={() => {}} />
      </>,
    );
    expect(screen.getByText("Your edits will be lost.")).toBeInTheDocument();
    expect(screen.getByText("Keep editing")).toBeInTheDocument();
    expect(screen.getByText("Installment plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("plain helpers", () => {
    withEnglish(<span />);
    expect(describeRefundBand({ days: 1, pct: 0 }, "PURCHASE")).toBe("Within 1 day of buying: nothing back");
    expect(describeRefundBand({ days: 7, pct: 50 }, "EVENT_START")).toBe("7 or more days before: 50% back");
    expect(tierAccessSummary({ mode: "tiers", tierIds: ["a", "b"] }, [{ id: "a", name: "Gold" }, { id: "b", name: "Silver" }])).toBe("Gold and Silver");
    const labels = resolveSubmitActions({ isLeader: false, requireApproval: true } as never).map((a) => a.label);
    expect(labels[0]).toBe("Create");
  });
});
