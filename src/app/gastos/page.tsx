"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Supplier = { id: string; nome: string; principal?: boolean };
type PaymentType = { id: string; descricao: string };
type CardAccount = {
  id: string;
  nome: string;
  pixChave?: string | null;
  diaFechamento?: number | null;
  diaVencimento?: number | null;
};
type Expense = {
  id: string;
  data: string;
  descricao?: string | null;
  fornecedor?: Supplier | null;
  tipoPagamento: PaymentType;
  cartaoConta?: CardAccount | null;
  parcelas: number;
  totalCompra: number;
  status: string;
  observacao?: string | null;
  observacoes?: string | null;
  itens?: Array<{ id?: string; descricaoItem?: string; qtde?: number | null; valorUnit?: number | null; valorTotal?: number | null }>;
  pagamentos?: ExpensePayment[];
};
type ExpensePayment = {
  id: string;
  gasto: { id: string };
  nParcela: number;
  dataVencimento: string | null;
  valorParcela: number;
  valorCompra?: number | null;
  statusPagamento: string;
  cartaoConta?: { id: string; nome?: string | null };
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

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

type ItemInput = { descricao: string; qtde: string; valorUnit: string };

export default function GastosPage() {
  const makeInitialForm = () => ({
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    tipoPagamentoId: "",
    cartaoContaId: "",
    fornecedorId: "",
    parcelas: 1,
    total: "0,00",
    observacoes: "",
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fornecedorBusca, setFornecedorBusca] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState({
    nome: "",
    telefone: "",
    email: "",
    endereco: "",
    observacoes: "",
    principal: false,
  });
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [gastos, setGastos] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detalhesGastoId, setDetalhesGastoId] = useState<string | null>(null);
  const [detalheGasto, setDetalheGasto] = useState<Expense | null>(null);
  const [pagamentosGasto, setPagamentosGasto] = useState<ExpensePayment[]>([]);
  const [pagamentosLoading, setPagamentosLoading] = useState(false);
  const [filtroDescricao, setFiltroDescricao] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [filtroDataFim, setFiltroDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [filtroFornecedorId, setFiltroFornecedorId] = useState("");
  const [filtroTipoPagamentoId, setFiltroTipoPagamentoId] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [form, setForm] = useState(makeInitialForm());
  const [itens, setItens] = useState<ItemInput[]>([{ descricao: "", qtde: "1", valorUnit: "0,00" }]);
  const [mostrarNovoGasto, setMostrarNovoGasto] = useState(false);

  const totalGasto = useMemo(
    () =>
      itens.reduce((sum, it) => {
        const qtd = Number(it.qtde || "0");
        const valor = parseCurrency(it.valorUnit);
        return sum + qtd * valor;
      }, parseCurrency(form.total)),
    [itens, form.total],
  );

  const tipoSelecionado = useMemo(() => types.find((t) => t.id === form.tipoPagamentoId), [types, form.tipoPagamentoId]);
  const tipoDesc = (tipoSelecionado?.descricao || "").toLowerCase();
  const isCredito = useMemo(() => ["cr", "cred", "credito", "crédito"].some((k) => tipoDesc.includes(k)), [tipoDesc]);
  const requiresCard = useMemo(
    () => ["pix", "debito", "débito", "credito", "crédito"].some((k) => tipoDesc.includes(k)) && !tipoDesc.includes("dinheiro"),
    [tipoDesc],
  );

  const filteredCards = useMemo(() => {
    if (!requiresCard) return [];
    if (tipoDesc.includes("pix")) return cards.filter((c) => !!c.pixChave);
    if (isCredito) return cards.filter((c) => c.diaFechamento != null && c.diaVencimento != null);
    return cards;
  }, [cards, requiresCard, tipoDesc, isCredito]);

  const filterState = {
    descricao: filtroDescricao.trim(),
    dataInicio: filtroDataInicio,
    dataFim: filtroDataFim,
    fornecedorId: filtroFornecedorId,
    tipoPagamentoId: filtroTipoPagamentoId,
    status: filtroStatus,
  };

  const fornecedoresFiltrados = useMemo(() => {
    const term = fornecedorBusca.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((f) => f.nome.toLowerCase().includes(term));
  }, [fornecedorBusca, suppliers]);
  const statusOptions = useMemo(() => {
    const base = ["pendente", "pago", "cancelado"];
    const extra = gastos.map((g) => (g.status || "").toLowerCase()).filter(Boolean);
    return Array.from(new Set([...base, ...extra]));
  }, [gastos]);

  const buildGastosQuery = (override?: Partial<typeof filterState>) => {
    const filters = { ...filterState, ...override };
    const params = new URLSearchParams();
    if (filters.descricao) params.append("descricao", filters.descricao);
    if (filters.dataInicio) params.append("dataInicio", filters.dataInicio);
    if (filters.dataFim) params.append("dataFim", filters.dataFim);
    if (filters.fornecedorId) params.append("fornecedorId", filters.fornecedorId);
    if (filters.tipoPagamentoId) params.append("tipoPagamentoId", filters.tipoPagamentoId);
    if (filters.tipoPagamentoId) params.append("tipoPagamento", filters.tipoPagamentoId);
    if (filters.status) params.append("status", filters.status);
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const loadBases = async () => {
    try {
      const [forn, tp, ca] = await Promise.all([
        apiFetch<Supplier[]>("/produtos/fornecedores"),
        apiFetch<PaymentType[]>("/financeiro/tipos-pagamento"),
        apiFetch<CardAccount[]>("/financeiro/cartoes-contas"),
      ]);
      setSuppliers(forn || []);
      setTypes(tp || []);
      setCards(ca || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    }
  };

  const loadGastos = async (overrideFilters?: Partial<typeof filterState>) => {
    try {
      setLoading(true);
      const query = buildGastosQuery(overrideFilters);
      const [gs] = await Promise.all([apiFetch<Expense[]>(`/gastos${query}`)]);
      setGastos(gs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadBases();
      await loadGastos();
    })();
  }, []);

  useEffect(() => {
    void loadGastos();
  }, [filtroDescricao, filtroDataInicio, filtroDataFim, filtroFornecedorId, filtroTipoPagamentoId, filtroStatus]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      fornecedorId: p.fornecedorId || suppliers[0]?.id || "",
    }));
  }, [suppliers]);

  useEffect(() => {
    if (!requiresCard) {
      setForm((p) => ({ ...p, cartaoContaId: "" }));
    }
  }, [requiresCard]);

  const handleSubmit = async () => {
    if (!form.tipoPagamentoId) {
      setError("Tipo de pagamento é obrigatório.");
      return;
    }
    if (requiresCard && !form.cartaoContaId) {
      setError("Selecione um cartão/conta para este gasto.");
      return;
    }
    if (isCredito && (!form.parcelas || form.parcelas < 1)) {
      setError("Informe o número de parcelas para crédito.");
      return;
    }
    const body = {
      data: form.data,
      descricao: form.descricao || undefined,
      fornecedorId: form.fornecedorId || undefined,
      tipoPagamentoId: form.tipoPagamentoId,
      cartaoContaId: requiresCard ? form.cartaoContaId : undefined,
      parcelas: isCredito ? form.parcelas : 1,
      totalCompra: totalGasto,
      observacoes: form.observacoes || undefined,
      itens: itens.map((it) => ({
        descricao: it.descricao || "Item",
        qtde: Number(it.qtde) || 0,
        valorUnit: parseCurrency(it.valorUnit),
      })),
    };
    try {
      setError(null);
      await apiFetch("/gastos", { method: "POST", body: JSON.stringify(body) });
      setMessage("Gasto registrado");
      setItens([{ descricao: "", qtde: "1", valorUnit: "0,00" }]);
      setForm((p) => ({ ...p, total: "0,00", descricao: "", observacoes: "" }));
      await loadGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar gasto");
      setMessage(null);
    }
  };

  const salvarFornecedor = async () => {
    if (!novoFornecedor.nome.trim()) {
      setError("Informe o nome do fornecedor.");
      return;
    }
    if (novoFornecedor.email && !isValidEmail(novoFornecedor.email)) {
      setError("Email inválido.");
      return;
    }
    setSalvandoFornecedor(true);
    setMessage(null);
    try {
      const body = {
        nome: novoFornecedor.nome.trim(),
        telefone: novoFornecedor.telefone.trim() || undefined,
        email: novoFornecedor.email.trim() || undefined,
        endereco: novoFornecedor.endereco.trim() || undefined,
        observacoes: novoFornecedor.observacoes.trim() || undefined,
        principal: novoFornecedor.principal,
      };
      const criado = await apiFetch<Supplier>("/produtos/fornecedores", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const lista = await apiFetch<Supplier[]>("/produtos/fornecedores");
      const atualizada = lista ?? [];
      setSuppliers(atualizada);
      const novoId = criado?.id ?? atualizada.find((s) => s.nome === body.nome)?.id ?? "";
      setForm((p) => ({ ...p, fornecedorId: novoId || p.fornecedorId }));
      setShowSupplierModal(false);
      setFornecedorBusca("");
      setNovoFornecedor({ nome: "", telefone: "", email: "", endereco: "", observacoes: "", principal: false });
      setMessage("Fornecedor cadastrado com sucesso.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fornecedor");
    } finally {
      setSalvandoFornecedor(false);
    }
  };

  const gastosFiltrados = gastos;
  const pagamentosSelecionados = pagamentosGasto;
  const gastoSelecionado = useMemo(() => {
    if (detalheGasto) return detalheGasto;
    return detalhesGastoId ? gastos.find((g) => g.id === detalhesGastoId) || null : null;
  }, [detalheGasto, detalhesGastoId, gastos]);
  const resetGastoForm = () => {
    setForm(makeInitialForm());
    setItens([{ descricao: "", qtde: "1", valorUnit: "0,00" }]);
    setMostrarNovoGasto(false);
    setError(null);
  };
  const abrirDetalhesGasto = async (id: string) => {
    setDetalhesGastoId(id);
    setPagamentosLoading(true);
    try {
      const data = await apiFetch<Expense>(`/gastos/${id}`);
      setDetalheGasto(data || null);
      setPagamentosGasto(data?.pagamentos || []);
      setError(null);
    } catch (err) {
      setDetalheGasto(null);
      setPagamentosGasto([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar detalhes do gasto");
    } finally {
      setPagamentosLoading(false);
    }
  };

  const resetFiltros = () => {
    const d = new Date();
    const fim = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - 30);
    const ini = d.toISOString().slice(0, 10);
    setFiltroDescricao("");
    setFiltroDataInicio(ini);
    setFiltroDataFim(fim);
    setFiltroFornecedorId("");
    setFiltroTipoPagamentoId("");
    setFiltroStatus("");
    return {
      descricao: "",
      dataInicio: ini,
      dataFim: fim,
      fornecedorId: "",
      tipoPagamentoId: "",
      status: "",
    };
  };

  return (
    <ProtectedShell title="Gastos" subtitle="Despesas operacionais e pagamentos em cartão/PIX.">
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

        {mostrarNovoGasto && (
        <div className="mt-4 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Novo gasto</h3>
              <p className="text-sm text-slate-400">Registre despesas como embalagens, tags, serviços etc.</p>
            </div>
            <div className="text-right text-sm text-slate-300">Total: R$ {totalGasto.toFixed(2)}</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Data</span>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Descrição</span>
              <input
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex.: Embalagens, tags..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Forma de pagamento</span>
              <select
                value={form.tipoPagamentoId}
                onChange={(e) => setForm((p) => ({ ...p, tipoPagamentoId: e.target.value, cartaoContaId: "" }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Selecione</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Parcelas (crédito)</span>
              <input
                value={form.parcelas}
                onChange={(e) => setForm((p) => ({ ...p, parcelas: Number(e.target.value) || 1 }))}
                disabled={!isCredito}
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Cartão/Conta (quando necessário)</span>
              <select
                value={form.cartaoContaId}
                onChange={(e) => setForm((p) => ({ ...p, cartaoContaId: e.target.value }))}
                disabled={!requiresCard}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 disabled:opacity-60"
              >
                <option value="">Selecione</option>
                {filteredCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Valor total</span>
              <input
                value={form.total}
                onChange={(e) => setForm((p) => ({ ...p, total: formatCurrency(e.target.value) }))}
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
            <label className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Fornecedor (opcional)</span>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-100"
                >
                  + adicionar
                </button>
              </div>
              <input
                placeholder="Buscar fornecedor"
                value={fornecedorBusca}
                onChange={(e) => setFornecedorBusca(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
              />
              <select
                value={form.fornecedorId}
                onChange={(e) => setForm((p) => ({ ...p, fornecedorId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Selecione o fornecedor (opcional)</option>
                {fornecedoresFiltrados.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Observações</span>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                className="min-h-[96px] w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Itens (opcional)</p>
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => setItens((arr) => [...arr, { descricao: "", qtde: "1", valorUnit: "0,00" }])}
              >
                Adicionar item
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {itens.map((it, idx) => (
                <div key={idx} className="grid items-start gap-2 md:grid-cols-4">
                  <input
                    value={it.descricao}
                    onChange={(e) =>
                      setItens((arr) => arr.map((a, i) => (i === idx ? { ...a, descricao: e.target.value } : a)))
                    }
                    placeholder="Descrição"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 md:col-span-2"
                  />
                  <input
                    value={it.qtde}
                    onChange={(e) =>
                      setItens((arr) => arr.map((a, i) => (i === idx ? { ...a, qtde: e.target.value } : a)))
                    }
                    placeholder="Qtde"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={it.valorUnit}
                      onChange={(e) =>
                        setItens((arr) =>
                          arr.map((a, i) => (i === idx ? { ...a, valorUnit: formatCurrency(e.target.value) } : a)),
                        )
                      }
                      placeholder="Valor unitário (R$)"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                    />
                    {itens.length > 1 && (
                      <button
                        className="flex-shrink-0 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
                        onClick={() => setItens((arr) => arr.filter((_, i) => i !== idx))}
                        type="button"
                        title="Remover item"
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
                type="button"
                onClick={resetGastoForm}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-rose-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="ml-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
              >
                Salvar gasto
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Gastos</h3>
              <p className="text-sm text-slate-400">Selecione para ver detalhes e parcelas.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMostrarNovoGasto((v) => !v)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500"
              >
                {mostrarNovoGasto ? "Fechar novo gasto" : "Adicionar novo gasto"}
              </button>
              <button
                type="button"
                onClick={() => void (async () => {
                  await loadBases();
                  await loadGastos();
                })()}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400"
              >
                Atualizar
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Descrição</span>
              <input
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value)}
                placeholder="Ex.: Tag, frete..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Data inicial</span>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Data final</span>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Fornecedor</span>
              <select
                value={filtroFornecedorId}
                onChange={(e) => setFiltroFornecedorId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Todos</option>
                {suppliers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Tipo de pagamento</span>
              <select
                value={filtroTipoPagamentoId}
                onChange={(e) => setFiltroTipoPagamentoId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Todos</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Status</span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Todos</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
            {loading ? (
              <div className="p-3 text-sm text-slate-400">Carregando...</div>
            ) : gastosFiltrados.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">Nenhum gasto.</div>
            ) : (
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Descrição</th>
                    <th className="px-4 py-2">Fornecedor</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFiltrados.map((g) => (
                    <tr key={g.id} className="border-t border-slate-800">
                      <td className="px-4 py-2">{g.data.slice(0, 10) || ""}</td>
                      <td className="px-4 py-2">{g.descricao || "-"}</td>
                      <td className="px-4 py-2">{g.fornecedor?.nome || "-"}</td>
                      <td className="px-4 py-2">{g.tipoPagamento?.descricao || "-"}</td>
                      <td className="px-4 py-2">R$ {Number(g.totalCompra || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 capitalize">{g.status}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => void abrirDetalhesGasto(g.id)}
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Novo fornecedor</p>
                <p className="text-xs text-slate-400">Cadastre e selecione para este gasto.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <input
                value={novoFornecedor.nome}
                onChange={(e) => setNovoFornecedor((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome*"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={novoFornecedor.telefone}
                onChange={(e) => setNovoFornecedor((p) => ({ ...p, telefone: maskPhone(e.target.value) }))}
                placeholder="Telefone"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={novoFornecedor.email}
                onChange={(e) => setNovoFornecedor((p) => ({ ...p, email: e.target.value }))}
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={novoFornecedor.endereco}
                onChange={(e) => setNovoFornecedor((p) => ({ ...p, endereco: e.target.value }))}
                placeholder="Endereço"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <textarea
                value={novoFornecedor.observacoes}
                onChange={(e) => setNovoFornecedor((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Observações"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={novoFornecedor.principal}
                  onChange={(e) => setNovoFornecedor((p) => ({ ...p, principal: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400"
                />
                <span>Fornecedor principal</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSupplierModal(false);
                  setNovoFornecedor({ nome: "", telefone: "", email: "", endereco: "", observacoes: "", principal: false });
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvarFornecedor()}
                disabled={salvandoFornecedor}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {salvandoFornecedor ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhesGastoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Detalhes do gasto</p>
                <p className="text-xs text-slate-400">
                  {gastoSelecionado?.descricao || "Sem descricao"} -{" "}
                  {gastoSelecionado?.data ? new Date(gastoSelecionado.data).toLocaleDateString() : "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetalhesGastoId(null);
                  setDetalheGasto(null);
                  setPagamentosGasto([]);
                  setPagamentosLoading(false);
                }}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>

            {gastoSelecionado && (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="text-lg font-semibold text-emerald-300">
                      R$ {Number(gastoSelecionado.totalCompra || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Parcelas</div>
                    <div className="text-lg font-semibold text-slate-100">{gastoSelecionado.parcelas}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Status</div>
                    <div className="text-lg font-semibold text-slate-100 capitalize">{gastoSelecionado.status}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Forma de pagamento</div>
                    <div className="text-sm font-semibold text-slate-100">{gastoSelecionado.tipoPagamento?.descricao || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Cartao/Conta</div>
                    <div className="text-sm font-semibold text-slate-100">{gastoSelecionado.cartaoConta?.nome || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-xs text-slate-400">Fornecedor</div>
                    <div className="text-sm font-semibold text-slate-100">{gastoSelecionado.fornecedor?.nome || "-"}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                  <div className="text-xs text-slate-400">Observações</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-100">
                    {(gastoSelecionado.observacoes ?? gastoSelecionado.observacao ?? "").trim() || "Sem observações."}
                  </div>
                </div>
              </>
            )}

            {gastoSelecionado?.itens?.length ? (
              <>
                <div className="mt-4 text-xs uppercase tracking-wide text-slate-400">Itens</div>
                <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
                  <table className="min-w-full">
                    <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Qtde</th>
                        <th className="px-4 py-2">Valor unit.</th>
                        <th className="px-4 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastoSelecionado.itens.map((it, idx) => (
                        <tr key={it.id || idx} className="border-t border-slate-800">
                          <td className="px-4 py-2">{it.descricaoItem || "-"}</td>
                          <td className="px-4 py-2">{it.qtde ?? "-"}</td>
                          <td className="px-4 py-2">R$ {Number(it.valorUnit || 0).toFixed(2)}</td>
                          <td className="px-4 py-2">R$ {Number(it.valorTotal || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wide text-slate-400">Parcelas</div>
              <div className="mt-1 max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
              {pagamentosLoading ? (
                <div className="p-3 text-slate-400">Carregando parcelas...</div>
              ) : pagamentosSelecionados.length === 0 ? (
                <div className="p-3 text-slate-400">Sem parcelas cadastradas.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Parcela</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Valor compra</th>
                      <th className="px-4 py-2">Cartão/Conta</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosSelecionados.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{p.nParcela}</td>
                        <td className="px-4 py-2">{p.dataVencimento ? p.dataVencimento.slice(0, 10) : "-"}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorCompra || p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2">{p.cartaoConta?.nome || "-"}</td>
                        <td className="px-4 py-2 capitalize">{p.statusPagamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
