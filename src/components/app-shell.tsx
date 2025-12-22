"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProtectedShell } from "@/components/protected-shell";
import { ShellMetaProvider, type ShellMetaInput } from "@/components/shell-meta";

const NO_SHELL_PATHS = new Set(["/login"]);
const DEFAULT_META = { title: "Painel", subtitle: "Painel da Loja" };

type ShellMetaState = {
  title: string;
  subtitle?: string;
  path?: string;
  source: "default" | "page";
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [meta, setMeta] = useState<ShellMetaState>({
    ...DEFAULT_META,
    source: "default",
    path: pathname ?? "",
  });

  useEffect(() => {
    setMeta((current) => {
      if (current.source === "page" && current.path === pathname) {
        return current;
      }
      return { ...DEFAULT_META, source: "default", path: pathname ?? "" };
    });
  }, [pathname]);

  const setPageMeta = useCallback(
    (input: ShellMetaInput) => {
      const path = input.path ?? pathname ?? "";
      setMeta({ title: input.title, subtitle: input.subtitle, source: "page", path });
    },
    [pathname],
  );

  const contextValue = useMemo(() => ({ setMeta: setPageMeta }), [setPageMeta]);

  if (!pathname || NO_SHELL_PATHS.has(pathname) || pathname === "/") {
    return <>{children}</>;
  }

  return (
    <ShellMetaProvider value={contextValue}>
      <ProtectedShell title={meta.title} subtitle={meta.subtitle}>
        {children}
      </ProtectedShell>
    </ShellMetaProvider>
  );
}
