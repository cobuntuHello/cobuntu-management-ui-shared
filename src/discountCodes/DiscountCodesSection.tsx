"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, TriangleAlert } from "lucide-react";
import { useSharedT } from "../i18n";
import { cn } from "../lib/cn";
import { ModalShell } from "../ui/ModalShell";
import { PricingSectionHeading } from "../ui/PricingSectionHeading";
import { discountCodesApi, DiscountCodeApiError, type DiscountCodesEndpoint } from "./api";
import { CODE_PATTERN, dateInputToIso, discountLabel, lastValidDay, minorUnits, money, optionsSummary, shortDate, suggestCode, toLocalDateInput, usesLabel } from "./format";
import type { DiscountCode, DiscountCodeDraft, DiscountCodeMode, DiscountPreview, DiscountTierOption } from "./types";

/**
 * The "Discount codes" card on an item's Pricing tab, and its editor
 * (backend docs/features/discount-codes.md, Phase 3; the approved design is
 * discount-codes-screens-v2.html, screens 1-4).
 *
 * The card fetches its own codes from the core routes, so a host mounts it with
 * the endpoint it already knows (apiBaseUrl, community, item) and nothing else.
 * Codes are off outside the rollout: the list then answers 404 and the card
 * renders nothing, so a host never has to know where codes are switched on.
 *
 * The editor asks two things (the code, and how much off) and shows, live, what
 * every buyer will pay, from the backend's own preview (the same maths the
 * checkout charges). Everything optional folds into one row that shows its
 * defaults. A price that ends free, below the minimum or half off or more gets
 * an amber badge on its row, one sentence, and one tick: the server refuses to
 * save it without `confirm: true`, which the tick sends.
 */
