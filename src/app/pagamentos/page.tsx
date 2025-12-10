"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type PaymentType = {
  id: string;
  descricao: string;
  taxaFixa: number;
  taxaPercentual: number;
  taxaParcela: number;
  descontoPercentual: number;
  parcelavel: boolean;
  minParcelas: number;
  maxParcelas: number;
  ativo: boolean;
};

type CardAccount = {
  id: string;
  nome: string;
  banco?: string;
  bandeira?: string;
  diaFechamento?: number;
  diaVencimento?: number;
  pixChave?: string;
  ativo: boolean;
};

type CardRule = {
  tipo: string;
  taxaPercentual: number;
  taxaFixa: number;
  adicionalParcela: number;
  prazoRecebimentoDias: number;
  prazoEscalonadoPadrao?: boolean;
};

type PurchaseDetail = {
  id: string;
  data?: string;
  fornecedor?: { nome?: string | null } | null;
  tipoPagamento?: { descricao?: string | null } | null;
  totalCompra?: number | null;
  status?: string | null;
  parcelas?: number | null;
  itens?: { id: string; qtde: number; valorUnit: number; valorTotal: number; item?: { nome?: string | null; codigo?: string | null } }[];
};

type PurchasePayment = {
  id: string;
  nParcela: number;
  dataVencimento: string | null;
  valorParcela: number;
  statusPagamento: string;
  dataPagamento?: string | null;
  cartaoConta?: { id: string; nome: string };
  tipoPagamento?: { id: string; descricao: string };
  compra?: { id: string };
};

const getCardId = (p: PurchasePayment): string | null => {
  const cc = p.cartaoConta;
  if (typeof cc === "string") return cc;
  if (cc && typeof cc === "object" && "id" in cc && typeof cc.id === "string") return cc.id;
  return null;
};

const getTipoDesc = (p: PurchasePayment): string => {
  const tp = p.tipoPagamento;
  const raw =
    typeof tp === "string"
      ? tp
      : tp && typeof tp === "object" && "descricao" in tp && typeof tp.descricao === "string"
        ? tp.descricao
        : "";
  return String(raw || "").toLowerCase();
};

const Help = ({ title }: { title: string }) => (
  <span
    className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-200"
    title={title}
  >
    i
  </span>
);

const ruleTypes = [
  { key: "debito", label: "Debito a vista" },
  { key: "credito_vista", label: "Credito a vista" },
  { key: "credito_2_6", label: "Credito 2 a 6x" },
  { key: "credito_7_12", label: "Credito 7 a 12x" },
];

const formatCentsMask = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "0.00";
  const padded = digits.padStart(3, "0");
  const intPart = padded.slice(0, -2);
  const dec = padded.slice(-2);
  return `${intPart}.${dec}`;
};

const toMaskFromNumber = (value?: number) => {
  const cents = Math.round((value ?? 0) * 100);
  return formatCentsMask(String(cents));
};

const sanitizeInteger = (raw: string) => raw.replace(/[^0-9]/g, "");
const formatMonth = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map((v) => Number(v));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return formatMonth(date);
};

