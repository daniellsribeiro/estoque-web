"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Supplier = { id: string; nome: string };
type PaymentType = { id: string; descricao: string; parcelavel?: boolean; minParcelas?: number; maxParcelas?: number };
type CardAccount = {
  id: string;
  nome: string;
  bandeira?: string | null;
  banco?: string | null;
  pixChave?: string | null;
  diaFechamento?: number | null;
  diaVencimento?: number | null;
};
type ProductAttr = { id: string; nome: string };
type Product = { id: string; nome: string; tipo?: ProductAttr | null; cor?: ProductAttr | null; material?: ProductAttr | null };
type Purchase = {
  id: string;
  data: string;
  fornecedor: Supplier;
  tipoPagamento: PaymentType;
  totalCompra: number;
  status: string;
};
type PurchaseDetail = Purchase & {
  observacoes?: string | null;
  parcelas: number;
  cartaoConta?: CardAccount | null;
  itens?: { id: string; qtde: number; valorUnit: number; valorTotal: number; item?: { nome: string; codigo: string } }[];
};
type PurchasePayment = {
  id: string;
  compra: { id: string };
  nParcela: number;
  dataVencimento: string | null;
  valorParcela: number;
  statusPagamento: string;
  cartaoConta?: { id: string; nome?: string | null; bandeira?: string | null; banco?: string | null; pixChave?: string | null };
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

const onlyNumbers = (value: string) => value.replace(/[^0-9]/g, "");
const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

type ItemInput = { produtoId: string; qtde: string; valorUnit: string; search: string };

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
  const [parcelasCompraId, setParcelasCompraId] = useState<string | null>(null);
  const [showZeroModal, setShowZeroModal] = useState(false);
  const [detalheCompra, setDetalheCompra] = useState<PurchaseDetail | null>(null);
  const [detalheCarregando, setDetalheCarregando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCor, setFiltroCor] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [fornecedorBusca, setFornecedorBusca] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState({
    nome: "",
    telefone: "",
    email: "",
    endereco: "",
    observacoes: "",
  });
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    fornecedorId: "",
    tipoPagamentoId: "",
    cartaoContaId: "",
    parcelas: 1,
    total: "0,00",
    observacoes: "",
  });

  const [itens, setItens] = useState<ItemInput[]>([{ produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }]);

  const totalCompra = useMemo(() => parseCurrency(form.total), [form.total]);
  const totalCompraZerado = totalCompra === 0;

  const tipoSelecionado = useMemo(() => types.find((t) => t.id === form.tipoPagamentoId), [types, form.tipoPagamentoId]);
  const tipoDesc = (tipoSelecionado?.descricao || "").toLowerCase();
  const isCredito = useMemo(
    () => ["cr", "cred", "crédito", "credito"].some((k) => tipoDesc.includes(k)),
    [tipoDesc],
  );
  const requiresCard = useMemo(
    () =>
      ["pix", "debito", "débito", "credito", "crédito"].some((k) => tipoDesc.includes(k)) &&
      !tipoDesc.includes("dinheiro"),
    [tipoDesc],
  );

  const filteredCards = useMemo(() => {
    if (!requiresCard) return [];
    if (tipoDesc.includes("pix")) return cards.filter((c) => !!c.pixChave);
    if (isCredito) return cards.filter((c) => c.diaFechamento != null && c.diaVencimento != null);
    // débito ou genérico que exige cartão
    return cards;
  }, [cards, requiresCard, tipoDesc, isCredito]);

  const tiposFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => {
      if (p.tipo) map.set(p.tipo.id, p.tipo);
    });
    return Array.from(map.values());
  }, [products]);
  const coresFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => {
      if (p.cor) map.set(p.cor.id, p.cor);
    });
    return Array.from(map.values());
  }, [products]);
  const materiaisFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => {
      if (p.material) map.set(p.material.id, p.material);
    });
    return Array.from(map.values());
  }, [products]);
  const fornecedoresFiltrados = useMemo(() => {
    const term = fornecedorBusca.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((f) => f.nome.toLowerCase().includes(term));
  }, [fornecedorBusca, suppliers]);

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
      setSuppliers(forn || []);
      setTypes(tp || []);
      setCards(ca || []);
      setProducts(prd || []);
      setCompras(comp || []);
      setPagamentos(pays || []);
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

  useEffect(() => {
    if (!requiresCard) {
      setForm((p) => ({ ...p, cartaoContaId: "" }));
    }
  }, [requiresCard]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      fornecedorId: p.fornecedorId || suppliers[0]?.id || "",
      tipoPagamentoId: p.tipoPagamentoId || types[0]?.id || "",
    }));
  }, [suppliers, types]);

  async function salvarFornecedor() {
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
      };
      const criado = await apiFetch<Supplier>("/produtos/fornecedores", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const lista = await apiFetch<Supplier[]>("/produtos/fornecedores");
      setSuppliers(lista ?? []);
      const novoId = criado?.id ?? lista?.find((s) => s.nome === body.nome)?.id ?? "";
      setForm((p) => ({ ...p, fornecedorId: novoId || p.fornecedorId }));
      setShowSupplierModal(false);
      setFornecedorBusca("");
      setNovoFornecedor({ nome: "", telefone: "", email: "", endereco: "", observacoes: "" });
      setMessage("Fornecedor cadastrado com sucesso.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fornecedor");
    } finally {
      setSalvandoFornecedor(false);
    }
  }

  async function handleSubmit(forceZero?: boolean) {
    if (!form.fornecedorId || !form.tipoPagamentoId) {
      setError("Fornecedor e tipo de pagamento são obrigatórios.");
      return;
    }
    if (requiresCard && !form.cartaoContaId) {
      setError("Selecione um cartão/conta para este meio de pagamento.");
      return;
    }
    if (isCredito && (!form.parcelas || form.parcelas < 1)) {
      setError("Informe o número de parcelas para crédito.");
      return;
    }
    if (itens.some((it) => !it.produtoId)) {
      setError("Selecione todos os produtos nos itens.");
      return;
    }
    const valorUnitZero = itens.some((it) => parseCurrency(it.valorUnit) <= 0);
    if ((totalCompra <= 0 || valorUnitZero) && !forceZero) {
      setShowZeroModal(true);
      return;
    }

    const body = {
      data: form.data,
      fornecedorId: form.fornecedorId,
      tipoPagamentoId: form.tipoPagamentoId,
      cartaoContaId: requiresCard ? form.cartaoContaId : undefined,
      parcelas: isCredito ? form.parcelas : 1,
      totalCompra,
      observacoes: form.observacoes || undefined,
      itens: itens.map((it) => ({
        produtoId: it.produtoId,
        qtde: Number(it.qtde) || 0,
        valorUnit: parseCurrency(it.valorUnit),
      })),
    };

    await apiFetch("/compras", { method: "POST", body: JSON.stringify(body) });
    setMessage("Compra registrada");
    setError(null);
    setItens([{ produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }]);
    setForm((p) => ({ ...p, total: "0,00", observacoes: "" }));
    await loadAll();
  }

  const parcelasSelecionadas = parcelasCompraId ? pagamentos.filter((p) => p.compra.id === parcelasCompraId) : [];
  const compraSelecionada = useMemo(() => compras.find((c) => c.id === parcelasCompraId), [compras, parcelasCompraId]);

  const abrirDetalheCompra = async (id: string) => {
    setDetalheCarregando(true);
    setDetalheCompra(null);
    try {
      const data = await apiFetch<PurchaseDetail>(`/compras/${id}`);
      setDetalheCompra(data ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar detalhes da compra");
    } finally {
      setDetalheCarregando(false);
    }
  };

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

      <div className="space-y-6">
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Nova compra</h3>
                <p className="text-sm text-slate-400">Itens, parcelas e fornecedor.</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-300 block">Total: R$ {totalCompra.toFixed(2)}</span>
                {totalCompraZerado && (
                  <span className="text-xs text-amber-300">Valor total zerado — confirme se está correto.</span>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
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
                  <span className="text-xs text-slate-400">Valor total (considera taxas do crédito)</span>
                  <input
                    value={form.total}
                    onChange={(e) => setForm((p) => ({ ...p, total: formatCurrency(e.target.value) }))}
                    placeholder="Valor total (R$)"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 items-end">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Meio de pagamento</span>
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
                  <span className="text-xs text-slate-400">Cartão/Conta</span>
                  <select
                    value={form.cartaoContaId}
                    onChange={(e) => setForm((p) => ({ ...p, cartaoContaId: e.target.value }))}
                    disabled={!requiresCard}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 disabled:opacity-60"
                  >
                    <option value="">
                      {tipoDesc.includes("pix")
                        ? "Selecione cartão com PIX"
                        : isCredito
                          ? "Selecione cartão com fechamento/vencimento"
                          : "Selecione cartão/conta (quando necessário)"}
                    </option>
                    {filteredCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.bandeira ? `(${c.bandeira})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isCredito && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs text-slate-400">Parcelas (somente crédito)</label>
                    <input
                      value={form.parcelas}
                      onChange={(e) => setForm((p) => ({ ...p, parcelas: Number(e.target.value) || 1 }))}
                      placeholder="Parcelas"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <label className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Fornecedor</span>
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
                  <option value="">Selecione o fornecedor</option>
                  {fornecedoresFiltrados.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-1">
                <span className="text-slate-300">Observações</span>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Observações"
                  className="min-h-[104px] w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Itens</p>
                <button
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                  onClick={() => setItens((arr) => [...arr, { produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }])}
                >
                  Adicionar item
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
                >
                  <option value="">Tipo</option>
                  {tiposFiltro.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={filtroCor}
                  onChange={(e) => setFiltroCor(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
                >
                  <option value="">Cor</option>
                  {coresFiltro.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={filtroMaterial}
                  onChange={(e) => setFiltroMaterial(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
                >
                  <option value="">Material</option>
                  {materiaisFiltro.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 space-y-3">
                {itens.map((it, idx) => {
                  const termo = (it.search || "").toLowerCase();
                  const filtradosBase = products.filter((p) => {
                    const matchesNome = p.nome.toLowerCase().includes(termo);
                    const matchesTipo = !filtroTipo || p.tipo?.id === filtroTipo;
                    const matchesCor = !filtroCor || p.cor?.id === filtroCor;
                    const matchesMaterial = !filtroMaterial || p.material?.id === filtroMaterial;
                    return matchesNome && matchesTipo && matchesCor && matchesMaterial;
                  });
                  const produtoSelecionado = products.find((p) => p.id === it.produtoId);
                  const filtrados =
                    produtoSelecionado && !filtradosBase.some((p) => p.id === produtoSelecionado.id)
                      ? [produtoSelecionado, ...filtradosBase]
                      : filtradosBase;
                  return (
                    <div key={idx} className="grid gap-2 md:grid-cols-5">
                      <div className="md:col-span-2 space-y-1">
                        <input
                          value={it.search || ""}
                          onChange={(e) =>
                            setItens((arr) => arr.map((a, i) => (i === idx ? { ...a, search: e.target.value } : a)))
                          }
                          placeholder="Buscar produto pelo nome"
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                        />
                        <select
                          value={it.produtoId}
                          onChange={(e) =>
                            setItens((arr) =>
                              arr.map((a, i) => (i === idx ? { ...a, produtoId: e.target.value, search: a.search } : a)),
                            )
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                        >
                          <option value="">Selecione o produto</option>
                          {filtrados.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        value={it.qtde}
                        onChange={(e) =>
                          setItens((arr) =>
                            arr.map((a, i) =>
                              i === idx ? { ...a, qtde: onlyNumbers(e.target.value) || "0" } : a,
                            ),
                          )
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
                        placeholder="Valor unitário (R$)"
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
                  );
                })}
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
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{c.data.slice(0, 10) || ""}</td>
                        <td className="px-4 py-2">{c.fornecedor.nome || "-"}</td>
                        <td className="px-4 py-2">{c.tipoPagamento.descricao || "-"}</td>
                        <td className="px-4 py-2">R$ {Number(c.totalCompra || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 capitalize">{c.status}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                              onClick={() => abrirDetalheCompra(c.id)}
                            >
                              Detalhes
                            </button>
                            <button
                              className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                              onClick={() => setParcelasCompraId(c.id)}
                            >
                              Parcelas
                            </button>
                          </div>
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

      {(detalheCompra || detalheCarregando) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Detalhes da compra</p>
                {detalheCompra?.id && <p className="text-xs text-slate-400">ID: {detalheCompra.id}</p>}
              </div>
              <button
                type="button"
                onClick={() => setDetalheCompra(null)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>

            {detalheCarregando ? (
              <p className="mt-4 text-slate-300">Carregando...</p>
            ) : detalheCompra ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Fornecedor</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.fornecedor?.nome ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Tipo de pagamento</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.tipoPagamento?.descricao ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Data</p>
                    <p className="font-semibold text-slate-50">
                      {detalheCompra.data ? detalheCompra.data.slice(0, 10) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Parcelas</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.parcelas ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Cartão/Conta</p>
                    <p className="font-semibold text-slate-50">
                      {detalheCompra.cartaoConta?.nome ??
                        detalheCompra.cartaoConta?.bandeira ??
                        detalheCompra.cartaoConta?.banco ??
                        "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="font-semibold text-slate-50 capitalize">{detalheCompra.status}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-slate-50">R$ {Number(detalheCompra.totalCompra || 0).toFixed(2)}</p>
                  {detalheCompra.observacoes && (
                    <p className="mt-2 text-xs text-slate-400">Obs: {detalheCompra.observacoes}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-400">Itens</p>
                  {detalheCompra.itens && detalheCompra.itens.length > 0 ? (
                    <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Produto</th>
                            <th className="px-3 py-2 text-right">Qtd</th>
                            <th className="px-3 py-2 text-right">Unit</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalheCompra.itens.map((it) => (
                            <tr key={it.id} className="border-t border-slate-800">
                              <td className="px-3 py-2">
                                {it.item?.nome ?? "-"} {it.item?.codigo ? `(${it.item.codigo})` : ""}
                              </td>
                              <td className="px-3 py-2 text-right">{it.qtde}</td>
                              <td className="px-3 py-2 text-right">R$ {Number(it.valorUnit || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">R$ {Number(it.valorTotal || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-300">Nenhum item listado.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-rose-200">Compra não encontrada.</p>
            )}
          </div>
        </div>
      )}

      {parcelasCompraId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Parcelas da compra</p>
                <p className="text-xs text-slate-400">
                  {compraSelecionada
                    ? `${compraSelecionada.fornecedor?.nome ?? "-"} • ${
                        compraSelecionada.data ? compraSelecionada.data.slice(0, 10) : "-"
                      }`
                    : "Compra selecionada"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setParcelasCompraId(null)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
              {parcelasSelecionadas.length === 0 ? (
                <div className="p-3 text-slate-400">Sem parcelas cadastradas.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Parcela</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Cartão/Conta</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelasSelecionadas.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{p.nParcela}</td>
                        <td className="px-4 py-2">{p.dataVencimento ? p.dataVencimento.slice(0, 10) : "-"}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2">
                          {p.cartaoConta?.nome ||
                            p.cartaoConta?.bandeira ||
                            p.cartaoConta?.banco ||
                            p.cartaoConta?.pixChave ||
                            "-"}
                        </td>
                        <td className="px-4 py-2 capitalize">{p.statusPagamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Novo fornecedor</p>
                <p className="text-xs text-slate-400">Cadastre e selecione para esta compra.</p>
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
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSupplierModal(false);
                  setNovoFornecedor({ nome: "", telefone: "", email: "", endereco: "", observacoes: "" });
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

      


      {showZeroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Valores zerados</p>
                <p className="text-xs text-slate-400">Total da compra ou algum item est? com valor 0.</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-slate-200">
              <p>Deseja continuar mesmo assim?</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowZeroModal(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowZeroModal(false);
                    try {
                      await handleSubmit(true);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao salvar compra");
                    }
                  }}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  Continuar com zero
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </ProtectedShell>
  );
}
