"use client";

import * as React from "react";

import { useSharedT } from "../i18n";
import { Plus, X } from "lucide-react";
import { resolveMoments, type DonationDraft, type DonationMoments, type SymbolFor } from "./types";
import { Collapse, Eyebrow, Switch } from "./primitives";
import { PricingSectionHeading } from "../ui/PricingSectionHeading";

export interface DonationsSectionProps {
  donation: DonationDraft;
  onUpdate: (patch: Partial<DonationDraft>) => void;
  defaultCurrency: string;
  /** Currency code -> display symbol. See SymbolFor in ./types. */
  symbolFor: SymbolFor;
  /**
   * What this listing sells one of: "variant" for products, "ticket tier" for
   * events. It appears in the explainer copy.
   *
   * A prop because it is the one thing that genuinely differs between the two
   * packages - and getting it wrong is not hypothetical. Both copies of this
   * file said "variant" for months, including the events one, purely because
   * the file was duplicated verbatim and nobody localised the noun.
   */
  tierNoun: string;
  /**
   * Drop the built-in header row (icon + title + explainer + enable switch)
   * and render the settings alone, always expanded.
   *
   * For the create wizard, where DonationsField already carries the switch on
   * its row and the modal writes its own heading. Without this the dialog
   * opened with a duplicate of the row that opened it, and offered a second
   * switch for the same value.
   *
   * Defaults false, so the manage-page PriceEditModal keeps the header and the
   * inline Collapse it has always had.
   */
  hideHeader?: boolean;
  /**
   * EVENTS: show "When to ask" (at sign-up / after the event). An event's
   * donations are ONE setting with two moments; before this choice existed
   * the one switch silently powered both, while the copy only mentioned
   * checkout. Products leave it off: they have no "after".
   */
  showMoments?: boolean;
}

/**
 * Donation settings form — the BODY of the donations editor. Owned HERE, in
 * the shared package, because the two management packages previously kept
 * byte-identical copies of it and only ever fixed one at a time (T-123).
 *
 * It is bare (no outer card) so it drops cleanly into two chrome contexts:
 *   - the create wizard's DonationsField modal / mobile drawer, and
 *   - the manage-page PriceEditModal tier list (wrapped in a card there).
 *
 * A donation is an optional contribution a buyer can add at checkout, ON TOP
 * of whatever they already pay — product/event-level, identical no matter
 * which tier they pick. This is NOT the tier-level pay-what-you-want price
 * mode (that sets the price of the item itself). Two presentations:
 *   - Suggested amounts: a chip list; the buyer taps one or types their own.
 *   - Any amount: the buyer enters any amount, above an optional minimum.
 *
 * Pure controlled component — no fetch/save; the parent persists via the
 * product/event donations endpoint. Currency follows the tier currency.
 */