export default function PagamentosPage() {
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [pagamentos, setPagamentos] = useState<PurchasePayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCards, setShowCards] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState<Partial<CardAccount>>({ ativo: true });
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [rules, setRules] = useState<Record<string, CardRule>>({});
  const [editingRules, setEditingRules] = useState<Record<string, boolean>>({});
  const [salvandoCard, setSalvandoCard] = useState(false);
  const [salvandoRegra, setSalvandoRegra] = useState<Record<string, boolean>>({});
  const [salvandoFatura, setSalvandoFatura] = useState(false);
  const [cardInfoModal, setCardInfoModal] = useState<CardAccount | null>(null);
  const [compraInfo, setCompraInfo] = useState<{ id: string; loading: boolean; data: PurchaseDetail | null } | null>(
    null,
  );
  const [selectedCardExtract, setSelectedCardExtract] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(formatMonth());
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("");
  const [showExtract, setShowExtract] = useState(false);

  const loadAll = async () => {
    try {
      const [t, c, pays] = await Promise.all([
        apiFetch<PaymentType[]>("/financeiro/tipos-pagamento"),
        apiFetch<CardAccount[]>("/financeiro/cartoes-contas"),
        apiFetch<PurchasePayment[]>("/compras/pagamentos"),
      ]);
      setTypes(t ?? []);
      setCards(c ?? []);
      setPagamentos(pays ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    }
  };

  const loadRules = async (cardId: string) => {
    if (!cardId) {
      setRules({});
      return;
    }
    const data = (await apiFetch<CardRule[]>(`/financeiro/cartoes-contas/${cardId}/regras`).catch(() => [])) ?? [];
    const next: Record<string, CardRule> = {};
    ruleTypes.forEach((rt) => {
      const r = data.find((d) => d.tipo === rt.key);
      next[rt.key] = {
        tipo: rt.key,
        taxaPercentual: r?.taxaPercentual ?? 0,
        taxaFixa: r?.taxaFixa ?? 0,
        adicionalParcela: r?.adicionalParcela ?? 0,
        prazoRecebimentoDias: r?.prazoRecebimentoDias ?? 0,
        prazoEscalonadoPadrao: r?.prazoEscalonadoPadrao ?? false,
      };
    });
    setRules(next);
    setEditingRules({});
  };

  useEffect(() => {
    (async () => {
      await loadAll();
    })();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      (async () => {
        await loadRules(selectedCard);
      })();
    }
  }, [selectedCard]);

  const marcarFaturaPaga = async () => {
    if (!selectedCardExtract || !selectedMonth || salvandoFatura) return;
    try {
      setSalvandoFatura(true);
      setError(null);
      await apiFetch("/financeiro/cartoes-contas/pagamentos", {
        method: "POST",
        body: JSON.stringify({
          cartaoContaId: selectedCardExtract,
          mesReferencia: selectedMonth,
          dataPagamentoReal: new Date().toISOString(),
        }),
      });
      setMessage("Fatura marcada como paga");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar pagamento");
    } finally {
      setSalvandoFatura(false);
    }
  };

  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter((p) => {
      const cardId = getCardId(p);
      if (!cardId || cardId !== selectedCardExtract) return false;
      const baseDate = p.dataVencimento || p.dataPagamento || "";
      const d = baseDate ? new Date(baseDate) : new Date();
      const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (selectedMonth && mes !== selectedMonth) return false;
      if (paymentTypeFilter) {
        const tpDesc = getTipoDesc(p);
        if (!tpDesc.includes(paymentTypeFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [pagamentos, selectedCardExtract, selectedMonth, paymentTypeFilter]);

  const resumoPagamentos = useMemo(() => {
    const total = pagamentosFiltrados.reduce((acc, p) => acc + Number(p.valorParcela || 0), 0);
    const pago = pagamentosFiltrados
      .filter((p) => p.statusPagamento === "paga")
      .reduce((acc, p) => acc + Number(p.valorParcela || 0), 0);
    return { total, pago, pendente: total - pago };
  }, [pagamentosFiltrados]);
  const temPendencias = resumoPagamentos.pendente > 0;
  const pagamentosDoCartaoModal = useMemo(
    () => (cardInfoModal ? pagamentos.filter((p) => getCardId(p) === cardInfoModal.id) : []),
    [cardInfoModal, pagamentos],
  );

  const abrirCompraInfo = async (compraId: string) => {
    setCompraInfo({ id: compraId, loading: true, data: null });
    try {
      const data = await apiFetch<PurchaseDetail>(`/compras/${compraId}`);
      setCompraInfo({ id: compraId, loading: false, data: data ?? null });
      setError(null);
    } catch (err) {
      setCompraInfo((prev) => (prev ? { ...prev, loading: false } : prev));
      setError(err instanceof Error ? err.message : "Erro ao carregar compra");
    }
  };

  async function handleCreateCard() {
    if (salvandoCard) return;
    const payload = {
      nome: cardForm.nome,
      banco: cardForm.banco,
      bandeira: cardForm.bandeira,
      diaFechamento: cardForm.diaFechamento ? Number(cardForm.diaFechamento) : undefined,
      diaVencimento: cardForm.diaVencimento ? Number(cardForm.diaVencimento) : undefined,
      pixChave: cardForm.pixChave,
      ativo: cardForm.ativo ?? true,
    };
    try {
      setSalvandoCard(true);
      setError(null);
      setMessage(null);
      if (editingCardId) {
        await apiFetch(`/financeiro/cartoes-contas/${editingCardId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Cart?o/conta atualizado");
      } else {
        await apiFetch("/financeiro/cartoes-contas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Cart?o/conta cadastrado");
      }
      setCardForm({ ativo: true });
      setEditingCardId(null);
      setShowCardForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cart?o/conta");
    } finally {
      setSalvandoCard(false);
    }
  }

  const handleSaveRule = async (tipo: string) => {
    const r = rules[tipo];
    if (!selectedCard || !r || salvandoRegra[tipo]) return;
    try {
      setSalvandoRegra((prev) => ({ ...prev, [tipo]: true }));
      setError(null);
      await apiFetch("/financeiro/cartoes-contas/regras", {
        method: "POST",
        body: JSON.stringify({
          cartaoId: selectedCard,
          tipo,
          taxaPercentual: Number(r.taxaPercentual ?? 0),
          taxaFixa: Number(r.taxaFixa ?? 0),
          adicionalParcela: Number(r.adicionalParcela ?? 0),
          prazoRecebimentoDias: Number(r.prazoRecebimentoDias ?? 0),
          prazoEscalonadoPadrao: r.prazoEscalonadoPadrao ?? false,
        }),
      });
      setEditingRules((prev) => ({ ...prev, [tipo]: false }));
      setMessage("Regra salva");
      await loadRules(selectedCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regra");
    } finally {
      setSalvandoRegra((prev) => ({ ...prev, [tipo]: false }));
    }
  };

  return (
    <ProtectedShell title="Cartões" subtitle="Cartoes, regras de link e tipos de pagamento">
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
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Cartoes / Contas</h3>
              <p className="text-sm text-slate-400">Dados de fechamento, vencimento e chave PIX.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCardForm((v) => !v);
                  setEditingCardId(null);
                  setCardForm({ ativo: true });
                }}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-cyan-400 transition"
              >
                {showCardForm ? "Fechar" : "Adicionar cartao/conta"}
              </button>
              <button
                onClick={() => {
                  setShowCards((v) => !v);
                  setEditingCardId(null);
                  setCardForm({ ativo: true });
                }}
                className="rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 transition"
              >
                {showCards ? "Ocultar lista" : "Mostrar lista"}
              </button>
            </div>
          </div>

          {showCardForm && (
            <div className="grid gap-3 text-sm lg:grid-cols-2">
              <input
                placeholder="Nome (ex: Credito Nubank)"
                value={cardForm.nome ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, nome: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  placeholder="Banco"
                  value={cardForm.banco ?? ""}
                  onChange={(e) => setCardForm((p) => ({ ...p, banco: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Bandeira"
                  value={cardForm.bandeira ?? ""}
                  onChange={(e) => setCardForm((p) => ({ ...p, bandeira: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
              </div>
              <input
                placeholder="Dia de fechamento"
                value={cardForm.diaFechamento ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, diaFechamento: Number(e.target.value) || undefined }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                inputMode="numeric"
              />
              <input
                placeholder="Dia de vencimento"
                value={cardForm.diaVencimento ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, diaVencimento: Number(e.target.value) || undefined }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                inputMode="numeric"
              />
              <input
                placeholder="Chave PIX do cartao/conta"
                value={cardForm.pixChave ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, pixChave: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 lg:col-span-2"
              />
              <div className="flex gap-2 lg:col-span-2">
                <button
                  onClick={() => void handleCreateCard()}
                  disabled={salvandoCard}
                  className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {salvandoCard ? "Salvando..." : editingCardId ? "Atualizar" : "Salvar"} cartao/conta
                </button>
                <button
                  onClick={() => {
                    setEditingCardId(null);
                    setCardForm({ ativo: true });
                    setShowCardForm(false);
                  }}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 font-semibold text-slate-100 transition hover:bg-slate-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {showCards && (
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
              {cards.length === 0 ? (
                <div className="p-3 text-slate-400">Nenhum cartao/conta cadastrado.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">Banco</th>
                      <th className="px-4 py-2">Bandeira</th>
                      <th className="px-4 py-2">Fechamento/Venc.</th>
                      <th className="px-4 py-2">PIX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{c.nome}</td>
                        <td className="px-4 py-2">{c.banco ?? "-"}</td>
                        <td className="px-4 py-2">{c.bandeira ?? "-"}</td>
                        <td className="px-4 py-2">
                          {c.diaFechamento ?? "-"} / {c.diaVencimento ?? "-"}
                        </td>
                        <td className="px-4 py-2">{c.pixChave ?? "-"}</td>
                        <td className="px-4 py-2">
                          <button
                        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                        onClick={() => {
                          setCardForm({
                            nome: c.nome,
                            banco: c.banco,
                            bandeira: c.bandeira,
                            diaFechamento: c.diaFechamento,
                            diaVencimento: c.diaVencimento,
                            pixChave: c.pixChave,
                            ativo: c.ativo,
                          });
                          setEditingCardId(c.id);
                          setShowCardForm(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="ml-2 rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                        onClick={() => setCardInfoModal(c)}
                      >
                        Compras
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              )}
            </div>
          )}

          {showCards && (
            <select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
            >
              <option value="">Regras: selecione um cartao</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.bandeira ? `(${c.bandeira})` : ""}
                </option>
              ))}
            </select>
          )}

          {showCards && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
              <p className="text-sm font-semibold text-slate-100">Regras de link/pagamento</p>
              {!selectedCard ? (
                <div className="mt-2 text-slate-400">Selecione um cartao para editar regras.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {ruleTypes.map((rt) => {
                    const r = rules[rt.key] ?? {
                      tipo: rt.key,
                      taxaPercentual: 0,
                      taxaFixa: 0,
                      adicionalParcela: 0,
                      prazoRecebimentoDias: 0,
                    };
                    const isEditing = editingRules[rt.key] ?? false;
                    const isSaving = salvandoRegra[rt.key] ?? false;
                    return (
                      <div key={rt.key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-100">{rt.label}</div>
                          <div className="flex gap-2">
                            <button
                              className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                              onClick={() =>
                                setEditingRules((prev) => ({
                                  ...prev,
                                  [rt.key]: !prev[rt.key],
                                }))
                              }
                            >
                              {isEditing ? "Cancelar" : "Editar"}
                            </button>
                            <button
                              className="rounded-lg bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
                              onClick={() => void handleSaveRule(rt.key)}
                              disabled={!isEditing || isSaving}
                            >
                              {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-3 text-xs md:grid-cols-4">
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-300 inline-flex items-center">
                              Taxa principal (%) <Help title="Ex.: 3.49 — taxa que o gateway cobra nesta modalidade." />
                            </span>
                            <input
                              value={toMaskFromNumber(r.taxaPercentual)}
                              onChange={(e) => {
                                const mask = formatCentsMask(e.target.value);
                                setRules((prev) => ({
                                  ...prev,
                                  [rt.key]: { ...r, taxaPercentual: Number(mask) },
                                }));
                              }}
                              placeholder="Ex.: 3.49"
                              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                              inputMode="decimal"
                              disabled={!isEditing}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-300 inline-flex items-center">
                              Adicional por parcela (%) <Help title="Ex.: 1.39 — soma por parcela para crédito parcelado." />
                            </span>
                            <input
                              value={toMaskFromNumber(r.adicionalParcela)}
                              onChange={(e) => {
                                const mask = formatCentsMask(e.target.value);
                                setRules((prev) => ({
                                  ...prev,
                                  [rt.key]: { ...r, adicionalParcela: Number(mask) },
                                }));
                              }}
                              placeholder="Ex.: 1.39"
                              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                              inputMode="decimal"
                              disabled={!isEditing}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-300 inline-flex items-center">
                              Taxa fixa (R$) <Help title="Ex.: 0.35 — tarifa fixa por transação." />
                            </span>
                            <input
                              value={toMaskFromNumber(r.taxaFixa)}
                              onChange={(e) => {
                                const mask = formatCentsMask(e.target.value);
                                setRules((prev) => ({
                                  ...prev,
                                  [rt.key]: { ...r, taxaFixa: Number(mask) },
                                }));
                              }}
                              placeholder="Ex.: 0.35"
                              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                              inputMode="decimal"
                              disabled={!isEditing}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-300 inline-flex items-center">
                              Prazo de recebimento (dias) <Help title="Ex.: 14 — dias corridos para cair na conta." />
                            </span>
                            <input
                              value={sanitizeInteger(String(r.prazoRecebimentoDias ?? ""))}
                              onChange={(e) => {
                                const cleaned = sanitizeInteger(e.target.value);
                                setRules((prev) => ({
                                  ...prev,
                                  [rt.key]: {
                                    ...r,
                                    prazoEscalonadoPadrao: false,
                                    prazoRecebimentoDias: cleaned === "" ? 0 : Number(cleaned),
                                  },
                                }));
                              }}
                              placeholder="Ex.: 14"
                              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                              inputMode="numeric"
                              disabled={r.prazoEscalonadoPadrao || !isEditing}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-300 inline-flex items-center">
                              Regra 31/30 dias <Help title="1ª parcela em 31 dias corridos, demais a cada 30 dias." />
                            </span>
                            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50">
                              <input
                                type="checkbox"
                                checked={r.prazoEscalonadoPadrao ?? false}
                                onChange={(e) =>
                                  setRules((prev) => ({
                                    ...prev,
                                    [rt.key]: {
                                      ...r,
                                      prazoEscalonadoPadrao: e.target.checked,
                                      prazoRecebimentoDias: e.target.checked ? 0 : r.prazoRecebimentoDias ?? 0,
                                    },
                                  }))
                                }
                                disabled={!isEditing}
                              />
                              <span className="text-xs text-slate-200">Aplicar 31d + 30d</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Extrato por cartão e mês</h3>
              <p className="text-sm text-slate-400">
                Escolha cartão e mês para ver parcelas (pagas e abertas), resumo e marcar tudo como pago.
              </p>
            </div>
            <button
              onClick={() => setShowExtract((v) => !v)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
            >
              {showExtract ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {showExtract && (
            <>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <select
              value={selectedCardExtract}
              onChange={(e) => {
                setSelectedCardExtract(e.target.value);
                setSelectedMonth(formatMonth());
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            >
              <option value="">Selecione o cartão</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:opacity-40"
                onClick={() => setSelectedMonth((m) => shiftMonth(m || formatMonth(), -1))}
                disabled={!selectedCardExtract}
              >
                ?
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                disabled={!selectedCardExtract}
              />
              <button
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:opacity-40"
                onClick={() => setSelectedMonth((m) => shiftMonth(m || formatMonth(), 1))}
                disabled={!selectedCardExtract}
              >
                ?
              </button>
            </div>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            >
              <option value="">Todos os meios</option>
              {types.map((t) => (
                <option key={t.id} value={t.descricao}>
                  {t.descricao}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
            {(!selectedCardExtract || !selectedMonth) && <div className="p-3 text-slate-400">Selecione cartão e mês.</div>}
            {selectedCardExtract && selectedMonth && pagamentosFiltrados.length === 0 && (
              <div className="p-3 text-slate-400">Nenhuma parcela neste mês/cartão.</div>
            )}
            {selectedCardExtract && selectedMonth && pagamentosFiltrados.length > 0 && (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Parcela</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosFiltrados.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{p.nParcela}</td>
                        <td className="px-4 py-2">{p.dataVencimento ? p.dataVencimento.slice(0, 10) : "-"}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2">{p.tipoPagamento?.descricao ?? "-"}</td>
                        <td className="px-4 py-2 capitalize">{p.statusPagamento}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:opacity-50"
                            disabled={!p.compra?.id}
                            onClick={() => p.compra?.id && void abrirCompraInfo(p.compra.id)}
                          >
                            Ver compra
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>

          {selectedCardExtract && selectedMonth && (
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
              <div className="space-y-1">
                <div>Total do mês: R$ {resumoPagamentos.total.toFixed(2)}</div>
                <div>Pago: R$ {resumoPagamentos.pago.toFixed(2)}</div>
                <div>Pendente: R$ {resumoPagamentos.pendente.toFixed(2)}</div>
              </div>
              {temPendencias ? (
                <button
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
                  onClick={() => void marcarFaturaPaga()}
                  disabled={salvandoFatura}
                >
                  {salvandoFatura ? "Salvando..." : "Marcar m?s como pago"}
                </button>
              ) : (
                <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                  Sem pendências neste mês.
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {cardInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
          <div className="w-full max-w-3xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-50">Compras neste cartao/conta</h4>
                <p className="text-xs text-slate-400">{cardInfoModal.nome}</p>
              </div>
              <button
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => setCardInfoModal(null)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
              {pagamentosDoCartaoModal.length === 0 ? (
                <div className="p-3 text-slate-400">Nenhuma compra registrada neste cartao/conta.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Parcela</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosDoCartaoModal.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{p.nParcela}</td>
                        <td className="px-4 py-2">{p.dataVencimento ? p.dataVencimento.slice(0, 10) : "-"}</td>
                        <td className="px-4 py-2">R$ {Number(p.valorParcela || 0).toFixed(2)}</td>
                        <td className="px-4 py-2">{p.tipoPagamento?.descricao ?? "-"}</td>
                        <td className="px-4 py-2 capitalize">{p.statusPagamento}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:opacity-50"
                            disabled={!p.compra?.id}
                            onClick={() => p.compra?.id && void abrirCompraInfo(p.compra.id)}
                          >
                            Ver compra
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
      )}

      {compraInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4 backdrop-blur">
          <div className="w-full max-w-3xl rounded-xl bg-slate-900 p-5 text-sm text-slate-200 ring-1 ring-slate-800 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-50">Detalhes da compra</h4>
                <p className="text-xs text-slate-400">ID: {compraInfo.id}</p>
              </div>
              <button
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                onClick={() => setCompraInfo(null)}
              >
                Fechar
              </button>
            </div>

            {compraInfo.loading ? (
              <div className="mt-4 text-slate-300">Carregando...</div>
            ) : compraInfo.data ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Fornecedor</p>
                    <p className="font-semibold text-slate-50">{compraInfo.data.fornecedor?.nome ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Tipo de pagamento</p>
                    <p className="font-semibold text-slate-50">{compraInfo.data.tipoPagamento?.descricao ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Data</p>
                    <p className="font-semibold text-slate-50">
                      {compraInfo.data.data ? compraInfo.data.data.slice(0, 10) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                    <p className="text-xs text-slate-400">Parcelas</p>
                    <p className="font-semibold text-slate-50">{compraInfo.data.parcelas ?? "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-slate-50">
                    R$ {Number(compraInfo.data.totalCompra || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">Status: {compraInfo.data.status ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Itens</p>
                  {compraInfo.data.itens && compraInfo.data.itens.length > 0 ? (
                    <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
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
                          {compraInfo.data.itens.map((it) => (
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
              <div className="mt-4 text-rose-200">Compra não encontrada.</div>
            )}
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
