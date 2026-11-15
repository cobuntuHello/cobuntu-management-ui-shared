"use client";

import * as React from "react";
import { Check, Copy, Tag, TriangleAlert } from "lucide-react";
import { useSharedT } from "../i18n";
import { cn } from "../lib/cn";
import { ModalShell } from "../ui/ModalShell";
import { discountCodesApi, DiscountCodeApiError, type DiscountCodesEndpoint } from "./api";
import { CODE_PATTERN, discountLabel, minorUnits, money, optionsSummary, suggestCode, usesLabel } from "./format";
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
    <section className="mt-6" data-testid="discount-codes">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold opacity-60">{t("title")}</h3>
        {codes && codes.length > 0 && (
          <button type="button" className="text-[13px] font-semibold" onClick={() => setEditing("new")}>{t("new")}</button>
        )}
      </div>

      {loadError && <p className="text-[13px] opacity-70">{t("loadFailed")}</p>}

      {codes && codes.length === 0 && (
        <div className="rounded-2xl border border-dashed px-4 py-5 text-center" style={{ borderColor: "rgba(128,128,128,.35)" }}>
          <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: "rgba(128,128,128,.10)" }}>
            <Tag size={18} aria-hidden />
          </div>
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-0.5 mb-3 text-[12.5px] opacity-60">{t("emptyBody")}</p>
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
                      c.endsAt && t("untilDate", { date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(c.endsAt)) })]
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
const KNOWN_ERRORS = new Set(["CODE_TAKEN", "CONFIRM_WARNINGS", "CODE_IN_USE", "CODE_ARCHIVED", "MIXED_CURRENCY", "NOTHING_TO_DISCOUNT"]);

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
  endpoint, existing, itemName, tiers, currency, onClose, onSaved, onCopied,
}: {
  endpoint: DiscountCodesEndpoint;
  existing: DiscountCode | null;
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
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const usedAlready = !!existing && existing.uses.used + existing.uses.held > 0;

  const set = (patch: Partial<DiscountCodeDraft>) => { setDraft((d) => ({ ...d, ...patch })); setChecked(false); setError(null); };

  // The live preview: the backend's own maths, debounced while the seller types.
  React.useEffect(() => {
    if (!(draft.value > 0)) { setPreview(null); return; }
    const timer = setTimeout(() => {
      discountCodesApi.preview(endpoint, { mode: draft.mode, value: draft.value, tierIds: draft.tierIds })
        .then(setPreview).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [draft.mode, draft.value, draft.tierIds.join(","), endpoint.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = preview?.warnings ?? [];
  const codeValid = CODE_PATTERN.test(draft.code.trim());
  const canSave = codeValid && draft.value > 0 && (warnings.length === 0 || checked) && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...draft, code: draft.code.trim() };
      if (existing) await discountCodesApi.update(endpoint, existing.id, body, warnings.length > 0);
      else await discountCodesApi.create(endpoint, body, warnings.length > 0);
      onSaved();
    } catch (e) {
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

  const unit = minorUnits(currency);
  const summary = `${draft.code.trim() || "…"} · ${discountLabel({ mode: draft.mode, value: draft.value, currency }, t)}`;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={existing ? t("editTitle") : t("newTitle")}
      hideCloseButton
      width="sm"
      footer={
        <div className="flex w-full flex-col gap-2">
          {existing && (
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => setActive(!existing.isActive)}
                className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
                {existing.isActive ? t("pause") : t("resume")}
              </button>
              <button type="button" disabled={saving} onClick={archive}
                className="h-9 flex-1 rounded-[var(--radius-button,10px)] text-[13px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
                {t("archive")}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 flex-1 rounded-[var(--radius-button,12px)] text-[13.5px] font-semibold" style={{ background: "rgba(128,128,128,.12)" }}>
              {t("close")}
            </button>
            <button type="button" disabled={!canSave} onClick={save}
              className="h-10 flex-[2] rounded-[var(--radius-button,12px)] text-[13.5px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--brand-color, #18181b)" }}>
              {existing ? t("save") : t("createCode")}
            </button>
          </div>
        </div>
      }
    >
      <label className="mb-1.5 block text-[12px] font-semibold opacity-75" htmlFor="dc-code">{t("code")}</label>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(128,128,128,.10)" }}>
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
      {usedAlready && <p className="mt-1 text-[12px] opacity-60">{t("usedKeepsName")}</p>}
      {!codeValid && draft.code.length > 0 && <p className="mt-1 text-[12px]" style={{ color: "#b42318" }}>{t("codeRule")}</p>}

      <p className="mt-4 mb-1.5 text-[12px] font-semibold opacity-75">{t("discount")}</p>
      <div className="flex gap-[3px] rounded-xl p-[3px]" style={{ background: "rgba(128,128,128,.10)" }} role="radiogroup">
        {(["PERCENT_OFF", "AMOUNT_OFF"] as DiscountCodeMode[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={draft.mode === m}
            onClick={() => set({ mode: m, value: m === "PERCENT_OFF" ? 20 : 10 * unit })}
            className={cn("flex-1 rounded-[9px] py-1.5 text-[12.5px] font-semibold", draft.mode === m ? "bg-white shadow-sm" : "opacity-60")}>
            {m === "PERCENT_OFF" ? t("modePercent") : t("modeAmount")}
          </button>
        ))}
      </div>

      {draft.mode === "PERCENT_OFF" ? (
        <div className="mt-2 flex gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => { setCustomPercent(false); set({ value: p }); }}
              className={cn("flex-1 rounded-[10px] py-2 text-[13px] font-semibold", !customPercent && draft.value === p ? "text-white" : "")}
              style={{ background: !customPercent && draft.value === p ? "var(--brand-color, #18181b)" : "rgba(128,128,128,.10)" }}>
              {p}%
            </button>
          ))}
          <button type="button" onClick={() => setCustomPercent(true)}
            className={cn("flex-1 rounded-[10px] py-2 text-[13px] font-semibold", customPercent && "text-white")}
            style={{ background: customPercent ? "var(--brand-color, #18181b)" : "rgba(128,128,128,.10)" }}>
            {t("other")}
          </button>
        </div>
      ) : null}
      {(draft.mode === "AMOUNT_OFF" || customPercent) && (
        <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(128,128,128,.10)" }}>
          <input type="number" inputMode="decimal" min={0} aria-label={t("discount")}
            value={draft.mode === "PERCENT_OFF" ? draft.value : draft.value / unit}
            onChange={(e) => {
              const n = Number(e.target.value);
              set({ value: draft.mode === "PERCENT_OFF" ? Math.min(100, Math.max(0, Math.round(n))) : Math.max(0, Math.round(n * unit)) });
            }}
            className="min-w-0 flex-1 bg-transparent outline-none tabular-nums" />
          <span className="text-[12.5px] opacity-60">{draft.mode === "PERCENT_OFF" ? "%" : t("offEachIn", { currency })}</span>
        </div>
      )}

      <div className="mt-4 rounded-2xl px-3.5 py-3 text-white" style={{ background: "var(--text-color, #16181d)" }}>
        <p className="font-semibold">{summary}</p>
        <p className="text-[12px] opacity-70">{optionsSummary(draft, t, tiers.length)}</p>
      </div>

      {preview && preview.tiers.length > 0 && (
        <div className="mt-3">
          {preview.tiers.flatMap((tier) => [
            { key: `${tier.tierId}-e`, label: tier.name, row: tier.everyone, list: tier.listPrice, currency: tier.currency, perInstalment: tier.perInstalmentOf },
            ...tier.members.map((m) => ({ key: `${tier.tierId}-${m.segmentId}`, label: t("tierForMembers", { tier: tier.name, segment: m.segmentName }), row: m, list: tier.listPrice, currency: tier.currency, perInstalment: tier.perInstalmentOf })),
          ]).map((r, i) => (
            <div key={r.key} className={cn("flex items-center justify-between gap-2 py-2 text-[13px]", i > 0 && "border-t")} style={{ borderColor: "rgba(128,128,128,.16)" }}>
              <span className="min-w-0">
                {r.label}
                {r.perInstalment && <span className="text-[11px] opacity-60"> {t("perInstalment", { n: r.perInstalment })}</span>}
                {r.row.warnings.length > 0 && (
                  <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "#fdf4e3", color: "#8a5a12" }}>
                    {r.row.warnings.includes("FREE") ? t("badgeFree") : r.row.warnings.includes("BELOW_MINIMUM") ? t("badgeBelowMinimum")
                      : t("badgePercent", { percent: Math.round((1 - r.row.price / Math.max(1, r.list)) * 100) })}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="mr-1.5 text-[12px] line-through opacity-50">{money(r.row.from, r.currency)}</span>
                <span className="font-semibold">{money(r.row.price, r.currency)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <>
          <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px]" style={{ background: "#fdf4e3", color: "#8a5a12" }}>
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{warningSentence(warnings, t)}</span>
          </div>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12.5px]">
            <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span className="grid h-4 w-4 place-items-center rounded-[5px] border" style={checked ? { background: "var(--brand-color, #18181b)", borderColor: "transparent" } : { borderColor: "rgba(128,128,128,.5)" }}>
              {checked && <Check size={11} color="#fff" strokeWidth={3.5} aria-hidden />}
            </span>
            {t("checkedPrices")}
          </label>
        </>
      )}

      <button type="button" onClick={() => setShowOptions((s) => !s)}
        className="mt-3 flex w-full items-center justify-between border-t pt-3 text-[13px] font-semibold" style={{ borderColor: "rgba(128,128,128,.16)" }}
        aria-expanded={showOptions}>
        <span>{t("optionsRow")}</span>
        <span className="text-[12px] font-normal opacity-60">{optionsSummary(draft, t, tiers.length)}</span>
      </button>
      {showOptions && (
        <div className="mt-2 space-y-3">
          {tiers.length > 1 && (
            <fieldset>
              <legend className="mb-1 text-[12px] font-semibold opacity-75">{t("tickets")}</legend>
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
          <DateRow label={t("starts")} value={draft.startsAt} onChange={(v) => set({ startsAt: v })} />
          <DateRow label={t("ends")} value={draft.endsAt} onChange={(v) => set({ endsAt: v })} />
        </div>
      )}

      {error && <p className="mt-3 text-[12.5px]" style={{ color: "#b42318" }}>{error}</p>}
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

function DateRow({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold opacity-75">{label}</span>
      <input type="date" value={value ? value.slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null)}
        className="w-full rounded-xl px-3 py-2.5 outline-none" style={{ background: "rgba(128,128,128,.10)" }} />
    </label>
  );
}
