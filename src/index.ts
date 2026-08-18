export { ModalShell } from "./ui/ModalShell";
export type { ModalShellProps, ModalShellWidth } from "./ui/ModalShell";

export { TextField } from "./ui/TextField";
export type { TextFieldProps } from "./ui/TextField";

export { NumberField } from "./ui/NumberField";
export type { NumberFieldProps } from "./ui/NumberField";

export { SectionCard } from "./ui/SectionCard";
export type { SectionCardProps } from "./ui/SectionCard";

export { WizardProgress } from "./ui/WizardProgress";
export type { WizardProgressProps, WizardStep } from "./ui/WizardProgress";

export { DiscardPrompt } from "./ui/DiscardPrompt";
export type { DiscardPromptProps } from "./ui/DiscardPrompt";

export { BillingRadio } from "./ui/BillingRadio";
export type { BillingRadioProps, BillingMode, BillingOption } from "./ui/BillingRadio";

export { DiscountModeRadio } from "./ui/DiscountModeRadio";
export type {
  DiscountModeRadioProps,
  DiscountMode,
  DiscountOption,
} from "./ui/DiscountModeRadio";

export { GatePage } from "./ui/GatePage";
export type { GatePageProps, GateReason } from "./ui/GatePage";

export { cn } from "./lib/cn";

export { resolveSubmitActions, willAutoApprove } from "./lib/submitActions";
export { fitWithin, drawFitted, MAX_IMAGE_EDGE, IMAGE_QUALITY, type Sized } from "./lib/image";
export type {
  SubmitAction,
  SubmitActionKind,
  SubmitActionsInput,
  MemberFeeModel,
} from "./lib/submitActions";

export { MembershipTierPicker } from "./ui/MembershipTierPicker";
export type { MembershipTierPickerProps, MembershipTier } from "./ui/MembershipTierPicker";
export {
  toTierAccessValue,
  fromTierAccessValue,
  tierRowsLocked,
  tierRowsImplied,
  tierIsIncluded,
  toggleTier,
  tierAccessSummary,
  ceilingFor,
  clampToCeiling,
  tierAccessConsequence,
} from "./lib/tierAccess";
export type { TierAccessMode, TierAccessValue, Visibility, TierAccessCeiling } from "./lib/tierAccess";

export { fetchMembershipTiers } from "./lib/fetchMembershipTiers";
export type { MembershipTierOption } from "./lib/fetchMembershipTiers";

export { PackagePicker } from "./ui/PackagePicker";
export type { PackagePickerProps, CommissionPackage } from "./ui/PackagePicker";

export { PackageNegotiation } from "./ui/PackageNegotiation";
export type {
  PackageNegotiationProps,
  PendingProposal,
  NegotiationRole,
} from "./ui/PackageNegotiation";

export { BannerPlaceholder, bannerPlaceholderGradient, bannerPlaceholderHash } from "./ui/BannerPlaceholder";
export type { BannerPlaceholderProps } from "./ui/BannerPlaceholder";

/*
 * The listing review panel, shared.
 *
 * It lived in the community app, and the admin showed a small modal of its own
 * instead — two screens for the same decision, drifting apart. This is the one
 * both apps mount: the seller sees it for their own request, a leader sees it
 * for the request they are reviewing, and neither can gain a feature the other
 * silently lacks.
 */
export { ManagedListingDetail, type ListingDetailConfig } from "./listings/ManagedListingDetail";
export { LISTING_DETAIL_COPY, defaultTranslate } from "./listings/copy";
/*
 * The WHOLE surface of both modules, not the subset this panel happens to use.
 *
 * The first pass exported only what ManagedListingDetail imported, and the
 * consuming app promptly failed to compile: the Listings tab and the profile
 * catalog use the row helpers too. A moved module has to arrive whole, or the
 * app keeps a local copy of the rest and the split this move exists to end
 * quietly reopens.
 */
export {
  isClosedState,
  isMemberOwned,
  normalizeListingState,
  requestableCommunities,
  sortManageListingRows,
  toManageListingRow,
  toManageListingRows,
  toRate,
  type ListingState,
  type ManageListingRow,
  type RequestableCommunity,
} from "./listings/manageListingRows";
export {
  ALL_STATES,
  TERMINAL,
  availableTransitions,
  isAwaitingReview,
  isTransitionAllowed,
  ownerListingActions,
  type ListingActor,
  type OwnerListingAction,
} from "./listings/listingTransitions";
