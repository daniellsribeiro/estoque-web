"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ShellMetaInput = {
  title: string;
  subtitle?: string;
  path?: string;
};

type ShellMetaContextValue = {
  setMeta: (meta: ShellMetaInput) => void;
};

const ShellMetaContext = createContext<ShellMetaContextValue | null>(null);

export function ShellMetaProvider({
  value,
  children,
}: {
  value: ShellMetaContextValue;
  children: ReactNode;
}) {
  return <ShellMetaContext.Provider value={value}>{children}</ShellMetaContext.Provider>;
}

export function useShellMeta() {
  const ctx = useContext(ShellMetaContext);
  if (!ctx) {
    throw new Error("useShellMeta must be used within ShellMetaProvider");
  }
  return ctx;
}
