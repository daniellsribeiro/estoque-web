"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ProtectedShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      { label: "Dashboard", href: "/painel", icon: "🏠" },
      { label: "Produtos", href: "/produtos", icon: "📦" },
      { label: "Estoque", href: "/estoque", icon: "📊" },
      { label: "Compras", href: "/compras", icon: "🛒" },
      { label: "Gastos", href: "/gastos", icon: "💸" },
      { label: "Vendas", href: "/vendas", icon: "🧾" },
      { label: "Clientes", href: "/clientes", icon: "👥" },
      { label: "Fornecedores", href: "/fornecedores", icon: "🏭" },
      { label: "Cartões", href: "/pagamentos", icon: "💳" },
      { label: "Configurações", href: "/config", icon: "⚙️" },
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
      <div className="flex min-h-screen">
        <aside
          className={`hidden h-screen flex-col border-r border-fuchsia-700/60 bg-slate-900 shadow-2xl transition-all duration-200 lg:flex ${
            sidebarOpen ? "w-56" : "w-16"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-4">
            <button
              onClick={() => setSidebarOpen((p) => !p)}
              className="rounded-md p-2 text-fuchsia-400 transition hover:bg-fuchsia-600/10"
              aria-label="Alternar menu"
            >
              ☰
            </button>
            {sidebarOpen && (
              <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
                {subtitle ?? "Painel"}
              </span>
            )}
          </div>
          <nav className="flex-1 space-y-1 px-2">
            {menu.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-fuchsia-600 text-slate-50 shadow-lg"
                      : "text-slate-200 hover:bg-slate-800 hover:text-white"
                  }`}
                  title={item.label}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                </a>
              );
            })}
          </nav>
          <div className="px-2 pb-4">
            {sidebarOpen && userName && <p className="mb-2 truncate text-xs text-slate-400">Olá, {userName}</p>}
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-700 px-3 py-2 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-700/20"
            >
              ⏻ {sidebarOpen && "Sair"}
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-900/60 bg-slate-900/70 px-5 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">{subtitle ?? "Painel da Loja"}</p>
                <h1 className="text-lg font-semibold text-slate-50">{title}</h1>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Sair
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto text-xs text-slate-300">
              {menu.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-2 transition ${
                      active ? "bg-fuchsia-600 text-slate-50" : "bg-slate-900/60 text-slate-200"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </header>

          <main className="px-5 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
