"use client";

import * as React from "react";

/**
 * Where portalled layers (modals, sheets, tooltips) mount.
 *
 * Everything that portals used to hard-code `document.body`. That is right for
 * the apps, whose theme variables sit on <html> and so reach a node appended to
 * body. It is wrong for a component embedded in someone else's page: the host
 * scopes its branding (the CSS variables) to a wrapper, and a modal appended to
 * body escapes that wrapper and renders unbranded.
 *
 * A provider lets such a host point the portals at a node INSIDE its themed
 * wrapper. With no provider the answer is `document.body`, so every existing
 * consumer renders exactly as before.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  /** The element portals mount into; null falls back to document.body. */
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

/** The provided container, or null when none is set (then use document.body). */
export function usePortalContainer(): HTMLElement | null {
  return React.useContext(PortalContainerContext);
}

/** The element to portal into right now: the provided one, else document.body. */
export function usePortalTarget(): HTMLElement | null {
  const container = usePortalContainer();
  if (typeof document === "undefined") return null;
  return container ?? document.body;
}
