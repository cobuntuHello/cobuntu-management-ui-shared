"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Discriminated reason for why the visitor can't see the content.
 * Each kind maps to a specific copy variant + CTA. See
 * docs/features/visibility-overrides.md §5 in the backend monorepo for
 * the product spec.
 */
export type GateReason =
  | {
      kind: "community_private";
      communityName: string;
    }
  | {
      kind: "page_members_only";
      communityName: string;
      pageName: string;
    }
  | {
      kind: "entity_members_only";
      communityName: string;
      entityName: string;
      entityType: "event" | "product";
    }
  | {
      kind: "channel_members_only";
      communityName: string;
      channelName: string;
    }
  | {
      kind: "wrong_tier";
      communityName: string;
      /** Optional — name of the channel (or other resource) being gated.
       *  When omitted, copy generalises to "this content". */
      channelName?: string;
      /** Tiers that grant access. The component renders all of them as a
       *  selectable list when there's >1; a single tier collapses to a
       *  one-line summary. */
      requiredTiers: Array<{
        id: string;
        name: string;
        /** Optional price label, e.g. "€50/month". When omitted, no price
         *  shown — link to the tiers page for full pricing. */
        priceLabel?: string;
      }>;
    };

export interface GatePageProps {
  gate: GateReason;
  /** The URL the visitor was originally trying to reach. Carried through
   *  the auth/apply/upgrade funnel via returnTo so they land back here
   *  after success. */
  returnTo: string;
  /** Override for the sign-in route (default "/login"). The login page
   *  consumes the returnTo + handles the NOT_MEMBER / APPLICATION_PENDING
   *  branches inline (CommunityAuthService error codes). */
  signInHref?: string;
  /** Override for the tier-upgrade page (default "/membership"). Receives
   *  returnTo to land back on the gated URL after successful upgrade. */
  upgradeHref?: string;
  /** Override for the application page (default "/apply"). Shown as a
   *  secondary CTA on community-private + page-members-only gates so
   *  non-members can jump straight to the application form. */
  applyHref?: string;
  /** When true, the primary CTA on member-gated variants flips from
   *  "Sign in" to "Apply to join $community" — because /login won't help
   *  someone who's already authenticated but not a member. The login
   *  page would just bounce them; this short-circuits to the apply step. */
  viewerLoggedIn?: boolean;
  /** Optional community logo URL — rendered above the headline. */
  communityLogoUrl?: string;
  /** Optional brand color — applied to the primary CTA background. */
  brandColor?: string;
}

interface CopyVariant {
  headline: string;
  subhead: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  /** Secondary CTA below the primary, for "Apply to join" alternatives.
   *  Omitted when the primary already routes through apply (wrong_tier
   *  has no secondary). */
  secondaryCta?: { label: string; href: string };
  /** True when the variant has a tier-list block between subhead + CTAs. */
  showTierList?: boolean;
}

