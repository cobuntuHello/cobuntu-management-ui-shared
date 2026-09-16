/**
 * ONE ANSWER TO "WHAT IS IN THE NAV?"
 *
 * Four places used to answer this independently: the community app's
 * DesktopHeader (inline), lib/nav-build.ts (sidebar), lib/hub-tiles.ts (mobile
 * /hub), and the admin's Access & Structure screen. They were held in agreement
 * by comments asking the next person to keep them in sync, and they drifted
 * every time, silently:
 *
 *   - dddimo set Events to Public and it stayed invisible for six days, because
 *     a non-empty nav.items was treated as the whole nav.
 *   - Learning fell through a `rendererType !== "NATIVE"` test and was reachable
 *     only by typing the URL.
 *   - /hub dropped every registry app, because its walker only knew the seven
 *     built-in modules.
 *   - The admin warned "Public, but not linked in your navigation" for pages
 *     that were sitting in the navigation, because it only knew those same
 *     seven and could not see the auto-appended ones.
 *
 * Each was a real incident and none of them failed loudly. So the rule lives
 * here once, and the surfaces read it instead of restating it.
 *
 * STRUCTURAL, NOT VIEWER-SPECIFIC. This returns what the navigation CONTAINS,
 * with each entry carrying the gates that apply to it. It deliberately does not
 * take a viewer: the admin asks "is this page linked at all", a question with no
 * viewer in it, and a members-only page is still linked. Renderers apply
 * `visibleWhen` / `appVisibility` themselves.
 */

/** Per-nav-item auth gate, mirrored from the community app's NavVisibility. */
export type NavVisibility = "always" | "authenticated" | "approvedMember";

export interface ResolveNavLink {
  label: string;
  href: string;
  external?: boolean;
  target?: "_blank" | "_self";
  iconKey?: string;
  visibleWhen?: NavVisibility;
}

export interface ResolveNavGroup {
  label: string;
  iconKey?: string;
  children: (string | ResolveNavLink)[];
  visibleWhen?: NavVisibility;
}

/** A `storefrontConfig.nav.items` entry: module key, link, or group. */
export type ResolveNavEntry = string | ResolveNavLink | ResolveNavGroup;

/** The subset of the community payload's `apps[]` this needs. */
export interface ResolveNavApp {
  key: string;
  name: string;
  iconKey?: string | null;
  rendererType: "NATIVE" | "DECLARATIVE" | "SUBDOMAIN" | string;
  baseUrl?: string | null;
  routePrefix?: string | null;
  enabled: boolean;
  visibility?: "PUBLIC" | "MEMBERS_ONLY" | null;
  navOrder?: number | null;
  /** Back offices set this false. Absent means true: an older payload that
   *  omits the field must show its apps, never hide all of them. */
  showInNav?: boolean;
}

export interface ResolvedNavEntry {
  /** Registry app key ("collaborations") or built-in module key ("FEED").
   *  Null for a landing-only link, which maps to no page. */
  pageKey: string | null;
  href: string;
  label: string;
  /** "config" = listed in nav.items. "app" = auto-appended from the registry. */
  source: "config" | "app";
  /** Does this href resolve to a route the community app itself serves?
   *  False for landing-only links such as Bela's /comunidade. The mobile /hub
   *  filters on this instead of carrying a hardcoded exclusion list. */
  inAppRoute: boolean;
  external: boolean;
  /** Gate declared on the nav item itself. */
  visibleWhen: NavVisibility;
  /** Page-level visibility, for appended apps. Null for config entries, whose
   *  page gate is resolved by the caller from pageSettings. */
  appVisibility: "PUBLIC" | "MEMBERS_ONLY" | null;
  iconKey: string | null;
  /** Label of the NavGroup this came from, when it came from inside one. */
  groupLabel: string | null;
}

/**
 * The seven built-in modules, keyed as they appear in `nav.items`.
 *
 * `pageKey` is the registry key for the same feature, uppercase, so a caller
 * holding a page row can match it. "home" is the community root and owns no
 * page, hence null.
 */
