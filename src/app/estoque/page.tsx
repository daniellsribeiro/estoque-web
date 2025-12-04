"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type ProdutoResponse = {
  id: string;
  codigo: string;
  nome: string;
  tipo?: string;
  cor?: string;
  material?: string;
  tamanho?: string;
  quantidadeAtual?: number;
  atualizadoEm?: string;
  historico?: {
    quantidadeAnterior: number;
    quantidadeNova: number;
    quantidadeAdicionada: number;
    quantidadeSubtraida: number;
    motivo: string;
    referencia?: string;
    compraId?: string;
    vendaId?: string;
    dataMudanca?: string;
  } | null;
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoResponse[]>([]);
  const [busca, setBusca] = useState("");
  const [minAlerta, setMinAlerta] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [baixaProdutoId, setBaixaProdutoId] = useState("");
  const [baixaQtd, setBaixaQtd] = useState<string>("");
  const [baixaMotivo, setBaixaMotivo] = useState("BAIXA");
  const [baixaRef, setBaixaRef] = useState("");
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const data = await apiFetch<ProdutoResponse[]>("/produtos/estoque");
      setProdutos(data ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar estoque");
      setSucesso(null);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (!term) return true;
      const campos = [p.codigo, p.nome, p.tipo, p.cor, p.material, p.tamanho]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return campos.includes(term);
    });
  }, [produtos, busca]);

  const totalSkus = filtrados.length;
  const totalPecas = filtrados.reduce((acc, p) => acc + (p.quantidadeAtual ?? 0), 0);
  const baixos = filtrados.filter((p) => (p.quantidadeAtual ?? 0) <= minAlerta);

  const enviarBaixa = async () => {
    const qtd = Number(baixaQtd.replace(",", "."));
    if (!baixaProdutoId || !qtd || qtd <= 0) {
      setErro("Informe produto e quantidade maior que zero");
      setSucesso(null);
      return;
    }
    setErro(null);
    setSucesso(null);
    try {
      await apiFetch(`/produtos/${baixaProdutoId}/estoque/baixa`, {
        method: "POST",
        body: JSON.stringify({
          quantidade: qtd,
          motivo: baixaMotivo || "BAIXA",
          referencia: baixaRef || undefined,
        }),
      });
      setSucesso("Baixa registrada com sucesso");
      setBaixaQtd("");
      setBaixaRef("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar baixa");
    }
  };

  return (
    <ProtectedShell title="Estoque" subtitle="Acompanhe saldo dos itens e alertas de baixa.">
      {erro && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/40">
          {sucesso}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Registrar baixa</h3>
              <p className="text-sm text-slate-400">Selecione o produto e informe a quantidade a subtrair.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <select
              value={baixaProdutoId}
              onChange={(e) => setBaixaProdutoId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 md:col-span-2"
            >
              <option value="">Escolha o produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} - {p.nome}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              value={baixaQtd}
              onChange={(e) => setBaixaQtd(e.target.value)}
              placeholder="Quantidade"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <input
              value={baixaMotivo}
              onChange={(e) => setBaixaMotivo(e.target.value)}
              placeholder="Motivo"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <input
              value={baixaRef}
              onChange={(e) => setBaixaRef(e.target.value)}
              placeholder="Referência (opcional)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 md:col-span-2"
            />
            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={enviarBaixa}
                className="w-full rounded-lg bg-rose-500 px-3 py-2 font-semibold text-slate-50 transition hover:bg-rose-400"
              >
                Registrar baixa
              </button>
              <button
                onClick={() => {
                  setBaixaProdutoId("");
                  setBaixaQtd("");
                  setBaixaMotivo("BAIXA");
                  setBaixaRef("");
                }}
                className="w-full rounded-lg bg-slate-700 px-3 py-2 font-semibold text-slate-100 transition hover:bg-slate-600"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
            <p className="text-xs text-slate-400">SKUs listados</p>
            <p className="text-2xl font-semibold text-slate-50">{formatNumber(totalSkus)}</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
            <p className="text-xs text-slate-400">Peças em estoque</p>
            <p className="text-2xl font-semibold text-slate-50">{formatNumber(totalPecas)}</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
            <p className="text-xs text-slate-400">Itens em alerta</p>
            <p className="text-2xl font-semibold text-amber-300">{formatNumber(baixos.length)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Lista de estoque</h3>
              <p className="text-sm text-slate-400">
                Busque por nome, código ou atributos. Ajuste alerta de quantidade mínima.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={minAlerta}
                onChange={(e) => setMinAlerta(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
                title="Quantidade para alerta"
              />
              <button
                onClick={carregar}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 transition"
              >
                Atualizar
              </button>
            </div>
          </div>

          <input
            placeholder="Filtrar por nome, código ou observação"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
          />

          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
            {carregando ? (
              <div className="p-4 text-sm text-slate-300">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div className="p-4 text-sm text-slate-300">Nenhum item encontrado.</div>
            ) : (
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Cor</th>
                    <th className="px-4 py-2">Material</th>
                    <th className="px-4 py-2">Tam.</th>
                    <th className="px-4 py-2 text-right">Qtd.</th>
                    <th className="px-4 py-2 text-right">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => {
                    const qty = p.quantidadeAtual ?? 0;
                    const updated = p.atualizadoEm;
                    const alerta = qty <= minAlerta;
                    return (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2 font-mono text-xs text-slate-300">{p.codigo}</td>
                        <td className="px-4 py-2">{p.nome}</td>
                        <td className="px-4 py-2">{p.tipo ?? "-"}</td>
                        <td className="px-4 py-2">{p.cor ?? "-"}</td>
                        <td className="px-4 py-2">{p.material ?? "-"}</td>
                        <td className="px-4 py-2">{p.tamanho ?? "-"}</td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            alerta ? "text-amber-300" : "text-emerald-200"
                          }`}
                        >
                          {qty}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-slate-400">
                          {updated ? updated.slice(0, 10) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}
