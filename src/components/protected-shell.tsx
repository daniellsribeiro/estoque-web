"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ProtectedShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let canceled = false;
    const validate = async () => {
      try {
        const profile = await apiFetch<{ name?: string }>("/auth/me");
        if (!canceled) setUserName(profile?.name ?? null);
      } catch {
        if (!canceled) router.replace("/login");
      } finally {
        if (!canceled) setCheckingAuth(false);
      }
    };
    void validate();
    return () => {
      canceled = true;
    };
  }, [router]);

  useEffect(() => {
    const handleUnauthorized = () => router.replace("/login");
    window.addEventListener("api-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("api-unauthorized", handleUnauthorized);
  }, [router]);

  const menu = useMemo(
    () => [
      { label: "Dashboard", href: "/painel" },
      { label: "Produtos", href: "/produtos" },
      { label: "Estoque", href: "/estoque" },
      { label: "Compras", href: "/compras" },
      { label: "Gastos", href: "/gastos" },
      { label: "Vendas", href: "/vendas" },
      { label: "Clientes", href: "/clientes" },
      { label: "Fornecedores", href: "/fornecedores" },
      { label: "Cartões", href: "/pagamentos" },
      { label: "Configurações", href: "/config" },
    ],
    [],
  );

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-900/60 bg-slate-900/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-10 overflow-x-auto">
            <div>
              <p className="text-sm text-slate-400">{subtitle ?? "Painel da Loja"}</p>
              <h1 className="text-xl font-semibold">
                {title} {userName ? `· ${userName}` : ""}
              </h1>
            </div>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              {menu.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 transition hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
