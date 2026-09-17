/**
 * The donations editor, owned here so the management packages stop keeping
 * byte-identical copies of it (T-123).
 *
 * The packages inject three things rather than this module assuming them:
 * `symbolFor` (currency data stays in the packages), `tierNoun` ("variant" vs
 * "ticket tier"), and `modalShell` (each package's own responsive drawer).
 * Those are precisely the three things that differ; everything else is shared.
 */
export { DonationsField } from "./DonationsField";
export type { DonationsFieldProps, DonationsModalShell } from "./DonationsField";
export { DonationsSection } from "./DonationsSection";
export type { DonationsSectionProps } from "./DonationsSection";
export type { DonationDraft, SymbolFor } from "./types";
