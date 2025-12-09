"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ProtectedShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const [userName] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("userName") : null,
  );

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.replace("/login");
      return;
    }
  }, [router]);

  const menu = useMemo(
    () => [
      { label: "Dashboard", href: "/painel" },
      { label: "Produtos", href: "/produtos" },
      { label: "Estoque", href: "/estoque" },
      { label: "Compras", href: "/compras" },
      { label: "Vendas", href: "/vendas" },
      { label: "Clientes", href: "/clientes" },
      { label: "Fornecedores", href: "/fornecedores" },
      { label: "Cartões", href: "/pagamentos" },
      { label: "Configurações", href: "/config" },
    ],
    [],
  );

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userName");
    router.replace("/login");
  };

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
