"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Supplier = { id: string; nome: string };
type PaymentType = { id: string; descricao: string; parcelavel: boolean; minParcelas: number; maxParcelas: number };
type CardAccount = { id: string; nome: string; bandeira?: string };
type Product = { id: string; nome: string };
type Purchase = {
  id: string;
  data: string;
  fornecedor?: Supplier;
  tipoPagamento?: PaymentType;
  totalCompra: number;
  status: string;
};
type PurchasePayment = {
  id: string;
  compra: { id: string };
  nParcela: number;
  dataVencimento: string;
  valorParcela: number;
  statusPagamento: string;
};

const formatCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const padded = (digits || "0").padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decimal = padded.slice(-2);
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${decimal}`;
};
const parseCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const cents = parseInt(digits || "0", 10);
  return cents / 100;
};

type ItemInput = { produtoId: string; qtde: string; valorUnit: string };

export default function ComprasPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [compras, setCompras] = useState<Purchase[]>([]);
  const [pagamentos, setPagamentos] = useState<PurchasePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCompraId, setSelectedCompraId] = useState<string | null>(null);

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    fornecedorId: "",
    tipoPagamentoId: "",
    cartaoContaId: "",
    parcelas: 1,
    frete: "0,00",
    observacoes: "",
  });
  const [itens, setItens] = useState<ItemInput[]>([{ produtoId: "", qtde: "1", valorUnit: "0,00" }]);

  const totalItens = useMemo(
    () =>
      itens.reduce((acc, it) => {
        const qt = Number(it.qtde) || 0;
        const val = parseCurrency(it.valorUnit);
        return acc + qt * val;
      }, 0),
    [itens],
  );
  const totalCompra = useMemo(() => totalItens + parseCurrency(form.frete), [totalItens, form.frete]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [forn, tp, ca, prd, comp, pays] = await Promise.all([
        apiFetch<Supplier[]>("/produtos/fornecedores"),
        apiFetch<PaymentType[]>("/financeiro/tipos-pagamento"),
        apiFetch<CardAccount[]>("/financeiro/cartoes-contas"),
        apiFetch<Product[]>("/produtos"),
        apiFetch<Purchase[]>("/compras"),
        apiFetch<PurchasePayment[]>("/compras/pagamentos"),
      ]);
      setSuppliers(forn ?? []);
      setTypes(tp ?? []);
      setCards(ca ?? []);
      setProducts(prd ?? []);
      setCompras(comp ?? []);
      setPagamentos(pays ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit() {
    if (!form.fornecedorId || !form.tipoPagamentoId) {
      setError("Fornecedor e tipo de pagamento são obrigatórios.");
      return;
    }
    if (itens.some((it) => !it.produtoId)) {
      setError("Selecione todos os produtos nos itens.");
      return;
    }
    const body = {
      data: form.data,
      fornecedorId: form.fornecedorId,
      tipoPagamentoId: form.tipoPagamentoId,
      cartaoContaId: form.cartaoContaId || undefined,
      parcelas: form.parcelas,
      frete: parseCurrency(form.frete),
      observacoes: form.observacoes || undefined,
      itens: itens.map((it) => ({
        produtoId: it.produtoId,
        qtde: Number(it.qtde) || 0,
        valorUnit: parseCurrency(it.valorUnit),
      })),
    };
    await apiFetch("/compras", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setMessage("Compra registrada");
    setError(null);
    setItens([{ produtoId: "", qtde: "1", valorUnit: "0,00" }]);
    setForm((p) => ({ ...p, frete: "0,00", observacoes: "" }));
    await loadAll();
  }

  async function marcarParcelaPaga(id: string) {
    await apiFetch(`/compras/pagamentos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ statusPagamento: "paga", dataPagamento: new Date().toISOString() }),
    });
    await loadAll();
  }

  const parcelasSelecionadas = selectedCompraId
    ? pagamentos.filter((p) => p.compra.id === selectedCompraId)
    : [];

  return (
    <ProtectedShell title="Compras" subtitle="Pedidos e pagamentos">
      {message && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/40">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Nova compra</h3>
                <p className="text-sm text-slate-400">Itens, parcelas e fornecedor.</p>
              </div>
              <span className="text-sm text-slate-300">Total: R$ {totalCompra.toFixed(2)}</span>
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <select
                value={form.fornecedorId}
                onChange={(e) => setForm((p) => ({ ...p, fornecedorId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Fornecedor</option>
                {suppliers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <select
                value={form.tipoPagamentoId}
                onChange={(e) => setForm((p) => ({ ...p, tipoPagamentoId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Meio de pagamento</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao}
                  </option>
                ))}
              </select>
              <select
                value={form.cartaoContaId}
                onChange={(e) => setForm((p) => ({ ...p, cartaoContaId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Cartão/Conta (se cartão/link)</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.bandeira ? `(${c.bandeira})` : ""}
                  </option>
                ))}
              </select>
              <input
                value={form.parcelas}
                onChange={(e) => setForm((p) => ({ ...p, parcelas: Number(e.target.value) || 1 }))}
                placeholder="Parcelas"
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <input
              value={form.frete}
              onChange={(e) => setForm((p) => ({ ...p, frete: formatCurrency(e.target.value) }))}
              placeholder="Frete (R$)"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Observações"
                className="md:col-span-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Itens</p>
                <button
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                  onClick={() => setItens((arr) => [...arr, { produtoId: "", qtde: "1", valorUnit: "0,00" }])}
                >
                  Adicionar item
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {itens.map((it, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-4">
                    <select
                      value={it.produtoId}
                      onChange={(e) =>
                        setItens((arr) =>
                          arr.map((a, i) => (i === idx ? { ...a, produtoId: e.target.value } : a)),
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                    >
                      <option value="">Produto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                    <input
                      value={it.qtde}
                      onChange={(e) =>
                        setItens((arr) => arr.map((a, i) => (i === idx ? { ...a, qtde: e.target.value } : a)))
                      }
                      placeholder="Qtde"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                    />
                    <input
                      value={it.valorUnit}
                      onChange={(e) =>
                        setItens((arr) =>
                          arr.map((a, i) => (i === idx ? { ...a, valorUnit: formatCurrency(e.target.value) } : a)),
                        )
                      }
                      placeholder="Valor unitário"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                    />
                    <div className="flex items-center justify-between md:justify-end md:gap-2">
                      <span className="text-slate-400">
                        R$ {(Number(it.qtde || 0) * parseCurrency(it.valorUnit)).toFixed(2)}
                      </span>
                      {itens.length > 1 && (
                        <button
                          className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                          onClick={() => setItens((arr) => arr.filter((_, i) => i !== idx))}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={async () => {
                  try {
                    await handleSubmit();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erro ao salvar compra");
                  }
                }}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
              >
                Salvar compra
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <h3 className="text-lg font-semibold text-slate-50">Compras</h3>
            <p className="text-sm text-slate-400">Selecione para ver parcelas.</p>
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
              {loading ? (
                <div className="p-3 text-sm text-slate-400">Carregando...</div>
              ) : compras.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">Nenhuma compra.</div>
              ) : (
                <table className="min-w-full text-sm text-slate-200">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Data</th>
                      <th className="px-4 py-2">Fornecedor</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Parcelas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{c.data?.slice(0, 10) ?? ""}</td>
                        <td className="px-4 py-2">{c.fornecedor?.nome ?? "-"}</td>
                        <td className="px-4 py-2">{c.tipoPagamento?.descricao ?? "-"}</td>
                        <td className="px-4 py-2">R$ {Number(c.totalCompra || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 capitalize">{c.status}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                            onClick={() => setSelectedCompraId(c.id)}
                          >
                            Ver parcelas
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <h3 className="text-lg font-semibold text-slate-50">Parcelas</h3>
            <p className="text-sm text-slate-400">
              {selectedCompraId ? "Parcela da compra selecionada." : "Selecione uma compra para ver parcelas."}
            </p>
            <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
              {!selectedCompraId ? (
                <div className="p-3 text-slate-400">Nenhuma compra selecionada.</div>
              ) : parcelasSelecionadas.length === 0 ? (
                <div className="p-3 text-slate-400">Sem parcelas cadastradas.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Parcela</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelasSelecionadas.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{p.nParcela}</td>
                        <td className="px-4 py-2">{p.dataVencimento?.slice(0, 10) ?? ""}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 capitalize">{p.statusPagamento}</td>
                        <td className="px-4 py-2 text-right">
                          {p.statusPagamento !== "paga" && (
                            <button
                              className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-400"
                              onClick={() => marcarParcelaPaga(p.id)}
                            >
                              Marcar paga
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}
