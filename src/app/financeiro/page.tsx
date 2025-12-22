"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageMeta } from "@/components/page-meta";

export default function FinanceiroPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);

  return (
    <div>
      <PageMeta title="Financeiro" subtitle="Fluxos de caixa e cartões" />
      {message && (
        <div className="mb-4 rounded-lg bg-emerald-700/40 px-4 py-2 text-sm text-emerald-50 font-semibold ring-1 ring-emerald-500 shadow shadow-emerald-500/60">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Tipos de pagamento</h3>
          <p className="text-sm text-slate-400">Taxas, parcelamento e descontos.</p>
          <form
            className="mt-4 space-y-3 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (salvandoTipo) return;
              const fd = new FormData(e.currentTarget);
              const body = {
                descricao: fd.get("descricao"),
                taxaFixa: Number(fd.get("taxaFixa") || 0),
                taxaPercentual: Number(fd.get("taxaPercentual") || 0),
                taxaParcela: Number(fd.get("taxaParcela") || 0),
                descontoPercentual: Number(fd.get("descontoPercentual") || 0),
                parcelavel: fd.get("parcelavel") === "on",
                minParcelas: Number(fd.get("minParcelas") || 1),
                maxParcelas: Number(fd.get("maxParcelas") || 1),
              };
              try {
                setSalvandoTipo(true);
                setMessage(null);
                setError(null);
                await apiFetch("/financeiro/tipos-pagamento", {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                setMessage("Tipo de pagamento salvo");
                setError(null);
                e.currentTarget.reset();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao salvar");
                setMessage(null);
              } finally {
                setSalvandoTipo(false);
              }
            }}
          >
            <input
              name="descricao"
              required
              placeholder="Descrição"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="taxaFixa"
                type="number"
                step="0.01"
                placeholder="Taxa fixa"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="taxaPercentual"
                type="number"
                step="0.01"
                placeholder="%"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="taxaParcela"
                type="number"
                step="0.01"
                placeholder="Taxa por parcela"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="descontoPercentual"
                type="number"
                step="0.01"
                placeholder="% Desconto"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <input type="checkbox" name="parcelavel" id="parcelavel" className="h-4 w-4" />
              <label htmlFor="parcelavel">Parcelável</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="minParcelas"
                type="number"
                min={1}
                placeholder="Mín. parcelas"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="maxParcelas"
                type="number"
                min={1}
                placeholder="Máx. parcelas"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              disabled={salvandoTipo}
              className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {salvandoTipo ? "Salvando..." : "Salvar tipo"}
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Cartões / Contas</h3>
          <p className="text-sm text-slate-400">Controle de cartões e contas para pagamentos.</p>
          <form
            className="mt-4 space-y-3 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (salvandoConta) return;
              const fd = new FormData(e.currentTarget);
              const body = {
                nome: fd.get("nome"),
                banco: fd.get("banco") || undefined,
                bandeira: fd.get("bandeira") || undefined,
                diaFechamento: fd.get("diaFechamento") ? Number(fd.get("diaFechamento")) : undefined,
                diaVencimento: fd.get("diaVencimento") ? Number(fd.get("diaVencimento")) : undefined,
                ativo: true,
              };
              try {
                setSalvandoConta(true);
                setMessage(null);
                setError(null);
                await apiFetch("/financeiro/cartoes-contas", {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                setMessage("Cartão/Conta salvo");
                setError(null);
                e.currentTarget.reset();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao salvar");
                setMessage(null);
              } finally {
                setSalvandoConta(false);
              }
            }}
          >
            <input
              name="nome"
              required
              placeholder="Nome (ex: Cartão Nubank)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <input
              name="banco"
              placeholder="Banco/Bandeira"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="diaFechamento"
                type="number"
                min={1}
                max={31}
                placeholder="Dia fechamento"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="diaVencimento"
                type="number"
                min={1}
                max={31}
                placeholder="Dia vencimento"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              disabled={salvandoConta}
              className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {salvandoConta ? "Salvando..." : "Salvar cartão/conta"}
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Fluxo de caixa</h3>
          <p className="text-sm text-slate-400">Pagamentos a pagar/receber consolidados.</p>
          <p className="mt-4 text-sm text-slate-400">(Integre aqui a visão de fluxo)</p>
        </div>
      </div>
    </div>
  );
}