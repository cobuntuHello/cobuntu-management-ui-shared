"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { PackagePicker, type CommissionPackage } from "./PackagePicker";

export type NegotiationRole = "member" | "leader";

export interface PendingProposal {
  id: string;
  packageId: string | null;
  packageName: string | null;
  rate: number;
  message?: string | null;
  /** True when the VIEWER made this offer — then it is theirs to wait on. */
  proposedByMe: boolean;
  proposedByName?: string | null;
}

export interface PackageNegotiationProps {
  role: NegotiationRole;
  /** Packages available to the SELLER's tier. Both sides see the same list. */
  packages: CommissionPackage[];
  /** The agreed arrangement, once there is one. */
  agreedPackageId?: string | null;
  agreedRate?: number | null;
  /** The offer on the table, if any. */
  pending?: PendingProposal | null;
  /** Names, used so the copy says who is waiting on whom. */
  communityName?: string;
  counterpartName?: string;
  busy?: boolean;
  onPropose: (packageId: string, message?: string) => void | Promise<void>;
  onRespond: (proposalId: string, response: "ACCEPTED" | "REJECTED") => void | Promise<void>;
}

/**
 * The negotiating table: what the terms are, whose move it is, and the one
 * thing to do next.
 *
 * ── One component, both sides ───────────────────────────────────────────────
 *
 * The member requesting and the community reviewing are looking at the same
 * object — an offer — and the only thing that differs is which side of it they
 * are on. Building two screens guarantees they drift: one gains a field, the
 * other keeps describing the same arrangement a different way, and eventually
 * the two sides of a deal disagree about what the deal is. So `role` changes
 * the copy and who may act, and nothing else.
 *
 * ── What it deliberately cannot do ──────────────────────────────────────────
 *
 * There is no rate input anywhere in here, for either role. A counter-offer
 * moves the listing between PUBLISHED packages; a rate that is not some
 * package's rate is a private deal, and once private deals exist no member can
 * trust the list they were shown. The backend refuses a typed rate under this
 * fee model — this component simply never offers the affordance, so the rule is
 * visible rather than discovered through an error.
 *
 * Presentational: it fetches nothing and decides no permissions. The host app
 * passes what it knows and handles the calls.
 */