export const BUILT_IN_MODULES: Record<string, { pageKey: string | null; href: string }> = {
  home: { pageKey: null, href: "/" },
  feed: { pageKey: "FEED", href: "/feed" },
  events: { pageKey: "EVENTS", href: "/events" },
  marketplace: { pageKey: "MARKETPLACE", href: "/marketplace" },
  members: { pageKey: "MEMBERS", href: "/members" },
  blog: { pageKey: "BLOG", href: "/blog" },
  atlas: { pageKey: "ATLAS", href: "/atlas" },
};

/**
 * App keys the nav already renders through its own module list.
 *
 * FEED / MEMBERS / ATLAS / BLOG / EVENTS / MARKETPLACE are module entries. CHAT
 * is not, but is surfaced by the shell's own messaging affordance rather than as
 * a nav link, and listing it here preserves exactly what the original
 * rendererType test did for it.
 *
 * An explicit list, not a predicate. `rendererType !== "NATIVE"` stood in for
 * this once and was right only until an eighth NATIVE app existed: Learning
 * renders from our own components, so its row is NATIVE, and it was excluded
 * here as a built-in while being absent from the module list because it is not
 * one. A predicate that stands in for a list fails silently when the list moves.
 */
export const NAV_RENDERS_ITSELF = new Set([
  "FEED", "MEMBERS", "ATLAS", "BLOG", "EVENTS", "MARKETPLACE", "CHAT",
]);

/**
 * Where an installed app lives.
 *
 * DECLARATIVE and SUBDOMAIN apps are served under /apps/<key>; a SUBDOMAIN app
 * goes through /launch, which mints a single-use handoff code. NATIVE apps own a
 * real route, which is why Learning resolves and the built-ins would too.
 */
export function appNavHref(app: ResolveNavApp): string | null {
  if (app.rendererType === "DECLARATIVE") return `/apps/${app.key}`;
  if (app.rendererType === "SUBDOMAIN") return app.baseUrl ? `/apps/${app.key}/launch` : null;
  return app.routePrefix ?? null;
}

/**
 * True when an app can never be a nav item, however it is configured.
 *
 * A back office (`showInNav: false`) is the case: installing it is not optional,
 * because the handoff mint requires an install, but every member would otherwise
 * get a link to a staff tool telling them they have no role. Callers use this to
 * offer the right affordance — "add to nav" is not it.
 */
export function neverAppearsInNav(app: ResolveNavApp): boolean {
  return app.showInNav === false || appNavHref(app) === null;
}

/** Apps the nav appends after whatever the community configured, in order. */
function appendableApps(apps: ResolveNavApp[]): ResolveNavApp[] {
  return apps
    .filter((a) => a.enabled && !NAV_RENDERS_ITSELF.has(a.key) && a.showInNav !== false)
    .slice()
    // navOrder first, then name, so a community that never reorders anything
    // still gets a stable list rather than whatever the API returned.
    .sort((x, y) => {
      const ax = x.navOrder ?? Number.MAX_SAFE_INTEGER;
      const ay = y.navOrder ?? Number.MAX_SAFE_INTEGER;
      return ax !== ay ? ax - ay : x.name.localeCompare(y.name);
    });
}

function isGroup(e: ResolveNavEntry): e is ResolveNavGroup {
  return typeof e === "object" && e !== null && Array.isArray((e as ResolveNavGroup).children);
}

function isLink(e: ResolveNavEntry): e is ResolveNavLink {
  return typeof e === "object" && e !== null && typeof (e as ResolveNavLink).href === "string";
}

export interface ResolveNavInput {
  /** `storefrontConfig.nav.items`. Empty or absent means the module default. */
  navItems?: readonly ResolveNavEntry[] | null;
  /** The community payload's `apps[]`. */
  apps?: readonly ResolveNavApp[] | null;
  /** `storefrontConfig.navLabels`, overriding a module's default label. */
  navLabels?: Record<string, string> | null;
  /** Labels for the built-ins when no override exists. */
  moduleLabels?: Record<string, string> | null;
}

const DEFAULT_MODULE_LABELS: Record<string, string> = {
  home: "Home", feed: "Feed", events: "Events", marketplace: "Marketplace",
  members: "Members", blog: "Blog", atlas: "Atlas",
};

