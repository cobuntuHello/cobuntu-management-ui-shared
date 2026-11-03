import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ManagementCopyProvider, useSharedT, getSharedT } from "../i18n";
import { MANAGEMENT_UI_MESSAGES_EN, flattenMessageKeys } from "../i18n/messages.en";

/**
 * The package's components speak the HOST's language.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 *
 * The listing panel, overview and ledger took a `t`; everything else here was
 * hard-coded English (gate page, donations, refund policy, billing/discount
 * radios, tier pickers, create-flow steps, close buttons). The community app
 * renders all of them, so a pt-PT community saw English on those screens.
 *
 * ── The contract ────────────────────────────────────────────────────────────
 *
 * Components ask for FULLY QUALIFIED keys; the host mounts
 * <ManagementCopyProvider t={...}> once (the community app: next-intl's root
 * useTranslations()). With no provider, the package renders its own English.
 */

function Probe() {
  const t = useSharedT("shared.managementUi.modalChrome");
  return <p>{t("close")}</p>;
}

describe("ManagementCopyProvider", () => {
  it("resolves the fully qualified key through the host's t", () => {
    const seen: string[] = [];
    const t = (key: string) => {
      seen.push(key);
      return `PT:${key}`;
    };
    render(
      <ManagementCopyProvider t={t}>
        <Probe />
      </ManagementCopyProvider>,
    );
    expect(screen.getByText("PT:shared.managementUi.modalChrome.close")).toBeInTheDocument();
    expect(seen).toContain("shared.managementUi.modalChrome.close");
  });

  it("falls back to the built-in English with no provider", () => {
    render(<Probe />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("getSharedT mirrors the last provider for non-hook helpers", () => {
    const t = (key: string) => `PT:${key}`;
    render(
      <ManagementCopyProvider t={t}>
        <Probe />
      </ManagementCopyProvider>,
    );
    expect(getSharedT("shared.managementUi.modalChrome")("close")).toBe("PT:shared.managementUi.modalChrome.close");
  });
});

/*
 * EVERY literal key a component asks for exists in the English defaults.
 *
 * Scraped from the source, not hand-listed: a missing key renders AS THE KEY.
 * Each `t("...")` resolves against the nearest `useSharedT("ns")` /
 * `getSharedT("ns")` declared above it in the same file. Computed keys are
 * skipped.
 */
describe("every requested key has an English default", () => {
  const SRC = join(__dirname, "..");
  const known = new Set(flattenMessageKeys(MANAGEMENT_UI_MESSAGES_EN));
  function files(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (e !== "__tests__") out.push(...files(p));
      } else if (/\.tsx?$/.test(e)) out.push(p);
    }
    return out;
  }
  const blank = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/\S/g, " ")).replace(/(^|[^:])\/\/.*$/gm, (m) => m.replace(/\S/g, " "));

  it("resolves", () => {
    const missing: string[] = [];
    for (const f of files(SRC)) {
      const src = blank(readFileSync(f, "utf8"));
      const decls = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:useSharedT|getSharedT)\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map(
        (m) => ({ at: m.index!, v: m[1], ns: m[2] }),
      );
      for (const v of new Set(decls.map((d) => d.v))) {
        const re = new RegExp(`\\b${v}(?:\\.rich)?\\(\\s*["'\`]([\\w.]+)["'\`]`, "g");
        for (const m of src.matchAll(re)) {
          const decl = decls.filter((x) => x.v === v && x.at < m.index!).pop();
          if (!decl) continue;
          const key = `${decl.ns}.${m[1]}`;
          if (!known.has(key)) missing.push(`${f.replace(SRC, "src")}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
