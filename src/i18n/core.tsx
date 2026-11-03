/*
 * The translator core, with NO "use client": plain helpers (lib/tierAccess,
 * lib/submitActions, refund-band text) import getSharedT from here so they stay
 * callable from server code, where they simply render English.
 */
import * as React from "react";
import { MANAGEMENT_UI_MESSAGES_EN } from "./messages.en";

/**
 * Copy for this package's components, through the HOST's translator.
 *
 * Same contract as @cobuntu/event-management-ui's create wizard: components ask
 * for every string by its FULLY QUALIFIED key, and the host plugs in whatever it
 * translates with:
 *
 *   - the community app mounts <ManagementCopyProvider t={useTranslations()}
 *     rich={t.rich}> near its root, so every locale it ships keeps working;
 *   - a host with no i18n mounts nothing and gets MANAGEMENT_UI_MESSAGES_EN.
 *
 * `rich` is separate because a few messages carry markup (<b>) that has to
 * become elements, and next-intl refuses to format those through plain `t`.
 * Without `rich`, the markup is parsed out of what `t` returns.
 */
export type SharedTranslationValues = Record<string, string | number | Date>;
export type SharedTranslate = (key: string, values?: SharedTranslationValues) => string;
export type SharedRichValues = Record<string, string | number | Date | ((chunks: React.ReactNode) => React.ReactNode)>;
export type SharedTranslateRich = (key: string, values?: SharedRichValues) => React.ReactNode;

/* ───────────────────────── a small ICU formatter ───────────────────────── */

/** Index of the brace closing the one at `open`, or -1. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** "one {# day} other {# days}" → { one: "# day", other: "# days" } */
function parseOptions(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    let key = "";
    while (i < s.length && s[i] !== "{" && !/\s/.test(s[i])) key += s[i++];
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "{") break;
    const end = matchBrace(s, i);
    if (end < 0) break;
    out[key] = s.slice(i + 1, end);
    i = end + 1;
  }
  return out;
}

/**
 * Formats the ICU subset the wizard's messages use: `{name}`, `{n, plural, …}`
 * (with `#` and `=N`), and `{x, select, …}`. Tags like <b> pass through
 * untouched for `renderRich`.
 */
export function formatMessage(message: string, values: Record<string, unknown> = {}, locale = "en"): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const ch = message[i];
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    const end = matchBrace(message, i);
    if (end < 0) {
      out += message.slice(i);
      break;
    }
    const inner = message.slice(i + 1, end);
    const firstComma = inner.indexOf(",");
    if (firstComma < 0) {
      const name = inner.trim();
      const v = values[name];
      out += v === undefined || v === null ? `{${name}}` : v instanceof Date ? v.toLocaleString(locale) : String(v);
    } else {
      const name = inner.slice(0, firstComma).trim();
      const rest = inner.slice(firstComma + 1);
      const secondComma = rest.indexOf(",");
      const type = (secondComma < 0 ? rest : rest.slice(0, secondComma)).trim();
      const options = parseOptions(secondComma < 0 ? "" : rest.slice(secondComma + 1));
      const v = values[name];
      if (type === "plural") {
        const n = Number(v);
        let pick = options[`=${n}`];
        if (pick === undefined) {
          let cat = "other";
          try { cat = new Intl.PluralRules(locale).select(n); } catch { /* keep other */ }
          pick = options[cat] ?? options.other ?? "";
        }
        out += formatMessage(pick.replace(/#/g, String(n)), values, locale);
      } else if (type === "select") {
        out += formatMessage(options[String(v)] ?? options.other ?? "", values, locale);
      } else {
        out += v === undefined ? "" : String(v);
      }
    }
    i = end + 1;
  }
  return out;
}

/** Turns `a <b>b</b> c` into nodes, with each tag rendered by `tags[name]`. */
export function renderRich(
  text: string,
  tags: Record<string, (chunks: React.ReactNode) => React.ReactNode> = {},
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /<([a-zA-Z][\w-]*)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const render = tags[m[1]];
    parts.push(<React.Fragment key={k++}>{render ? render(m[2]) : m[2]}</React.Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/** A `t` over a message tree. Missing keys come back as the key itself. */
export function createSharedTranslator(messages: unknown = MANAGEMENT_UI_MESSAGES_EN, locale = "en"): SharedTranslate {
  return (key, values) => {
    const msg = lookup(messages, key);
    return msg === undefined ? key : formatMessage(msg, values, locale);
  };
}

/* ───────────────────────── context ───────────────────────── */

export interface Resolved {
  t: SharedTranslate;
  rich: SharedTranslateRich;
}

export function resolve(t?: SharedTranslate, rich?: SharedTranslateRich): Resolved {
  const tt = t ?? createSharedTranslator();
  const rr: SharedTranslateRich = rich ?? ((key, values = {}) => {
    const plain: SharedTranslationValues = {};
    const tags: Record<string, (c: React.ReactNode) => React.ReactNode> = {};
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === "function") tags[k] = v as (c: React.ReactNode) => React.ReactNode;
      else plain[k] = v;
    }
    return renderRich(tt(key, plain), tags);
  });
  return { t: tt, rich: rr };
}

export const DEFAULT_RESOLVED = resolve();
/*
 * Mirrored during render for the few plain helpers that build user-visible text
 * outside a component (validation messages, option lists). Components read the
 * CONTEXT; this is the escape hatch, same as event-management-ui's getEventT.
 */
let currentResolved: Resolved = DEFAULT_RESOLVED;

/** Called by ManagementCopyProvider during render. */
export function setCurrentResolved(r: Resolved): void {
  currentResolved = r;
}

export interface SharedT {
  (key: string, values?: SharedTranslationValues): string;
  rich: (key: string, values?: SharedRichValues) => React.ReactNode;
}

export function namespaced({ t, rich }: Resolved, namespace: string): SharedT {
  const fn = ((key: string, values?: SharedTranslationValues) => t(`${namespace}.${key}`, values)) as SharedT;
  fn.rich = (key, values) => rich(`${namespace}.${key}`, values);
  return fn;
}

/** Non-hook, namespaced translator for module-level helpers. See currentResolved. */
export function getSharedT(namespace: string): SharedT {
  return namespaced(currentResolved, namespace);
}
