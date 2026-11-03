"use client";

import * as React from "react";
import { useSharedT, type SharedT } from "../i18n";

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
   *  non-members can jump straight to the application form. Suppressed
   *  entirely when `accessibility` is "INVITE_ONLY" — applying is
   *  hard-blocked server-side there (assertJoinable), so the button would
   *  be a dead end. */
  applyHref?: string;
  /** The community's join method (`communities.accessibility`). Drives the
   *  secondary "self-serve" CTA on every member-gated variant: omitted →
   *  "Apply to join" (today's behaviour, unchanged); "OPEN" → relabelled
   *  "Join now" (there's no review step to "apply" into); "INVITE_ONLY" →
   *  the CTA is dropped, since /apply rejects non-invited visitors under
   *  this setting. Optional and back-compat: callers that don't pass it
   *  (admin, event-ui) keep the current "Apply to join" behaviour exactly. */
  accessibility?: "OPEN" | "APPLICATION" | "INVITE_ONLY";
  /** When true, the primary CTA on member-gated variants flips from
   *  "Sign in" to "Apply to join $community" — because /login won't help
   *  someone who's already authenticated but not a member. The login
   *  page would just bounce them; this short-circuits to the apply step. */
  viewerLoggedIn?: boolean;
  /** Optional community logo URL — rendered above the headline. */
  communityLogoUrl?: string;
  /** Optional brand color — applied to the primary CTA background. */
  brandColor?: string;
  /** Optional community background color for the gate surface. Absent → a
   *  light zinc-50 (so the admin / event-ui apps and communities without a
   *  set theme render exactly as before); set → the whole surface + text
   *  derive from the theme, so the gate matches dark communities (e.g. Bela
   *  Escala) instead of the hardcoded light look. */
  bgColor?: string;
  /** Optional community text color. Headline/subhead/secondary CTAs derive
   *  from this via currentColor + opacity. Defaults to zinc-900. */
  textColor?: string;
  /** Optional heading font for the headline. */
  headingFont?: string;
  /** Optional text color for the primary (brand-filled) CTA. Defaults to
   *  white — pass the community's button text color for brands where white
   *  is low-contrast on the fill (e.g. a light-gold brand). */
  brandTextColor?: string;
  /** Community home route — the escape hatch out of the gate (which is a
   *  full-screen takeover with no header/nav). The logo links here and a
   *  muted "Back to {community}" button renders below the CTAs. Defaults
   *  to "/hub". Without an escape the gate is a dead-end. */
  homeHref?: string;
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