export function PackageNegotiation({
  role,
  packages,
  agreedPackageId,
  agreedRate,
  pending,
  communityName,
  counterpartName,
  busy = false,
  onPropose,
  onRespond,
}: PackageNegotiationProps) {
  const [countering, setCountering] = React.useState(false);
  const [choice, setChoice] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const other = counterpartName ?? (role === "member" ? communityName ?? "the community" : "the member");
  const agreed = agreedPackageId
    ? packages.find((p) => p.id === agreedPackageId) ?? null
    : null;

  function startCounter() {
    setChoice(pending?.packageId ?? agreedPackageId ?? null);
    setNote("");
    setCountering(true);
  }

  async function submitCounter() {
    if (!choice) return;
    await onPropose(choice, note.trim() || undefined);
    setCountering(false);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {/* Where things stand. One sentence, no jargon, no stage names. */}
      <header className="border-b border-zinc-100 px-5 py-4">
        <h3 className="m-0 text-[14.5px] font-semibold tracking-[-0.01em] text-zinc-900">
          {pending
            ? pending.proposedByMe
              ? `Waiting on ${other}`
              : `${pending.proposedByName ?? other} suggested different terms`
            : agreed
              ? "Agreed terms"
              : "Choose how this is listed"}
        </h3>
        <p className="m-0 mt-1 max-w-[58ch] text-[12.5px] leading-relaxed text-zinc-500">
          {pending
            ? pending.proposedByMe
              ? "They can accept it, or suggest another arrangement."
              : "Accept it, or suggest a different one. Neither side can change what a package costs."
            : agreed
              ? "This is what every sale under this listing pays."
              : role === "member"
                ? `Pick the arrangement you want. ${communityName ?? "The community"} reviews it before it goes live.`
                : "Nothing has been agreed yet."}
        </p>
      </header>

      {/* The terms themselves. */}
      <div className="px-5 py-4">
        {pending ? (
          <div
            className={cn(
              "rounded-[11px] border px-4 py-3.5",
              pending.proposedByMe
                ? "border-zinc-200 bg-zinc-50"
                : "border-zinc-900 shadow-[0_0_0_1px_#18181b]",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold text-zinc-900">
                {pending.packageName ?? "Proposed terms"}
              </span>
              <span className="text-[16px] font-bold tabular-nums tracking-tight text-zinc-900">
                {pending.rate}%
              </span>
            </div>
            {pending.message ? (
              <p className="m-0 mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-600">
                “{pending.message}”
              </p>
            ) : null}
            {agreed && agreed.id !== pending.packageId ? (
              <p className="m-0 mt-2 text-[11.5px] text-zinc-400">
                Currently {agreed.name} · {agreed.rate}%
              </p>
            ) : null}
          </div>
        ) : agreed ? (
          <div className="rounded-[11px] border border-zinc-200 bg-zinc-50 px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold text-zinc-900">{agreed.name}</span>
              <span className="text-[16px] font-bold tabular-nums tracking-tight text-zinc-900">
                {agreedRate ?? agreed.rate}%
              </span>
            </div>
            {agreed.description ? (
              <p className="m-0 mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-600">
                {agreed.description}
              </p>
            ) : null}
          </div>
        ) : (
          <PackagePicker
            packages={packages}
            value={choice}
            onChange={setChoice}
            communityName={communityName}
            disabled={busy}
          />
        )}
      </div>

      {/* Counter form — a package list, never a number. */}
      {countering ? (
        <div className="border-t border-zinc-100 bg-[#fbfaf9] px-5 py-4">
          <p className="m-0 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            Suggest a different package
          </p>
          <PackagePicker
            packages={packages}
            value={choice}
            onChange={setChoice}
            communityName={communityName}
            disabled={busy}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              role === "leader"
                ? "This doesn't need us running it, so Co-run fits better."
                : "I'd rather handle this one myself."
            }
            className="mt-2.5 w-full resize-y rounded-[9px] border border-zinc-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-zinc-900 outline-none transition-colors placeholder:text-zinc-300 focus:border-zinc-400 focus:ring-[3px] focus:ring-zinc-900/[0.06]"
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <Button onClick={() => setCountering(false)} disabled={busy}>
              Cancel
            </Button>
            <Button primary onClick={submitCounter} disabled={busy || !choice}>
              Send suggestion
            </Button>
          </div>
        </div>
      ) : (
        <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-3.5">
          {pending && !pending.proposedByMe ? (
            <>
              <Button onClick={() => onRespond(pending.id, "REJECTED")} disabled={busy}>
                Decline
              </Button>
              <Button onClick={startCounter} disabled={busy || packages.length === 0}>
                Suggest another
              </Button>
              <Button primary onClick={() => onRespond(pending.id, "ACCEPTED")} disabled={busy}>
                Accept {pending.packageName ? `${pending.packageName}` : "these terms"}
              </Button>
            </>
          ) : pending && pending.proposedByMe ? (
            <Button onClick={startCounter} disabled={busy || packages.length === 0}>
              Change my suggestion
            </Button>
          ) : agreed ? (
            <Button onClick={startCounter} disabled={busy || packages.length === 0}>
              Suggest a different package
            </Button>
          ) : (
            <Button
              primary
              onClick={() => choice && onPropose(choice)}
              disabled={busy || !choice}
            >
              {role === "member" ? "Request this listing" : "Offer these terms"}
            </Button>
          )}
        </footer>
      )}
    </section>
  );
}

/** Real buttons, never link-styled text — actions here move money. */
function Button({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[9px] border px-3.5 py-2 text-[12.5px] font-medium transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        primary
          ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
      )}
    >
      {children}
    </button>
  );
}