/**
 * Resolve the community's navigation: the configured entries, then the
 * installed apps the nav appends after them.
 *
 * An empty `nav.items` is NOT an empty nav — it means the community never
 * arranged one, and the caller falls back to its default module list. That
 * distinction is why `configuredCount` is reported separately.
 */
export function resolveNav(input: ResolveNavInput): ResolvedNavEntry[] {
  const navItems = input.navItems ?? [];
  const apps = (input.apps ?? []) as ResolveNavApp[];
  const labels = { ...DEFAULT_MODULE_LABELS, ...(input.moduleLabels ?? {}) };
  const overrides = input.navLabels ?? {};

  // Every href an app owns, so a configured NavLink pointing at one is
  // recognised as an in-app route rather than a landing link. Bela configures
  // modules as NavLinks, so matching on href is the only way to tell the two
  // apart.
  const appHrefByHref = new Map<string, ResolveNavApp>();
  for (const a of apps) {
    const href = appNavHref(a);
    if (href) appHrefByHref.set(href, a);
  }
  const moduleByHref = new Map<string, { key: string; pageKey: string | null }>();
  for (const [key, m] of Object.entries(BUILT_IN_MODULES)) {
    moduleByHref.set(m.href, { key, pageKey: m.pageKey });
  }

  const out: ResolvedNavEntry[] = [];

  const fromChild = (entry: string | ResolveNavLink, groupLabel: string | null): ResolvedNavEntry | null => {
    if (typeof entry === "string") {
      const mod = BUILT_IN_MODULES[entry];
      if (!mod) return null;
      return {
        pageKey: mod.pageKey,
        href: mod.href,
        label: overrides[entry] || labels[entry] || entry,
        source: "config",
        inAppRoute: true,
        external: false,
        visibleWhen: "always",
        appVisibility: null,
        iconKey: null,
        groupLabel,
      };
    }
    if (!isLink(entry)) return null;
    const mod = moduleByHref.get(entry.href);
    const app = appHrefByHref.get(entry.href);
    return {
      pageKey: mod ? mod.pageKey : (app ? app.key : null),
      href: entry.href,
      label: entry.label,
      source: "config",
      inAppRoute: Boolean(mod || app),
      external: Boolean(entry.external),
      visibleWhen: entry.visibleWhen ?? "always",
      appVisibility: app?.visibility ?? null,
      iconKey: entry.iconKey ?? null,
      groupLabel,
    };
  };

  for (const entry of navItems) {
    if (isGroup(entry)) {
      for (const child of entry.children) {
        const resolved = fromChild(child, entry.label);
        if (!resolved) continue;
        // A group's own gate is the floor for its children: hiding the group
        // hides everything inside it.
        if (entry.visibleWhen && entry.visibleWhen !== "always" && resolved.visibleWhen === "always") {
          resolved.visibleWhen = entry.visibleWhen;
        }
        out.push(resolved);
      }
      continue;
    }
    const resolved = fromChild(entry as string | ResolveNavLink, null);
    if (resolved) out.push(resolved);
  }

  // Installed apps, appended after whatever the community configured. Deduped
  // by href so an app the community also listed by hand appears once, keeping
  // the position it was given.
  const seen = new Set(out.map((e) => e.href));
  for (const app of appendableApps(apps)) {
    const href = appNavHref(app);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push({
      pageKey: app.key,
      href,
      label: app.name,
      source: "app",
      inAppRoute: true,
      external: app.rendererType === "SUBDOMAIN",
      visibleWhen: "always",
      appVisibility: app.visibility ?? null,
      iconKey: app.iconKey ?? null,
      groupLabel: null,
    });
  }

  return out;
}

/**
 * Is this page reachable from the navigation?
 *
 * The question the admin's Access screen asks. It covers both halves: listed in
 * nav.items, or appended from the registry. Asking only the first half is what
 * made it warn about pages that were plainly in the nav.
 */
export function isPageInNav(entries: readonly ResolvedNavEntry[], pageKey: string): boolean {
  return entries.some((e) => e.pageKey === pageKey);
}
