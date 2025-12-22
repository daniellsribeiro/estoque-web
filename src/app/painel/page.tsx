 "use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageMeta } from "@/components/page-meta";

type DashboardData = {
  estoqueCritico: number;
  vendasHoje: number;
  comprasPendentes: number;
  recebimentosMes: number;
  alertaEstoques: string[];
  movimentacao?: { label: string; entradas: number; saidas: number }[];
};

const fallbackData: DashboardData = {
  estoqueCritico: 0,
  vendasHoje: 0,
  comprasPendentes: 0,
  recebimentosMes: 0,
  alertaEstoques: [],
  movimentacao: [],
};

export default function PainelPage() {
  const [dashboard, setDashboard] = useState<DashboardData>(fallbackData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboard = async () => {
      try {
        const data = await apiFetch<DashboardData>("/dashboard/summary", {
          signal: controller.signal,
        });
        setDashboard({
          estoqueCritico: data.estoqueCritico ?? 0,
          vendasHoje: data.vendasHoje ?? 0,
          comprasPendentes: data.comprasPendentes ?? 0,
          recebimentosMes: data.recebimentosMes ?? 0,
          alertaEstoques: data.alertaEstoques ?? [],
          movimentacao: data.movimentacao ?? [],
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDashboard(fallbackData);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    return () => controller.abort();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Estoques críticos",
        value: loading ? "..." : `${dashboard.estoqueCritico} itens`,
        trend: loading ? "Carregando" : "Priorize reposição",
        accent: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40",
      },
      {
        title: "Vendas hoje",
        value: loading ? "..." : `R$ ${dashboard.vendasHoje.toLocaleString("pt-BR")}`,
        trend: loading ? "" : "vs. ontem",
        accent: "bg-emerald-500/15 text-emerald-50 font-semibold ring-1 ring-emerald-500 shadow shadow-emerald-500/60",
      },
      {
        title: "Compras pendentes",
        value: loading ? "..." : `${dashboard.comprasPendentes} pedidos`,
        trend: loading ? "" : "Aguardando pagamento",
        accent: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40",
      },
      {
        title: "Recebimentos do mês",
        value: loading ? "..." : `R$ ${dashboard.recebimentosMes.toLocaleString("pt-BR")}`,
        trend: loading ? "" : "Liquidez do mês",
        accent: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40",
      },
    ],
    [dashboard, loading],
  );

  return (
    <div>
      <PageMeta title="Dashboard" subtitle="Painel da Loja" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-slate-900/70 p-5 shadow-xl ring-1 ring-slate-800"
          >
            <div className="text-sm text-slate-400">{card.title}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-50">{card.value}</div>
            <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${card.accent}`}>
              {card.trend || "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-slate-900/70 p-6 ring-1 ring-slate-800 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Movimento semanal</h3>
              <p className="text-sm text-slate-400">Entradas x saídas</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50 font-semibold ring-1 ring-emerald-500 shadow shadow-emerald-500/60">
              {loading ? "Carregando" : "Atualizado"}
            </span>
          </div>
          <div className="mt-6 h-48 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 ring-1 ring-slate-800/60">
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {loading
                ? "Carregando..."
                : dashboard.movimentacao && dashboard.movimentacao.length > 0
                  ? "Gráfico renderize aqui com os dados carregados"
                  : "Sem dados de movimentação"}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-6 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Alertas rápidos</h3>
          <p className="text-sm text-slate-400">O que precisa de atenção agora</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {loading && <li className="text-slate-400">Carregando...</li>}
            {!loading && dashboard.alertaEstoques.length === 0 && (
              <li className="text-slate-400">Nenhum alerta no momento.</li>
            )}
            {dashboard.alertaEstoques.map((alerta, idx) => (
              <li
                key={`${alerta}-${idx}`}
                className="rounded-lg bg-amber-500/10 px-3 py-2 ring-1 ring-amber-500/40"
              >
                {alerta}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

