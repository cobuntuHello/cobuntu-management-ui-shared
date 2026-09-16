export { ModalShell } from "./ui/ModalShell";
export type { ModalShellProps, ModalShellWidth } from "./ui/ModalShell";

export { ActionModalShell } from "./ui/ActionModalShell";
export type { ActionModalShellProps } from "./ui/ActionModalShell";

export { PeopleListModal } from "./ui/PeopleListModal";
export type {
  PeopleListModalProps, PeopleListModalCopy, PeopleListPerson,
} from "./ui/PeopleListModal";

export { PersonPickerModal } from "./ui/PersonPickerModal";
export type {
  PersonPickerModalProps, PersonPickerCopy, PersonPickerStepTwo,
  PersonPickerEmails, PersonPickerPerRecipient, PersonPickerTierStep,
} from "./ui/PersonPickerModal";

/*
 * Staging people. Exported whole because the wrappers need the same identity
 * rule the picker uses — `onConfirm` hands back Recipients, and the split into
 * user ids and addresses is what every send endpoint asks for.
 */
export {
  recipientKey, fromPerson, looksLikeEmail, parseCsvEmails,
  addRecipients, visibleSuggestions, userIdsOf, emailsOf,
  recipientsToApi, perRecipientMessages,
  parseCsvRecipientRows, matchTier, planImport, recipientsFromPlan,
  tierPlanFor, applyDefaultTier, allHaveTiers,
} from "./lib/recipients";
export type { Recipient, TierOption, ImportPlan, ImportPlanRow, ImportProblem } from "./lib/recipients";

export { searchPeople, minQueryLength } from "./lib/searchPeople";
export { fetchCommunityRoster, groupRoster, rosterRoles, UNGROUPED } from "./lib/communityRoster";
export type { RosterPerson, RosterGroup } from "./lib/communityRoster";
export type { PersonSearchResult, SearchPeopleOptions } from "./lib/searchPeople";

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
 * Topics, exported whole for the same reason as the row helpers below: an app
 * that wants to render the feed on its own (a notification deck, a digest)
 * must not have to reimplement the handshake to do it.
 */
export { Topics, type Topic, type TopicComment } from "./listings/ui/Topics";

/*
 * The Overview tab: how a product or event is doing, and whether it can be sold
 * at all. Presentational — the host fetches /overview and passes `stats`, which
 * keeps one component serving two domains and two apps.
 */
export { ManageOverview, type ManageOverviewProps } from "./overview/ManageOverview";
export type { OverviewStats, OverviewListing, OverviewMoney, OverviewExtras, EventExtras } from "./overview/types";
export {
  conversion, delta, recentWindows, daysUntil, isSellable, hasUnattributedViews,
  formatMoney, formatCount,
} from "./overview/format";
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
  reviewerListingActions,
  type ListingActor,
  type OwnerListingAction,
  type ReviewerListingAction,
} from "./listings/listingTransitions";

/*
 * The negotiation MVP's design layer.
 *
 * `~/Desktop/dev/cobuntu-negotiation-mvp` is the agreed design for the listing
 * review page — a runnable app, not a mockup — and this is the first slice of
 * it: the palette and the primitives neither app already had.
 *
 * Deliberately NOT exported: buttons, inputs, selects, switches. The MVP used
 * the admin's own copies of those, so porting them back would be a round trip.
 */
export { LISTING_TOKENS, listingTokenStyle } from "./listings/ui/tokens";
export { DealSpine } from "./listings/ui/DealSpine";
export { NextAction } from "./listings/ui/NextAction";
export {
  Card,
  ColumnHeader,
  Eyebrow,
  Field,
  Pill,
  Segmented,
  Who,
  inputCls,
} from "./listings/ui/primitives";

/* The manage page's Ledger tab: every money movement for one item. */
export { ManageLedger } from "./ledger/ManageLedger";
export type { ItemLedger, LedgerMovement } from "./ledger/types";
export { EmptyState, LedgerIcon, ShelfIcon } from "./overview/EmptyState";
/*
 * TOPIC_LIMITS only. The panel's TextField/TextArea are NOT exported: this
 * package already has a `TextField` in ui/, and adding a second under the same
 * name broke the barrel outright. They are internal to the listings panel,
 * which is where they should have stayed.
 */
export { TOPIC_LIMITS } from "./listings/ui/topicLimits";
export { LAYERS, type LayerName } from "./ui/layers";

/*
 * Unsplash. The three stock-photo pickers each held their own copy of the
 * request shapes, the attribution links and (in no copy at all) the download
 * ping. Attribution is a condition of using the API, so it cannot live in
 * three places and drift.
 */
export {
  UNSPLASH_APP_NAME,
  UNSPLASH_DOWNLOAD_PATH,
  UNSPLASH_PHOTOS_PATH,
  UNSPLASH_URL,
  fetchStockPhotos,
  notifyDownload,
  photographerUrl,
  photosRequestUrl,
  withReferral,
  type StockPhotoRequestOptions,
  type StockPhotoResult,
  type UnsplashPhoto,
} from "./lib/unsplash";

/*
 * Create-wizard scaffold — the shared brain and chrome behind both apps'
 * product/event create flows. The step ENGINE (which steps exist, where Next
 * goes, where a draft reopens), the progress rail + animated panes + themed
 * buttons, the community-access step, and the completion modal. Each app keeps
 * only a thin orchestrator (routing, auth, i18n, drafts) around these.
 */
export {
  resolveCreateSteps,
  isFinalStep,
  nextStep,
  previousStep,
  clampStep,
  resumeStep,
  stepHeaderKeys,
} from "./create/createWizard";
export type { CreateStepId, CreateStepsInput } from "./create/createWizard";

export { CreateStepRail, StepPane, StepTransition, WizardButton, stepLabel } from "./create/CreateStepRail";

export { ListingAccessStep } from "./create/ListingAccessStep";
export type { ListingAccessStepProps } from "./create/ListingAccessStep";

export { resolveCreateOutcome, primaryDestination, outcomeCopyKey } from "./create/createOutcome";
export type { CreateOutcome, ResolveOutcomeInput } from "./create/createOutcome";

export { CreatedModal } from "./create/CreatedModal";
export type { CreatedModalProps } from "./create/CreatedModal";

/*
 * Navigation resolution. One answer to "what is in the nav?", shared by the
 * community app's surfaces and the admin's Access screen, which used to answer
 * it four separate ways and drift. See src/lib/resolveNav.ts.
 */
export {
  resolveNav, isPageInNav, neverAppearsInNav, appNavHref,
  BUILT_IN_MODULES, NAV_RENDERS_ITSELF,
} from "./lib/resolveNav";
export type {
  ResolveNavInput, ResolvedNavEntry, ResolveNavApp, ResolveNavEntry,
  ResolveNavLink, ResolveNavGroup, NavVisibility,
} from "./lib/resolveNav";