function buildCopy(props: GatePageProps): CopyVariant {
  const {
    gate,
    returnTo,
    signInHref = "/login",
    upgradeHref = "/membership",
    applyHref = "/apply",
    viewerLoggedIn = false,
  } = props;
  const enc = (s: string) => encodeURIComponent(s);
  const signInUrl = `${signInHref}?returnTo=${enc(returnTo)}`;
  const applyUrl = `${applyHref}?returnTo=${enc(returnTo)}`;
  const upgradeUrl = `${upgradeHref}?returnTo=${enc(returnTo)}`;

  // For member-gated variants where viewer is logged in but not a member:
  // /login is a dead end, so primary CTA jumps to /apply. The login-page
  // handoff is only useful for anonymous viewers.
  const primaryAuthLabel = viewerLoggedIn
    ? `Apply to join ${gate.communityName}`
    : "Sign in";
  const primaryAuthHref = viewerLoggedIn ? applyUrl : signInUrl;

  switch (gate.kind) {
    case "community_private":
      return {
        headline: `${gate.communityName} is a private community`,
        subhead: "Sign in to access content for members, or apply to join.",
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta: viewerLoggedIn ? undefined : { label: "Apply to join", href: applyUrl },
      };
    case "page_members_only":
      return {
        headline: `${gate.pageName} is for members`,
        subhead: `Sign in or join ${gate.communityName} to see ${gate.pageName}.`,
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta: viewerLoggedIn ? undefined : { label: "Apply to join", href: applyUrl },
      };
    case "entity_members_only":
      return {
        headline: `${gate.entityName} is for members`,
        subhead: `Sign in or join ${gate.communityName} to see this ${gate.entityType}.`,
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta: viewerLoggedIn ? undefined : { label: "Apply to join", href: applyUrl },
      };
    case "channel_members_only":
      return {
        headline: `${gate.channelName} is for members`,
        subhead: `Sign in or join ${gate.communityName} to read ${gate.channelName}.`,
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta: viewerLoggedIn ? undefined : { label: "Apply to join", href: applyUrl },
      };
    case "wrong_tier": {
      const target = gate.channelName ?? "this content";
      const tierCount = gate.requiredTiers.length;
      const tierSummary = tierCount === 1
        ? `the ${gate.requiredTiers[0].name} tier`
        : "a higher membership tier";
      return {
        headline: `${target} is for ${tierSummary}`,
        subhead: tierCount === 1
          ? `Upgrade your membership to access ${target}.`
          : `Upgrade to one of the membership tiers below to access ${target}.`,
        primaryCtaLabel: "Upgrade now",
        primaryCtaHref: upgradeUrl,
        showTierList: tierCount > 0,
        // Wrong-tier viewers are already members — no apply secondary CTA.
      };
    }
  }
}

/**
 * One component for every gated-access surface in the community-app.
 *
 * The community-app middleware (PR-1.4) resolves the gate reason from
 * VisibilityService.canVisitorAccessPage + the entity-detail bypass +
 * chapter-access predicates, then renders <GatePage gate={...} />.
 *
 * The page itself MUST emit `<meta name="robots" content="noindex">`
 * via Next.js's metadata API. This component is presentation-only.
 * (The middleware sets `X-Robots-Tag: noindex` as belt-and-suspenders.)
 */
export function GatePage(props: GatePageProps) {
  const { gate, communityLogoUrl, brandColor } = props;
  const copy = buildCopy(props);
  const accent = brandColor ?? "#18181b"; // zinc-900 default

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-zinc-50">
      <div className="w-full max-w-md">
        {communityLogoUrl && (
          <img
            src={communityLogoUrl}
            alt={`${gate.communityName} logo`}
            className="mx-auto h-12 w-12 rounded-xl object-cover mb-6"
          />
        )}
        <div className="text-center">
          <h1 className="text-[20px] font-semibold text-zinc-900 leading-tight">
            {copy.headline}
          </h1>
          <p className="mt-2 text-[14px] text-zinc-600 leading-relaxed">
            {copy.subhead}
          </p>
        </div>

        {copy.showTierList && gate.kind === "wrong_tier" && (
          <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white overflow-hidden">
            {gate.requiredTiers.map((tier) => (
              <li
                key={tier.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-[13px] font-medium text-zinc-800">
                  {tier.name}
                </span>
                {tier.priceLabel && (
                  <span className="text-[12px] text-zinc-500">
                    {tier.priceLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <a
            href={copy.primaryCtaHref}
            className={cn(
              "block w-full text-center px-4 py-2.5 rounded-lg text-[13px] font-medium text-white hover:opacity-90 transition-opacity cursor-pointer",
            )}
            style={{ backgroundColor: accent }}
          >
            {copy.primaryCtaLabel}
          </a>
          {copy.secondaryCta && (
            <a
              href={copy.secondaryCta.href}
              className="block w-full text-center px-4 py-2.5 rounded-lg text-[13px] font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              {copy.secondaryCta.label}
            </a>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-400">
          You're seeing this because you don't have access to this content yet.
        </p>
      </div>
    </div>
  );
}
