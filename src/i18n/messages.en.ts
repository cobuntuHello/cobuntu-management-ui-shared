/**
 * English copy for the components in this package that the apps render with no
 * copy prop of their own (gate page, donations, refund policy, billing and
 * discount radios, tier pickers, package picker/negotiation, create-flow steps,
 * modal chrome).
 *
 * Every string is asked for by its FULLY QUALIFIED key
 * ("shared.managementUi.gatePage.signIn"), the key the community app's
 * messages/en.json carries. A host mounts <ManagementCopyProvider t={...}> once
 * near its root (the community app passes next-intl's root useTranslations())
 * and every locale it ships works; a host that mounts nothing gets this English.
 *
 * The listing review panel, the overview and the ledger are NOT here: they
 * already take a `t` prop (see listings/copy.ts) and keep doing so.
 */
export const MANAGEMENT_UI_MESSAGES_EN = {
  shared: {
    managementUi: {
      modalChrome: {
        close: "Close",
      },
    },
  },
} as const;

/** Every fully qualified key in a message tree, e.g. for a host's parity test. */
export function flattenMessageKeys(tree: unknown, prefix = ""): string[] {
  if (!tree || typeof tree !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(tree as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push(key);
    else out.push(...flattenMessageKeys(v, key));
  }
  return out;
}
