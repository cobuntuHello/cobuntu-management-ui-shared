/**
 * The create-flow pieces an EMBEDDED wizard needs (embed-event-wizard plan,
 * phase 2): no Next.js router in CreatedModal, host-defined steps on the rail,
 * and portals that can mount inside a host's themed wrapper.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CreatedModal } from "../create/CreatedModal";
import { CreateStepRail } from "../create/CreateStepRail";
import { ModalShell } from "../ui/ModalShell";
import { PortalContainerProvider } from "../ui/portalContainer";

afterEach(() => cleanup());

describe("CreatedModal without a framework router", () => {
  it("does not import next/navigation", () => {
    const src = readFileSync(join(__dirname, "../create/CreatedModal.tsx"), "utf8");
    expect(src).not.toMatch(/from ["']next\//);
  });

  it("hands every action to onNavigate", () => {
    const onNavigate = vi.fn();
    render(
      <CreatedModal open kind="event" outcome="pending" name="Supper club"
        viewHref="/e/1" manageHref="/e/1/manage" reviewHref="/e/1/review" createAnotherHref="/new"
        onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText("Follow the review"));
    fireEvent.click(screen.getByText("View event"));
    fireEvent.click(screen.getByText("Create another event"));
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(["/e/1/review", "/e/1", "/new"]);
  });
});

describe("CreateStepRail with host-defined steps", () => {
  it("names an appended step from extraLabels and counts it", () => {
    render(
      <CreateStepRail steps={["details", "commerce", "about-you"]} current="commerce" kind="event"
        extraLabels={{ "about-you": "About you" }} />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "Step 2 of 3");
    expect(screen.getByText("Next: About you")).toBeInTheDocument();
  });

  it("cannot rename a built-in step", () => {
    render(
      <CreateStepRail steps={["details", "commerce"]} current="details" kind="event"
        extraLabels={{ details: "Hijacked" }} />,
    );
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("Hijacked")).toBeNull();
  });
});

describe("portal container", () => {
  it("ModalShell mounts on document.body by default", () => {
    render(<ModalShell open onClose={() => {}} title="T">body</ModalShell>);
    expect(screen.getByRole("dialog").closest("body")).toBe(document.body);
    expect(screen.getByRole("dialog").parentElement?.parentElement).toBe(document.body);
  });

  it("ModalShell mounts inside the provided container", () => {
    const host = document.createElement("div");
    host.className = "themed-host";
    document.body.appendChild(host);
    render(
      <PortalContainerProvider container={host}>
        <ModalShell open onClose={() => {}} title="T">body</ModalShell>
      </PortalContainerProvider>,
    );
    expect(host.contains(screen.getByRole("dialog"))).toBe(true);
    host.remove();
  });
});
