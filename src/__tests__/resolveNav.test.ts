/**
 * Tests — resolveNav, the single answer to "what is in the nav?".
 *
 * The fixtures are the real SheSapiens production shape, read from the DB on
 * 2026-09-16, because the bug that prompted this was invisible to every
 * hand-made fixture: nav.items listed five modules, four DECLARATIVE apps were
 * appended after them by the community app, and the admin could see only the
 * first half.
 */

import { describe, it, expect } from "vitest";
import {
  resolveNav,
  isPageInNav,
  neverAppearsInNav,
  appNavHref,
  NAV_RENDERS_ITSELF,
  type ResolveNavApp,
} from "../lib/resolveNav";

/** SheSapiens, verbatim: nav.items plus the twelve installed apps. */
const SHESAPIENS_NAV = ["feed", "events", "marketplace", "members", "blog"];

const app = (over: Partial<ResolveNavApp> & { key: string }): ResolveNavApp => ({
  name: over.key, rendererType: "DECLARATIVE", enabled: true, showInNav: true,
  routePrefix: null, baseUrl: null, navOrder: null, visibility: null, ...over,
});

const SHESAPIENS_APPS: ResolveNavApp[] = [
  app({ key: "ATLAS", name: "Atlas", rendererType: "NATIVE", routePrefix: "/atlas", visibility: "MEMBERS_ONLY" }),
  app({ key: "BLOG", name: "Blog", rendererType: "NATIVE", routePrefix: "/blog" }),
  app({ key: "CHAT", name: "Chat", rendererType: "NATIVE", routePrefix: "/conversations" }),
  app({ key: "EVENTS", name: "Events", rendererType: "NATIVE", routePrefix: "/events" }),
  app({ key: "FEED", name: "Feed", rendererType: "NATIVE", routePrefix: "/feed", visibility: "PUBLIC" }),
  app({ key: "MARKETPLACE", name: "Marketplace", rendererType: "NATIVE", routePrefix: "/marketplace" }),
  app({ key: "MEMBERS", name: "Members", rendererType: "NATIVE", routePrefix: "/members" }),
  app({ key: "collaborations", name: "Collaborations" }),
  app({ key: "crm", name: "CRM", rendererType: "SUBDOMAIN", baseUrl: "https://crm.example", showInNav: false }),
  app({ key: "partners", name: "Partners" }),
  app({ key: "start-here", name: "Start Here" }),
  app({ key: "whatsapp", name: "WhatsApp" }),
];

const shesapiens = () => resolveNav({ navItems: SHESAPIENS_NAV, apps: SHESAPIENS_APPS });

describe("resolveNav — the reported bug", () => {
  it("counts an auto-appended registry app as being in the nav", () => {
    // The whole report: these four render in the community sidebar while the
    // admin insisted they were not linked.
    const entries = shesapiens();
    for (const key of ["collaborations", "partners", "start-here", "whatsapp"]) {
      expect(isPageInNav(entries, key)).toBe(true);
    }
  });

  it("still reports a page that is genuinely absent", () => {
    // ATLAS is a built-in, so the nav renders it only from nav.items — and
    // SheSapiens does not list it. Its warning was correct and must survive.
    expect(isPageInNav(shesapiens(), "ATLAS")).toBe(false);
  });

  it("does not claim a back office is in the nav", () => {
    // crm is showInNav:false. Clearing its warning would be a new bug in the
    // opposite direction, which is exactly what a fix keyed on routePrefix
    // alone would have produced.
    expect(isPageInNav(shesapiens(), "crm")).toBe(false);
  });

  it("keeps nav.items order, then appends apps after it", () => {
    expect(shesapiens().map((e) => e.pageKey)).toEqual([
      "FEED", "EVENTS", "MARKETPLACE", "MEMBERS", "BLOG",
      "collaborations", "partners", "start-here", "whatsapp",
    ]);
  });
});

describe("resolveNav — hrefs", () => {
  it("serves a DECLARATIVE app from /apps/<key>", () => {
    expect(appNavHref(app({ key: "partners" }))).toBe("/apps/partners");
  });

  it("routes a SUBDOMAIN app through /launch, and nowhere without a baseUrl", () => {
    expect(appNavHref(app({ key: "crm", rendererType: "SUBDOMAIN", baseUrl: "https://x" })))
      .toBe("/apps/crm/launch");
    expect(appNavHref(app({ key: "crm", rendererType: "SUBDOMAIN", baseUrl: null }))).toBeNull();
  });

  it("gives a NATIVE app its routePrefix", () => {
    // Learning is the case: NATIVE but not built-in, so it must append.
    const entries = resolveNav({
      navItems: ["feed"],
      apps: [app({ key: "LEARNING", name: "Learning", rendererType: "NATIVE", routePrefix: "/learning" })],
    });
    expect(entries.find((e) => e.pageKey === "LEARNING")?.href).toBe("/learning");
  });
});

