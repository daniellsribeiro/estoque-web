"use client";

import { ProtectedShell } from "@/components/protected-shell";

export default function VendasPage() {
  return (
    <ProtectedShell title="Vendas" subtitle="Pedidos e recebimentos">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Pedidos de venda</h3>
          <p className="text-sm text-slate-400">Crie e acompanhe vendas e entregas.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Ver vendas
          </a>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Recebimentos</h3>
          <p className="text-sm text-slate-400">Controle parcelas e conciliação de pagamentos.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Receber
          </a>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Baixas de estoque</h3>
          <p className="text-sm text-slate-400">Automatize a baixa dos itens vendidos.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Movimentar estoque
          </a>
        </div>
      </div>
    </ProtectedShell>
  );
}
