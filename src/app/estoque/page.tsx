"use client";

import { ProtectedShell } from "@/components/protected-shell";

export default function EstoquePage() {
  return (
    <ProtectedShell title="Estoque" subtitle="Níveis e movimentações">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Saldo atual</h3>
          <p className="text-sm text-slate-400">Veja a quantidade atual por produto.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Consultar estoque
          </a>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Histórico</h3>
          <p className="text-sm text-slate-400">Entradas, baixas e ajustes com rastreabilidade.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Ver histórico
          </a>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Alertas</h3>
          <p className="text-sm text-slate-400">Itens abaixo do mínimo e reposições urgentes.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Ver alertas
          </a>
        </div>
      </div>
    </ProtectedShell>
  );
}