export function DonationsSection({
  donation, onUpdate, defaultCurrency, symbolFor, tierNoun, hideHeader = false, showMoments = false,
}: DonationsSectionProps) {
  const t = useSharedT("shared.managementUi.donations");
  const sym = symbolFor(donation.currency || defaultCurrency);
  const moments = resolveMoments(donation.moments);
  /* At least one moment stays ticked: donations switched on that never ask
     are a contradiction (the server refuses it too). The last ticked box is
     disabled rather than letting the host save a dead setting. */
  const setMoment = (key: keyof DonationMoments, value: boolean) => {
    const next = { ...moments, [key]: value };
    if (!next.checkout && !next.afterEvent) return;
    onUpdate({ moments: next });
  };
  const onlyOne = moments.checkout !== moments.afterEvent;

  /*
   * The row (approved redesign, 2026-11-16): title, state and switch level,
   * no grey box or icon tile. On, it says what buyers will see (the amounts
   * or "any amount", and the button's text) with Edit, which opens the
   * settings below. Switching on opens them straight away.
   */
  const [editing, setEditing] = React.useState(false);
  const shownAmounts = donation.amounts.map((a) => a.trim()).filter((a) => a !== "" && Number(a) > 0);
  const momentsLine = showMoments
    ? (moments.checkout && moments.afterEvent ? t("summaryMomentsBoth") : moments.checkout ? t("summaryMomentsCheckout") : t("summaryMomentsAfter"))
    : null;
  const chips: string[] = donation.mode === "fixed"
    ? shownAmounts.map((a) => `${sym}${a}`)
    : [donation.minAmount && Number(donation.minAmount) > 0 ? t("summaryAnyMin", { min: `${sym}${donation.minAmount}` }) : t("anyAmount")];
  chips.push(t("buttonChip", { label: donation.label.trim() || t("defaultButtonLabel") }));

  const addAmount = () => onUpdate({ amounts: [...donation.amounts, ""] });
  const updateAmount = (idx: number, value: string) =>
    onUpdate({ amounts: donation.amounts.map((a, i) => (i === idx ? value : a)) });
  const removeAmount = (idx: number) =>
    onUpdate({ amounts: donation.amounts.filter((_, i) => i !== idx) });

  const amountInputCls =
    "pl-7 pr-8 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div>
      {/* Enable + intro. Suppressed when the caller owns the header — see
          `hideHeader`. */}
      {!hideHeader && (
        <div className="flex items-start gap-4" data-testid="donations-row">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-zinc-900">{t("askForDonations")}</p>
            {!donation.enabled && <p className="mt-0.5 text-[12.5px] text-zinc-500">{t("off")}</p>}
            {donation.enabled && !editing && (
              <>
                {momentsLine && <p className="mt-0.5 text-[12.5px] text-zinc-500">{momentsLine}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="donations-summary">
                  {chips.map((c) => (
                    <span key={c} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-700">{c}</span>
                  ))}
                </div>
                <button type="button" onClick={() => setEditing(true)}
                  className="mt-2 text-[13px] font-semibold text-zinc-900 underline underline-offset-[3px] cursor-pointer">
                  {t("edit")}
                </button>
              </>
            )}
          </div>
          <div className="pt-0.5">
            <Switch checked={donation.enabled} onChange={(v) => { onUpdate({ enabled: v }); setEditing(v); }} label={t("enable")} />
          </div>
        </div>
      )}

      {/* With the header hidden the caller only mounts this when donations are
          already on, so the reveal has nothing left to animate — forcing it
          open avoids a collapsed-to-zero body on first paint. */}
      <Collapse open={hideHeader || (donation.enabled && editing)}>
        {/* The top margin separates the body from the header; with no header
            the caller owns that spacing, so don't add it twice. */}
        <div className={`${hideHeader ? "" : "mt-5"} space-y-5`}>
          {/* When to ask (events): the two moments, each a plain checkbox
              row saying what the attendee will see. */}
          {showMoments && (
            <div>
              <Eyebrow>{t("whenToAsk")}</Eyebrow>
              <div className="mt-1.5 space-y-1.5">
                {([
                  ["checkout", t("momentCheckout"), t("momentCheckoutHelp")],
                  ["afterEvent", t("momentAfterEvent"), t("momentAfterEventHelp")],
                ] as const).map(([key, label, help]) => {
                  const checked = moments[key];
                  const locked = checked && onlyOne;
                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                        checked ? "border-zinc-300 bg-white" : "border-zinc-200 bg-zinc-50"
                      } ${locked ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={(e) => setMoment(key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-zinc-900">{label}</span>
                        <span className="block text-[12px] text-zinc-500 leading-snug">{help}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode — segmented control */}
          <div>
            <Eyebrow>{t("howBuyersGive")}</Eyebrow>
            <div className="mt-1.5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100">
              {([["fixed", t("suggestedAmounts")], ["pwyw", t("anyAmount")]] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate({ mode: m })}
                  className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                    donation.mode === m
                      ? "bg-white text-zinc-900 font-medium shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Suggested amounts — chips */}
          <Collapse open={donation.mode === "fixed"}>
            <div>
              <Eyebrow help={t("suggestedAmountsHelp")}>{t("suggestedAmounts")}</Eyebrow>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {donation.amounts.map((a, i) => (
                  <div key={i} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-400 pointer-events-none">{sym}</span>
                    <input
                      type="number" min="0" step="0.01" value={a}
                      onChange={(e) => updateAmount(i, e.target.value)}
                      placeholder="10"
                      className={`w-[108px] ${amountInputCls}`}
                    />
                    {donation.amounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAmount(i)}
                        aria-label={t("removeAmount")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {donation.amounts.length < 8 && (
                  <button
                    type="button"
                    onClick={addAmount}
                    className="inline-flex items-center gap-1 px-3 py-2 text-[12px] font-medium text-zinc-500 border border-dashed border-zinc-300 rounded-xl hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("add")}
                  </button>
                )}
              </div>
            </div>
          </Collapse>

          {/* Any amount — optional minimum */}
          <Collapse open={donation.mode === "pwyw"}>
            <div>
              <Eyebrow help={t("minimumHelp")}>{t("minimum")}</Eyebrow>
              <div className="relative mt-1.5 max-w-[220px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-400 pointer-events-none">{sym}</span>
                <input
                  type="number" min="0" step="0.01" value={donation.minAmount}
                  onChange={(e) => onUpdate({ minAmount: e.target.value })}
                  placeholder={t("noMinimum")}
                  className={`w-full ${amountInputCls}`}
                />
              </div>
            </div>
          </Collapse>

          {/* Checkout label */}
          <div>
            <Eyebrow help={t("checkoutLabelHelp")}>{t("checkoutLabel")}</Eyebrow>
            <input
              type="text"
              value={donation.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder={t("checkoutLabelPlaceholder")}
              maxLength={100}
              className="w-full mt-1.5 px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
            />
          </div>

          {/* Back to the summary. The parent's own Save persists the changes. */}
          {!hideHeader && (
            <button type="button" onClick={() => setEditing(false)}
              className="text-[13px] font-semibold text-zinc-900 underline underline-offset-[3px] cursor-pointer">
              {t("done")}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * The Donations section's heading on an item's Pricing tab: the shared section
 * heading with the translated title and the one sentence that used to sit in
 * the row (approved redesign, 2026-11-16: say "Donations" once).
 */
export function DonationsHeading({ tierNoun, showMoments = false }: { tierNoun: string; showMoments?: boolean }) {
  const t = useSharedT("shared.managementUi.donations");
  return (
    <PricingSectionHeading
      title={t("title")}
      description={showMoments ? t("eventIntro") : t("sectionIntro", { tierNoun })}
    />
  );
}