function buildCopy(props: GatePageProps, t: SharedT): CopyVariant {
  const {
    gate,
    returnTo,
    signInHref = "/login",
    upgradeHref = "/membership",
    applyHref = "/apply",
    viewerLoggedIn = false,
    accessibility,
  } = props;
  const enc = (s: string) => encodeURIComponent(s);
  const signInUrl = `${signInHref}?returnTo=${enc(returnTo)}`;
  const applyUrl = `${applyHref}?returnTo=${enc(returnTo)}`;
  const upgradeUrl = `${upgradeHref}?returnTo=${enc(returnTo)}`;

  const inviteOnly = accessibility === "INVITE_ONLY";
  const open = accessibility === "OPEN";

  // For member-gated variants where viewer is logged in but not a member:
  // /login is a dead end, so primary CTA jumps to /apply — except Invite
  // Only, where /apply rejects them too (assertJoinable blocks the APPLY
  // intent server-side), so there is genuinely nothing self-serve to offer.
  // Primary CTA falls back to "Sign in", the least-wrong option left.
  const community = gate.communityName;
  const primaryAuthLabel = !viewerLoggedIn
    ? t("signIn")
    : inviteOnly
      ? t("signIn")
      : open
        ? t("joinCommunity", { community })
        : t("applyToJoinCommunity", { community });
  const primaryAuthHref = viewerLoggedIn && !inviteOnly ? applyUrl : signInUrl;

  // The secondary self-serve CTA below the primary. Invite Only has none to
  // offer — showing "Apply to join" here would be a dead end. Open relabels
  // it, since there's no review step to "apply" into.
  const secondaryCta = viewerLoggedIn || inviteOnly
    ? undefined
    : { label: open ? t("joinNow") : t("applyToJoin"), href: applyUrl };

  switch (gate.kind) {
    case "community_private":
      return {
        headline: t("privateHeadline", { community }),
        subhead: inviteOnly
          ? t("privateSubheadInviteOnly")
          : open
            ? t("privateSubheadOpen")
            : t("privateSubheadApply"),
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta,
      };
    case "page_members_only":
      return {
        headline: t("forMembersHeadline", { name: gate.pageName }),
        subhead: t("pageSubhead", { community, page: gate.pageName }),
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta,
      };
    case "entity_members_only":
      return {
        headline: t("forMembersHeadline", { name: gate.entityName }),
        subhead: t("entitySubhead", { community, entityType: gate.entityType }),
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta,
      };
    case "channel_members_only":
      return {
        headline: t("forMembersHeadline", { name: gate.channelName }),
        subhead: t("channelSubhead", { community, channel: gate.channelName }),
        primaryCtaLabel: primaryAuthLabel,
        primaryCtaHref: primaryAuthHref,
        secondaryCta,
      };
    case "wrong_tier": {
      const target = gate.channelName ?? t("thisContent");
      const tierCount = gate.requiredTiers.length;
      return {
        headline: tierCount === 1
          ? t("wrongTierHeadlineOne", { target, tier: gate.requiredTiers[0].name })
          : t("wrongTierHeadlineMany", { target }),
        subhead: tierCount === 1
          ? t("wrongTierSubheadOne", { target })
          : t("wrongTierSubheadMany", { target }),
        primaryCtaLabel: t("upgradeNow"),
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
  const { gate, communityLogoUrl, brandColor, homeHref = "/hub", bgColor, textColor, headingFont, brandTextColor } = props;
  const t = useSharedT("shared.managementUi.gatePage");
  const copy = buildCopy(props, t);
  const accent = brandColor ?? "#18181b"; // zinc-900 default

  // Theme-aware surface. When a community theme is passed, the surface bg +
  // text come from it and every muted element derives from `currentColor`
  // (opacity / color-mix) so it adapts to any brand. Absent → the previous
  // hardcoded light look (zinc-50 bg / zinc-900 text), so admin, event-ui,
  // and un-themed communities are pixel-unchanged.
  const surfaceBg = bgColor ?? "#fafafa"; // zinc-50
  const surfaceText = textColor ?? "#18181b"; // zinc-900
  const onBrand = brandTextColor ?? "#ffffff";
  const softBg = "color-mix(in srgb, currentColor 5%, transparent)";
  const softBorder = "color-mix(in srgb, currentColor 16%, transparent)";
  const softDivide = "color-mix(in srgb, currentColor 10%, transparent)";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ backgroundColor: surfaceBg, color: surfaceText }}
    >
      <div className="w-full max-w-md">
        {communityLogoUrl && (
          <a href={homeHref} className="block w-fit mx-auto mb-6" aria-label={t("backTo", { community: gate.communityName })}>
            <img
              src={communityLogoUrl}
              alt={t("logoAlt", { community: gate.communityName })}
              className="h-12 w-12 rounded-xl object-cover"
            />
          </a>
        )}
        <div className="text-center">
          <h1 className="text-[20px] font-semibold leading-tight" style={{ fontFamily: headingFont }}>
            {copy.headline}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed opacity-65">
            {copy.subhead}
          </p>
        </div>

        {copy.showTierList && gate.kind === "wrong_tier" && (
          <ul
            className="mt-5 rounded-xl overflow-hidden"
            style={{ border: `1px solid ${softBorder}`, backgroundColor: softBg }}
          >
            {gate.requiredTiers.map((tier, i) => (
              <li
                key={tier.id}
                className="flex items-center justify-between px-4 py-3"
                style={i > 0 ? { borderTop: `1px solid ${softDivide}` } : undefined}
              >
                <span className="text-[13px] font-medium">
                  {tier.name}
                </span>
                {tier.priceLabel && (
                  <span className="text-[12px] opacity-60">
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
            className="block w-full text-center px-4 py-2.5 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
            style={{ backgroundColor: accent, color: onBrand }}
          >
            {copy.primaryCtaLabel}
          </a>
          {copy.secondaryCta && (
            <a
              href={copy.secondaryCta.href}
              className="block w-full text-center px-4 py-2.5 rounded-lg text-[13px] font-medium opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {copy.secondaryCta.label}
            </a>
          )}
          {/* Escape hatch — the gate is a full-screen takeover with no
              header/nav, so without this a visitor who won't sign in/join is
              stuck. Muted (tertiary) button back to the community home. */}
          <a
            href={homeHref}
            className="block w-full text-center px-4 py-2.5 rounded-lg text-[13px] font-medium opacity-55 hover:opacity-100 transition-opacity cursor-pointer"
          >
            {t("backTo", { community: gate.communityName })}
          </a>
        </div>

        <p className="mt-6 text-center text-[11px] opacity-45">
          {t("noAccessFootnote")}
        </p>
      </div>
    </div>
  );
}
