"use client";

import * as React from "react";
import {
  DEFAULT_RESOLVED,
  namespaced,
  resolve,
  setCurrentResolved,
  type Resolved,
  type SharedT,
  type SharedTranslate,
  type SharedTranslateRich,
} from "./core";

export * from "./core";

const CopyContext = React.createContext<Resolved>(DEFAULT_RESOLVED);

export interface ManagementCopyProviderProps {
  /** Resolve a fully qualified key. Omitted: the built-in English. */
  t?: SharedTranslate;
  /** Resolve a key whose message carries <b> tags. Optional, see above. */
  rich?: SharedTranslateRich;
  children: React.ReactNode;
}

export function ManagementCopyProvider({ t, rich, children }: ManagementCopyProviderProps) {
  const value = React.useMemo(() => resolve(t, rich), [t, rich]);
  setCurrentResolved(value);
  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

/** `const t = useSharedT("shared.managementUi.gatePage")`, then `t("signIn")`. */
export function useSharedT(namespace: string): SharedT {
  const resolved = React.useContext(CopyContext);
  return React.useMemo(() => namespaced(resolved, namespace), [resolved, namespace]);
}

