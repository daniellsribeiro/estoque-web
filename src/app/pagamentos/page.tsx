"use client";

import { useEffect, useState } from "react";
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

export default function PagamentosPage() {
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);

  const [typeForm, setTypeForm] = useState<Partial<PaymentType>>({
    parcelavel: false,
    minParcelas: 1,
    maxParcelas: 1,
    ativo: true,
  });
  const [cardForm, setCardForm] = useState<Partial<CardAccount>>({ ativo: true });
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [rules, setRules] = useState<Record<string, CardRule>>({});

  const sanitizeInteger = (raw: string) => raw.replace(/[^0-9]/g, "");

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

  const loadAll = async () => {
    try {
      const [t, c] = await Promise.all([
        apiFetch<PaymentType[]>("/financeiro/tipos-pagamento"),
        apiFetch<CardAccount[]>("/financeiro/cartoes-contas"),
      ]);
      setTypes(t ?? []);
      setCards(c ?? []);
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
    const data =
      (await apiFetch<CardRule[]>(`/financeiro/cartoes-contas/${cardId}/regras`).catch(() => [])) ??
      [];
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
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRules(selectedCard);
    }
  }, [selectedCard]);

  async function handleCreateType() {
    await apiFetch("/financeiro/tipos-pagamento", {
      method: "POST",
      body: JSON.stringify({
        descricao: typeForm.descricao,
        taxaFixa: typeForm.taxaFixa ?? 0,
        taxaPercentual: typeForm.taxaPercentual ?? 0,
        taxaParcela: typeForm.taxaParcela ?? 0,
        descontoPercentual: typeForm.descontoPercentual ?? 0,
        parcelavel: typeForm.parcelavel ?? false,
        minParcelas: typeForm.minParcelas ?? 1,
        maxParcelas: typeForm.maxParcelas ?? 1,
        ativo: typeForm.ativo ?? true,
      }),
    });
    setTypeForm({ parcelavel: false, minParcelas: 1, maxParcelas: 1, ativo: true });
    setMessage("Tipo de pagamento cadastrado");
    await loadAll();
  }

  async function handleCreateCard() {
    await apiFetch("/financeiro/cartoes-contas", {
      method: "POST",
      body: JSON.stringify({
        nome: cardForm.nome,
        banco: cardForm.banco,
        bandeira: cardForm.bandeira,
        diaFechamento: cardForm.diaFechamento ? Number(cardForm.diaFechamento) : undefined,
        diaVencimento: cardForm.diaVencimento ? Number(cardForm.diaVencimento) : undefined,
        pixChave: cardForm.pixChave,
        ativo: cardForm.ativo ?? true,
      }),
    });
    setCardForm({ ativo: true });
    setMessage("Cartao/conta cadastrado");
    await loadAll();
  }

  async function handleSaveRule(tipo: string) {
    if (!selectedCard) {
      setError("Selecione um cartao para salvar regras.");
      return;
    }
    const r = rules[tipo];
    await apiFetch("/financeiro/cartoes-contas/regras", {
      method: "POST",
      body: JSON.stringify({
        cartaoId: selectedCard,
        tipo,
        taxaPercentual: Number(r?.taxaPercentual ?? 0),
        taxaFixa: Number(r?.taxaFixa ?? 0),
        adicionalParcela: Number(r?.adicionalParcela ?? 0),
        prazoRecebimentoDias: Number(r?.prazoRecebimentoDias ?? 0),
        prazoEscalonadoPadrao: r?.prazoEscalonadoPadrao ?? false,
      }),
    });
    setMessage("Regra salva");
    await loadRules(selectedCard);
  }

  return (
    <ProtectedShell title="Pagamentos" subtitle="Cartoes, regras de link e tipos de pagamento">
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
                onClick={() => setShowCardForm((v) => !v)}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-cyan-400 transition"
              >
                {showCardForm ? "Fechar" : "Adicionar cartao/conta"}
              </button>
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
              <input
                placeholder="Banco/Bandeira"
                value={cardForm.bandeira ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, bandeira: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                placeholder="Dia de fechamento"
                value={cardForm.diaFechamento ?? ""}
                onChange={(e) =>
                  setCardForm((p) => ({ ...p, diaFechamento: Number(e.target.value) || undefined }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                inputMode="numeric"
              />
              <input
                placeholder="Dia de vencimento"
                value={cardForm.diaVencimento ?? ""}
                onChange={(e) =>
                  setCardForm((p) => ({ ...p, diaVencimento: Number(e.target.value) || undefined }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                inputMode="numeric"
              />
              <input
                placeholder="Chave PIX do cartao/conta"
                value={cardForm.pixChave ?? ""}
                onChange={(e) => setCardForm((p) => ({ ...p, pixChave: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 lg:col-span-2"
              />
              <button
                onClick={async () => {
                  try {
                    await handleCreateCard();
                    setShowCardForm(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erro ao salvar cartao/conta");
                  }
                }}
                className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 lg:col-span-2"
              >
                Salvar cartao/conta
              </button>
            </div>
          )}

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
                  return (
                    <div key={rt.key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-100">{rt.label}</div>
                        <button
                          className="rounded-lg bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-cyan-300"
                          onClick={() => handleSaveRule(rt.key)}
                        >
                          Salvar regra
                        </button>
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
                            disabled={r.prazoEscalonadoPadrao}
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

          <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
            {cards.length === 0 ? (
              <div className="p-3 text-slate-400">Nenhum cartao/conta cadastrado.</div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Bandeira</th>
                    <th className="px-4 py-2">Fechamento/Venc.</th>
                    <th className="px-4 py-2">PIX</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-4 py-2">{c.nome}</td>
                      <td className="px-4 py-2">{c.bandeira ?? "-"}</td>
                      <td className="px-4 py-2">
                        {c.diaFechamento ?? "-"} / {c.diaVencimento ?? "-"}
                      </td>
                      <td className="px-4 py-2">{c.pixChave ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}