export function DiscountCodesSection({
  endpoint,
  itemName,
  tiers,
  currency = "EUR",
  onCopied,
  tierNoun = "ticket",
}: {
  endpoint: DiscountCodesEndpoint;
  /** For the suggested code ("SUMMER20"). */
  itemName: string;
  /** The item's tickets or variants, for "Tickets" in the editor. Empty for a product without tiers. */
  tiers: DiscountTierOption[];
  /** The item's currency, for an amount off. */
  currency?: string;
  /** The host shows its own toast. */
  onCopied?: (code: string) => void;
  /** "variant" on products and courses, "ticket" (default) on events. */
  tierNoun?: "ticket" | "variant";
}) {
  const t = useSharedT("shared.managementUi.discountCodes");
  const [codes, setCodes] = React.useState<DiscountCode[] | null>(null);
  const [hidden, setHidden] = React.useState(false);
  const [editing, setEditing] = React.useState<DiscountCode | "new" | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const reload = React.useCallback(async () => {
    try {
      setCodes(await discountCodesApi.list(endpoint));
      setLoadError(false);
    } catch (e) {
      if (e instanceof DiscountCodeApiError && (e.status === 404 || e.status === 403)) setHidden(true);
      else setLoadError(true);
    }
  }, [endpoint.apiBaseUrl, endpoint.communityTag, endpoint.item.kind, endpoint.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { void reload(); }, [reload]);

  if (hidden) return null;

  return (
    <section data-testid="discount-codes">
      {/* The same heading as every other Pricing section (approved redesign, 2026-11-16). */}
      <PricingSectionHeading
        title={t("title")}
        description={t("emptyBody")}
        action={codes && codes.length > 0 ? (
          <button type="button" className="text-[13px] font-semibold" onClick={() => setEditing("new")}>{t("new")}</button>
        ) : undefined}
      />

      {loadError && <p className="text-[13px] opacity-70">{t("loadFailed")}</p>}

      {codes && codes.length === 0 && (
        <div className="rounded-2xl border border-dashed px-4 py-5 text-center" style={{ borderColor: "rgba(128,128,128,.35)" }}>
          {/* The heading already says what codes do: the empty state only says there are none. */}
          <p className="mb-3 font-semibold">{t("noCodes")}</p>
          <button type="button" onClick={() => setEditing("new")}
            className="h-8 rounded-[var(--radius-button,10px)] px-3 text-[12.5px] font-semibold text-white"
            style={{ background: "var(--brand-color, #18181b)" }}>
            {t("create")}
          </button>
        </div>
      )}

      {codes && codes.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(128,128,128,.22)" }}>
          {codes.map((c, i) => (
            <li key={c.id} className={cn(i > 0 && "border-t")} style={{ borderColor: "rgba(128,128,128,.18)" }}>
              <button type="button" className="flex w-full items-center gap-3 px-3.5 py-3 text-left" onClick={() => setEditing(c)}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.isActive ? "#16a34a" : "rgba(128,128,128,.45)" }}
                  aria-label={c.isActive ? t("on") : t("paused")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("font-mono font-semibold tracking-wide", !c.isActive && "opacity-50")}>{c.code}</span>
                    <span className="text-[12px] tabular-nums opacity-60">{c.isActive ? usesLabel(c, t) : t("paused")}</span>
                  </span>
                  <span className="block text-[12px] opacity-60">
                    {[discountLabel(c, t), c.lowestPrice && t(c.lowestPrice.audience === "MEMBERS" ? "membersFrom" : "from", { amount: money(c.lowestPrice.amount, c.lowestPrice.currency) }),
                      c.endsAt && t("untilDate", { date: shortDate(lastValidDay(c.endsAt)) })]
                      .filter(Boolean).join(" · ")}
                  </span>
                  {c.isActive && c.maxRedemptions != null && (
                    <span className="mt-1.5 block h-1 overflow-hidden rounded" style={{ background: "rgba(128,128,128,.14)" }}>
                      <span className="block h-full" style={{ width: `${Math.min(100, ((c.uses.used + c.uses.held) / c.maxRedemptions) * 100)}%`, background: "var(--text-color, #18181b)" }} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {codes && codes.length > 0 && <p className="mt-2 text-[12px] opacity-55">{t("listHint")}</p>}

      {editing && (
        <DiscountCodeEditor
          endpoint={endpoint}
          existing={editing === "new" ? null : editing}
          itemName={itemName}
          tiers={tiers}
          currency={currency}
          tierNoun={tierNoun}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
          onCopied={onCopied}
        />
      )}
    </section>
  );
}

const PRESETS = [10, 15, 20, 25];

/** Refusals with their own sentence; anything else reads "could not be saved". */
const KNOWN_ERRORS = new Set(["CODE_TAKEN", "CONFIRM_WARNINGS", "CODE_IN_USE", "CODE_ARCHIVED", "MIXED_CURRENCY", "NOTHING_TO_DISCOUNT", "AMOUNT_ABOVE_PRICE"]);

function initialDraft(existing: DiscountCode | null, itemName: string): DiscountCodeDraft {
  if (existing) {
    return {
      code: existing.code, mode: existing.mode, value: existing.value, tierIds: existing.tierIds,
      startsAt: existing.startsAt, endsAt: existing.endsAt, maxRedemptions: existing.maxRedemptions, perBuyerLimit: existing.perBuyerLimit,
    };
  }
  return { code: suggestCode(itemName, 20), mode: "PERCENT_OFF", value: 20, tierIds: [], startsAt: null, endsAt: null, maxRedemptions: null, perBuyerLimit: null };
}

export function DiscountCodeEditor({
  endpoint, existing, itemName, tiers, currency, onClose, onSaved, onCopied, tierNoun = "ticket",
}: {
  endpoint: DiscountCodesEndpoint;
  existing: DiscountCode | null;
  /** "variant" on products and courses, "ticket" on events: the fold row's and the list's noun. */
  tierNoun?: "ticket" | "variant";
  itemName: string;
  tiers: DiscountTierOption[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
  onCopied?: (code: string) => void;
}) {
  const t = useSharedT("shared.managementUi.discountCodes");
  const [draft, setDraft] = React.useState<DiscountCodeDraft>(() => initialDraft(existing, itemName));
  const [customPercent, setCustomPercent] = React.useState(() => existing?.mode === "PERCENT_OFF" && !PRESETS.includes(existing.value));
  const [preview, setPreview] = React.useState<DiscountPreview | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const [previewPending, setPreviewPending] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const usedAlready = !!existing && existing.uses.used + existing.uses.held > 0;

  const set = (patch: Partial<DiscountCodeDraft>) => { setDraft((d) => ({ ...d, ...patch })); setChecked(false); setError(null); };

  /*
   * The live preview: the backend's own maths, debounced while the seller types.
   * An answer for terms the seller has since changed is dropped (`live`), and
   * saving waits for the answer for the terms on screen: the warnings and the
   * tick belong to THOSE terms (Phase 3 review). A failed preview blocks saving
   * too, rather than saving without the warnings it would have shown.
   */
  React.useEffect(() => {
    let live = true;
    if (!(draft.value > 0)) { setPreview(null); setPreviewPending(false); return; }
    setPreviewPending(true);
    const timer = setTimeout(() => {
      discountCodesApi.preview(endpoint, { mode: draft.mode, value: draft.value, tierIds: draft.tierIds })
        .then((p) => { if (live) { setPreview(p); setPreviewPending(false); } })
        .catch(() => { if (live) { setPreview(null); setPreviewPending(false); } });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [draft.mode, draft.value, draft.tierIds.join(","), endpoint.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * The code's currency: an amount off is in the currency of the tiers it
   * covers, not always the item's (an event's tiers each sell in their own).
   * An edit that keeps the tiers keeps the code's saved currency.
   */
  const covered = draft.tierIds.length ? tiers.filter((x) => draft.tierIds.includes(x.id)) : tiers;
  const sameTiersAsSaved = !!existing && sameIds(draft.tierIds, existing.tierIds);
  const codeCurrency = (sameTiersAsSaved ? existing?.currency : null) ?? covered.find((x) => x.currency)?.currency ?? currency;
  // An amount typed in one currency means nothing in another with other minor
  // units (10 EUR = 1000 cents; 1000 JPY = 1000 yen): start the amount again.
  const lastUnit = React.useRef(minorUnits(codeCurrency));
  React.useEffect(() => {
    const u = minorUnits(codeCurrency);
    if (u !== lastUnit.current && draft.mode === "AMOUNT_OFF") set({ value: 10 * u });
    lastUnit.current = u;
  }, [codeCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = preview?.warnings ?? [];
  const codeValid = CODE_PATTERN.test(draft.code.trim());
  const canSave = codeValid && draft.value > 0 && !previewPending && preview !== null && (warnings.length === 0 || checked) && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...draft, code: draft.code.trim() };
      if (existing) await discountCodesApi.update(endpoint, existing.id, changedFields(existing, body), warnings.length > 0);
      else await discountCodesApi.create(endpoint, body, warnings.length > 0);
      onSaved();
    } catch (e) {
      // The server found warnings the preview on screen did not show: show
      // them, and ask for the tick again.
      if (e instanceof DiscountCodeApiError && e.code === "CONFIRM_WARNINGS" && Array.isArray(e.body?.warnings)) {
        setPreview((p) => (p ? { ...p, warnings: e.body.warnings } : p));
        setChecked(false);
      }
      setError(e instanceof DiscountCodeApiError && e.code && KNOWN_ERRORS.has(e.code) ? t(`errors.${e.code}`) : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(isActive: boolean) {
    if (!existing) return;
    setSaving(true);
    try { await discountCodesApi.update(endpoint, existing.id, { isActive }); onSaved(); } catch { setError(t("saveFailed")); } finally { setSaving(false); }
  }

  async function archive() {
    if (!existing) return;
    setSaving(true);
    try { await discountCodesApi.archive(endpoint, existing.id); onSaved(); } catch { setError(t("saveFailed")); } finally { setSaving(false); }
  }

  const unit = minorUnits(codeCurrency);
  const decimals = Math.round(Math.log10(unit));
  /*
   * An amount off is never more than the highest price it covers (the server
   * refuses it too: AMOUNT_ABOVE_PRICE). Read off the preview, which prices
   * exactly the tiers the code covers; for a plan that is one instalment.
   */
  const maxPrice = preview && preview.tiers.length ? Math.max(...preview.tiers.map((x) => x.listPrice)) : null;
  const amountTooHigh = draft.mode === "AMOUNT_OFF" && maxPrice != null && draft.value > maxPrice;
  const saveReady = canSave && !amountTooHigh;
  const label = discountLabel({ mode: draft.mode, value: draft.value, currency: codeCurrency }, t);
  const subtitle = draft.value > 0 ? `${label} · ${optionsSummary(draft, t, tiers.length)}` : optionsSummary(draft, t, tiers.length);
  const isVariant = tierNoun === "variant";
  const muted = "color-mix(in srgb, var(--text-color, #18181b) 55%, transparent)";
  const soft = "rgba(128,128,128,.10)";

  return (
    <ModalShell
      open
      plain
      onClose={onClose}
      title={<span style={{ fontFamily: "var(--heading-font, inherit)" }}>{existing ? t("editTitle") : t("newTitle")}</span>}
      subtitle={subtitle}
      hideCloseButton
      width="sm"
      footer={
        <div className="flex w-full flex-col gap-2">
          {/* Archiving cannot be undone and keeps the name taken on this item:
              one sentence and a second tap first (no browser dialogs). */}
          {existing && confirmArchive && (
            <div className="rounded-xl px-3 py-2.5 text-[12.5px]" style={{ background: soft }} role="alert">
              <p>{t("archiveConfirm")}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setConfirmArchive(false)}
                  className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold" style={{ background: "rgba(128,128,128,.14)" }}>
                  {t("keepCode")}
                </button>
                <button type="button" disabled={saving} onClick={archive}
                  className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold text-white" style={{ background: "#b42318" }}>
                  {t("archive")}
                </button>
              </div>
            </div>
          )}
          {existing && !confirmArchive && (
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => setActive(!existing.isActive)}
                className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
                {existing.isActive ? t("pause") : t("resume")}
              </button>
              <button type="button" disabled={saving} onClick={() => setConfirmArchive(true)}
                className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
                {t("archive")}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 flex-1 rounded-[var(--radius-button,12px)] text-[13.5px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
              {t("close")}
            </button>
            <button type="button" disabled={!saveReady} onClick={save}
              className="h-10 flex-[2] rounded-[var(--radius-button,12px)] text-[13.5px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--brand-color, #18181b)" }}>
              {existing ? t("save") : t("createCode")}
            </button>
          </div>
          {/* Why Create is not ready, when the reason is the tick. */}
          {!saveReady && warnings.length > 0 && !checked && !previewPending && (
            <p className="text-right text-[12px]" style={{ color: muted }} data-testid="create-hint">{t("tickToCreate")}</p>
          )}
        </div>
      }
    >
      <label className="mb-1.5 block text-[12px] font-semibold" style={{ color: muted }} htmlFor="dc-code">{t("code")}</label>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: soft }}>
        <input id="dc-code" value={draft.code} disabled={usedAlready} maxLength={32} autoCapitalize="characters" spellCheck={false}
          onChange={(e) => set({ code: e.target.value.replace(/\s/g, "").toUpperCase() })}
          className="min-w-0 flex-1 bg-transparent font-mono font-semibold tracking-wide outline-none" />
        {existing ? (
          <button type="button" className="flex items-center gap-1 text-[12px] font-semibold"
            onClick={() => { void navigator.clipboard?.writeText(existing.code).catch(() => undefined); onCopied?.(existing.code); }}>
            <Copy size={13} aria-hidden />{t("copy")}
          </button>
        ) : (
          <button type="button" className="text-[12px] font-semibold" onClick={() => set({ code: suggestCode(itemName, draft.mode === "PERCENT_OFF" ? draft.value : null, Math.random()) })}>
            {t("generate")}
          </button>
        )}
      </div>
      {usedAlready && <p className="mt-1 text-[12px]" style={{ color: muted }}>{t("usedKeepsName")}</p>}
      {!codeValid && draft.code.length > 0 && <p className="mt-1 text-[12px]" style={{ color: "#b42318" }}>{t("codeRule")}</p>}

      <p className="mt-4 mb-1.5 text-[12px] font-semibold" style={{ color: muted }}>{t("discount")}</p>
      <div className="flex gap-[3px] rounded-xl p-[3px]" style={{ background: soft }} role="radiogroup">
        {(["PERCENT_OFF", "AMOUNT_OFF"] as DiscountCodeMode[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={draft.mode === m}
            onClick={() => { setCustomPercent(false); set({ mode: m, value: m === "PERCENT_OFF" ? 20 : 10 * unit }); }}
            className={cn("flex-1 rounded-[9px] py-1.5 text-[12.5px] font-semibold", draft.mode === m ? "bg-white shadow-sm" : "opacity-60")}>
            {m === "PERCENT_OFF" ? t("modePercent") : t("modeAmount")}
          </button>
        ))}
      </div>

      {draft.mode === "PERCENT_OFF" ? (
        <div className="mt-2 flex gap-1.5">
          {/* Selected chips are dark: the brand colour is kept for the one main button. */}
          {PRESETS.map((p) => {
            const on = !customPercent && draft.value === p;
            return (
              <button key={p} type="button" onClick={() => { setCustomPercent(false); set({ value: p }); }}
                className="flex-1 rounded-[10px] py-2 text-[13px] font-semibold"
                style={on ? { background: "var(--text-color, #16181d)", color: "var(--bg-color, #fff)" } : { background: soft }}>
                {p}%
              </button>
            );
          })}
          <button type="button" onClick={() => setCustomPercent(true)}
            className="flex-1 rounded-[10px] py-2 text-[13px] font-semibold"
            style={customPercent ? { background: "var(--text-color, #16181d)", color: "var(--bg-color, #fff)" } : { background: soft }}>
            {t("other")}
          </button>
        </div>
      ) : null}
      {(draft.mode === "AMOUNT_OFF" || customPercent) && (
        <>
          <NumberText
            key={draft.mode}
            value={draft.value}
            decimals={draft.mode === "PERCENT_OFF" ? 0 : decimals}
            max={draft.mode === "PERCENT_OFF" ? 100 : undefined}
            onChange={(v) => set({ value: v })}
            ariaLabel={t("discount")}
            suffix={draft.mode === "PERCENT_OFF" ? "%" : t("offEachIn", { currency: codeCurrency })}
            invalid={amountTooHigh}
          />
          {amountTooHigh && (
            <p className="mt-1 text-[12px]" style={{ color: "#b42318" }} role="alert" data-testid="amount-above-price">
              {t("amountAbovePrice", { price: money(maxPrice!, codeCurrency) })}
            </p>
          )}
        </>
      )}

      {preview && preview.tiers.length > 0 && !amountTooHigh && (
        <div className="mt-4">
          <p className="mb-1 text-[12px] font-semibold" style={{ color: muted }}>{t("whatBuyersPay")}</p>
          {preview.tiers.flatMap((tier) => [
            { key: `${tier.tierId}-e`, name: tier.name, who: t("everyone"), row: tier.everyone, list: tier.listPrice, currency: tier.currency, perInstalment: tier.perInstalmentOf },
            ...tier.members.map((m) => ({ key: `${tier.tierId}-${m.segmentId}`, name: tier.name, who: m.segmentName, row: m, list: tier.listPrice, currency: tier.currency, perInstalment: tier.perInstalmentOf })),
          ]).map((r, i) => (
            <div key={r.key} className={cn("flex items-center justify-between gap-3 py-2.5 text-[13px]", i > 0 && "border-t")} style={{ borderColor: "rgba(128,128,128,.16)" }}>
              <span className="min-w-0">
                <span className="block">{r.name}{r.perInstalment && <span className="text-[11px]" style={{ color: muted }}> {t("perInstalment", { n: r.perInstalment })}</span>}</span>
                <span className="block text-[12px]" style={{ color: muted }}>
                  {r.who}
                  {r.row.warnings.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-1 font-semibold" style={{ color: "#8a5a12" }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#d99a2b" }} aria-hidden />
                      {r.row.warnings.includes("FREE") ? t("badgeFree") : r.row.warnings.includes("BELOW_MINIMUM") ? t("badgeBelowMinimum")
                        : t("badgePercent", { percent: Math.round((1 - r.row.price / Math.max(1, r.list)) * 100) })}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="mr-1.5 text-[12px] line-through" style={{ color: muted }}>{money(r.row.from, r.currency)}</span>
                <span className="font-semibold">{money(r.row.price, r.currency)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The warning, its sentence and its tick: one block. */}
      {warnings.length > 0 && !amountTooHigh && (
        <div className="mt-3 rounded-xl px-3 py-2.5 text-[12.5px]" style={{ background: "#fdf4e3", color: "#8a5a12" }}>
          <div className="flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{warningSentence(warnings, t)}</span>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 font-medium" style={{ color: "var(--text-color, #16181d)" }}>
            <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span className="grid h-4 w-4 place-items-center rounded-[5px] border" style={checked ? { background: "var(--text-color, #18181b)", borderColor: "transparent" } : { borderColor: "rgba(138,90,18,.55)", background: "#fff" }}>
              {checked && <Check size={11} color="#fff" strokeWidth={3.5} aria-hidden />}
            </span>
            {t("checkedPrices")}
          </label>
        </div>
      )}

      <button type="button" onClick={() => setShowOptions((s) => !s)}
        className="mt-4 flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-[13px] font-semibold"
        style={{ background: soft }} aria-expanded={showOptions}>
        <span>{isVariant ? t("optionsRowVariants") : t("optionsRow")}</span>
        <span className="flex items-center gap-1.5 text-[12px] font-normal" style={{ color: muted }}>
          {optionsSummary(draft, t, tiers.length)}
          <ChevronDown size={14} aria-hidden className={cn("transition-transform", showOptions && "rotate-180")} />
        </span>
      </button>
      {showOptions && (
        <div className="mt-3 space-y-3">
          {tiers.length > 1 && (
            <fieldset>
              <legend className="mb-1 text-[12px] font-semibold" style={{ color: muted }}>{isVariant ? t("variants") : t("tickets")}</legend>
              {tiers.map((tier) => {
                const on = draft.tierIds.length === 0 || draft.tierIds.includes(tier.id);
                return (
                  <label key={tier.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <input type="checkbox" checked={on} onChange={() => {
                      const all = draft.tierIds.length === 0 ? tiers.map((x) => x.id) : draft.tierIds;
                      const next = on ? all.filter((id) => id !== tier.id) : [...all, tier.id];
                      set({ tierIds: next.length === tiers.length ? [] : next });
                    }} />
                    {tier.name}
                  </label>
                );
              })}
            </fieldset>
          )}
          <NumberRow label={t("maxUses")} hint={t("blankIsUnlimited")} value={draft.maxRedemptions} onChange={(v) => set({ maxRedemptions: v })} />
          <NumberRow label={t("perBuyer")} hint={t("blankIsUnlimited")} value={draft.perBuyerLimit} onChange={(v) => set({ perBuyerLimit: v })} />
          <DateRow kind="start" label={t("starts")} value={draft.startsAt} onChange={(v) => set({ startsAt: v })} />
          <DateRow kind="end" label={t("ends")} value={draft.endsAt} onChange={(v) => set({ endsAt: v })} />
        </div>
      )}

      {error && <p className="mt-3 text-[12.5px]" style={{ color: "#b42318" }} role="alert">{error}</p>}
    </ModalShell>
  );
}

/** One plain sentence for the confirm step, naming the worst case. */
export function warningSentence(warnings: DiscountPreview["warnings"], t: (k: string, v?: Record<string, string | number>) => string): string {
  const free = warnings.filter((w) => w.warning === "FREE");
  const below = warnings.filter((w) => w.warning === "BELOW_MINIMUM");
  if (free.length) return t("warnFree", { n: free.length });
  if (below.length) return t("warnBelowMinimum", { n: below.length });
  return t("warnHalf", { n: warnings.length });
}

function sameIds(a: string[], b: string[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * An edit sends only what changed (Phase 3 review). The backend treats mode,
 * value and tiers in a PATCH as new money terms, re-checking the warnings and
 * refusing them on a used code; sending them unchanged turned a new end date on
 * a used code into a refusal.
 */
export function changedFields(existing: DiscountCode, draft: DiscountCodeDraft): Partial<DiscountCodeDraft> {
  const out: Partial<DiscountCodeDraft> = {};
  if (draft.code !== existing.code) out.code = draft.code;
  if (draft.mode !== existing.mode || draft.value !== existing.value || !sameIds(draft.tierIds, existing.tierIds)) {
    out.mode = draft.mode; out.value = draft.value; out.tierIds = draft.tierIds;
  }
  for (const k of ["startsAt", "endsAt", "maxRedemptions", "perBuyerLimit"] as const) {
    if (draft[k] !== existing[k]) (out as any)[k] = draft[k];
  }
  return out;
}

/**
 * A number typed as TEXT, not <input type="number">: no spinner arrows, no
 * leading "0" (an empty box is empty, not 0, so typing 10 gives "10", not
 * "010"), and "12,50" reads like "12.50". `decimals` follows the currency
 * (2 for EUR, 0 for JPY and for a percentage). Live feedback, 2026-11-16.
 */
export function NumberText({ value, decimals, max, onChange, ariaLabel, suffix, invalid = false }: {
  value: number; decimals: number; max?: number; onChange: (v: number) => void;
  ariaLabel: string; suffix?: React.ReactNode; invalid?: boolean;
}) {
  const shown = (v: number) => (v > 0 ? (decimals ? String(v / 10 ** decimals) : String(v)) : "");
  const [text, setText] = React.useState(() => shown(value));
  const last = React.useRef(value);
  React.useEffect(() => {
    if (value !== last.current) { last.current = value; setText(shown(value)); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: "rgba(128,128,128,.10)", boxShadow: invalid ? "inset 0 0 0 1.5px #b42318" : undefined }}>
      <input type="text" inputMode={decimals ? "decimal" : "numeric"} aria-label={ariaLabel} aria-invalid={invalid}
        value={text} placeholder="0"
        onChange={(e) => {
          let next = e.target.value.replace(/[^\d.,]/g, "");
          const sep = next.search(/[.,]/);
          if (!decimals) next = next.replace(/[.,]/g, "");
          else if (sep >= 0) next = next.slice(0, sep + 1) + next.slice(sep + 1).replace(/[.,]/g, "").slice(0, decimals);
          next = next.replace(/^0+(?=\d)/, "");
          const n = Number(next.replace(",", "."));
          let v = next === "" || Number.isNaN(n) ? 0 : Math.round(n * 10 ** decimals);
          if (max != null && v > max) { v = max; next = shown(max); }
          setText(next);
          last.current = v;
          onChange(v);
        }}
        className="min-w-0 flex-1 bg-transparent outline-none tabular-nums" />
      {suffix && <span className="text-[12.5px] opacity-60">{suffix}</span>}
    </div>
  );
}

function NumberRow({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold opacity-75">{label}</span>
      <input type="number" inputMode="numeric" min={1} placeholder={hint} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))))}
        className="w-full rounded-xl px-3 py-2.5 outline-none" style={{ background: "rgba(128,128,128,.10)" }} />
    </label>
  );
}

/** A day picker. An end is inclusive for the seller and exclusive for the backend (see format.ts). */
function DateRow({ kind, label, value, onChange }: { kind: "start" | "end"; label: string; value: string | null; onChange: (v: string | null) => void }) {
  const shown = value ? toLocalDateInput(kind === "end" ? lastValidDay(value) : value) : "";
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold opacity-75">{label}</span>
      <input type="date" value={shown}
        onChange={(e) => onChange(e.target.value ? dateInputToIso(e.target.value, kind) : null)}
        className="w-full rounded-xl px-3 py-2.5 outline-none" style={{ background: "rgba(128,128,128,.10)" }} />
    </label>
  );
}