describe("resolveNav — the built-ins the nav renders itself", () => {
  it("never appends one, even when it is missing from nav.items", () => {
    // Otherwise every built-in absent from a hand-set nav would silently
    // reappear, and turning a page off would stop meaning anything.
    const entries = resolveNav({ navItems: ["feed"], apps: SHESAPIENS_APPS });
    expect(entries.filter((e) => e.source === "app").map((e) => e.pageKey))
      .toEqual(["collaborations", "partners", "start-here", "whatsapp"]);
  });

  it("holds CHAT out of the nav", () => {
    expect(NAV_RENDERS_ITSELF.has("CHAT")).toBe(true);
    expect(shesapiens().some((e) => e.pageKey === "CHAT")).toBe(false);
  });
});

describe("resolveNav — landing links stay out of the app", () => {
  it("marks a landing-only link as not an in-app route", () => {
    // Bela's nav. /comunidade belongs to their Lovable site and must not
    // become a /hub tile — the rule /hub used to carry as a hardcoded drop.
    const entries = resolveNav({
      navItems: [
        "feed",
        { label: "Comunidade", href: "/comunidade" },
        { label: "Aceleração", href: "/aceleracao" },
      ],
      apps: [app({ key: "partners", name: "Partners" })],
    });
    expect(entries.filter((e) => e.inAppRoute).map((e) => e.href))
      .toEqual(["/feed", "/apps/partners"]);
  });

  it("recognises a module configured as a NavLink", () => {
    // Bela configures modules as links rather than bare keys. Matching on href
    // is what keeps those in-app.
    const entries = resolveNav({ navItems: [{ label: "Eventos", href: "/events" }] });
    expect(entries[0]).toMatchObject({ pageKey: "EVENTS", inAppRoute: true, label: "Eventos" });
  });

  it("recognises an app configured as a NavLink", () => {
    const entries = resolveNav({
      navItems: [{ label: "Parceiros", href: "/apps/partners" }],
      apps: [app({ key: "partners", name: "Partners" })],
    });
    expect(entries[0]).toMatchObject({ pageKey: "partners", inAppRoute: true, source: "config" });
  });
});

describe("resolveNav — dedupe and groups", () => {
  it("lists an app once when the community also placed it by hand", () => {
    const entries = resolveNav({
      navItems: [{ label: "Parceiros", href: "/apps/partners" }, "feed"],
      apps: [app({ key: "partners", name: "Partners" })],
    });
    expect(entries.filter((e) => e.pageKey === "partners")).toHaveLength(1);
    // and keeps the hand-placed position rather than being appended at the end
    expect(entries[0].pageKey).toBe("partners");
  });

  it("flattens a group and tags its children with the group label", () => {
    const entries = resolveNav({
      navItems: [{ label: "Explore", children: ["feed", "blog"] }],
    });
    expect(entries.map((e) => [e.pageKey, e.groupLabel]))
      .toEqual([["FEED", "Explore"], ["BLOG", "Explore"]]);
  });

  it("pushes a group's gate down onto ungated children", () => {
    const entries = resolveNav({
      navItems: [{
        label: "Members area", visibleWhen: "approvedMember",
        children: ["feed", { label: "Docs", href: "/docs", visibleWhen: "authenticated" }],
      }],
    });
    // the child without its own gate inherits the group's
    expect(entries[0].visibleWhen).toBe("approvedMember");
    // one that declares its own keeps it
    expect(entries[1].visibleWhen).toBe("authenticated");
  });
});

describe("neverAppearsInNav", () => {
  it("is true for a back office", () => {
    expect(neverAppearsInNav(app({ key: "crm", showInNav: false }))).toBe(true);
  });

  it("is true for a SUBDOMAIN app with no baseUrl, which resolves to no href", () => {
    expect(neverAppearsInNav(app({ key: "x", rendererType: "SUBDOMAIN", baseUrl: null }))).toBe(true);
  });

  it("is false for an ordinary app", () => {
    expect(neverAppearsInNav(app({ key: "partners" }))).toBe(false);
  });
});

describe("resolveNav — payload tolerance", () => {
  it("shows an app whose payload omits showInNav", () => {
    // Getting this backwards hides every app from every nav, so the check is
    // `=== false`, not a truthy test.
    const entries = resolveNav({ navItems: [], apps: [{
      key: "partners", name: "Partners", rendererType: "DECLARATIVE", enabled: true,
    } as ResolveNavApp] });
    expect(isPageInNav(entries, "partners")).toBe(true);
  });

  it("skips a disabled app", () => {
    const entries = resolveNav({ navItems: [], apps: [app({ key: "partners", enabled: false })] });
    expect(entries).toHaveLength(0);
  });

  it("returns an empty list for an empty nav with no apps, not a default", () => {
    // An empty nav.items means "never arranged one" and the caller falls back
    // to its module list. Inventing the fallback here would take that choice
    // away from the surface that owns it.
    expect(resolveNav({ navItems: [], apps: [] })).toEqual([]);
  });

  it("sorts appended apps by navOrder, then name", () => {
    const entries = resolveNav({ navItems: [], apps: [
      app({ key: "z", name: "Zeta" }),
      app({ key: "a", name: "Alpha" }),
      app({ key: "first", name: "First", navOrder: 1 }),
    ] });
    expect(entries.map((e) => e.pageKey)).toEqual(["first", "a", "z"]);
  });
});
