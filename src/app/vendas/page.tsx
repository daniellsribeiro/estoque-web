"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Customer = { id: string; nome: string };
type PaymentType = { id: string; descricao: string };
type CardAccount = {
  id: string;
  nome: string;
  bandeira?: string | null;
  banco?: string | null;
  pixChave?: string | null;
  diaFechamento?: number | null;
  diaVencimento?: number | null;
};
type CardRule = {
  id: string;
  tipo: string;
  taxaPercentual: number;
  taxaFixa: number;
  adicionalParcela: number;
  prazoRecebimentoDias: number;
  prazoEscalonadoPadrao: boolean;
};
type ProductAttr = { id: string; nome: string };
type Product = {
  id: string;
  codigo: string;
  nome: string;
  tipo?: ProductAttr | null;
  cor?: ProductAttr | null;
  material?: ProductAttr | null;
  preco?: { precoVendaAtual: number } | null;
  estoque?: { quantidadeAtual: number } | null;
};
type Sale = {
  id: string;
  data: string;
  cliente: Customer;
  tipoPagamento: PaymentType;
  parcelas: number;
  totalVenda: number;
  status: string;
};
type SaleDetail = Sale & {
  observacoes?: string | null;
  itens: { id: string; qtde: number; precoUnit: number; subtotal: number; item?: Product }[];
  recebimentos?: Recebimento[];
};
type Recebimento = {
  id: string;
  parcelaNumero: number;
  valorBruto: number;
  valorLiquido: number;
  valorTaxa: number;
  dataPrevista: string;
  dataRecebida?: string | null;
  status: string;
  tipoPagamento?: PaymentType | null;
  cartaoConta?: CardAccount | null;
};

const formatCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const padded = (digits || "0").padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decimal = padded.slice(-2);
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${decimal}`;
};

const formatCurrencyFromNumber = (value: number) => {
  const cents = Math.round(Number(value || 0) * 100);
  return formatCurrency(cents.toString());
};

const parseCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const cents = parseInt(digits || "0", 10);
  return cents / 100;
};

const todayLocal = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const onlyNumbers = (value: string) => value.replace(/[^0-9]/g, "");
const maskPhone = (value: string) => {
  const digits = onlyNumbers(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_m, ddd, p1, p2) => `(${ddd}) ${p1}${p2 ? "-" + p2 : ""}`);
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_m, ddd, p1, p2) => `(${ddd}) ${p1}${p2 ? "-" + p2 : ""}`);
};
const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

type ItemInput = { produtoId: string; qtde: string; valorUnit: string; search: string };

export default function VendasPage() {
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [cardRules, setCardRules] = useState<CardRule[]>([]);
  const [cardRulesMap, setCardRulesMap] = useState<Record<string, CardRule[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [detalhe, setDetalhe] = useState<SaleDetail | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [payModal, setPayModal] = useState<{ id: string; data: string } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: "", telefone: "", email: "", observacoes: "" });
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [clienteBusca, setClienteBusca] = useState("");

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCor, setFiltroCor] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");

  const [form, setForm] = useState({
    data: todayLocal(),
    clienteId: "",
    tipoPagamentoId: "",
    cartaoContaId: "",
    regraId: "",
    parcelas: 1,
    frete: "0,00",
    desconto: "0,00",
    observacoes: "",
    usarEscalonado: false,
    prazoDias: "",
    pagoAgora: false,
  });
  const [parcelasInput, setParcelasInput] = useState("1");

  const [itens, setItens] = useState<ItemInput[]>([{ produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }]);

  const tipoSelecionado = useMemo(
    () => paymentTypes.find((t) => t.id === form.tipoPagamentoId),
    [paymentTypes, form.tipoPagamentoId],
  );
  const tipoDescRaw = tipoSelecionado?.descricao || "";
  const tipoDesc = tipoDescRaw.toLowerCase();
  const tipoDescNorm = tipoDesc.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isCredito = useMemo(() => tipoDescNorm.includes("cred"), [tipoDescNorm]);
  const isPix = useMemo(() => tipoDescNorm.includes("pix"), [tipoDescNorm]);
  const isDebito = useMemo(() => tipoDescNorm.includes("deb"), [tipoDescNorm]);
  const requiresCard = useMemo(
    () => ["pix", "deb", "debito", "cred"].some((k) => tipoDescNorm.includes(k)) && !tipoDescNorm.includes("dinheiro"),
    [tipoDescNorm],
  );

  const filteredCards = useMemo(() => {
    if (!requiresCard) return [];
    if (isPix) return cards.filter((c) => !!c.pixChave);
    if (isCredito)
      return cards.filter((c) => {
        const rules = cardRulesMap[c.id];
        if (!rules) return false;
        const compat = rules.filter((r) => {
          const t = (r.tipo || "").toLowerCase();
          const tNorm = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return tNorm.includes("cred");
        });
        return compat.length > 0;
      });
    if (isDebito)
      return cards.filter((c) => {
        const rules = cardRulesMap[c.id];
        if (!rules) return false;
        const compat = rules.filter((r) => {
          const t = (r.tipo || "").toLowerCase();
          const tNorm = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return tNorm.includes("deb");
        });
        return compat.length > 0;
      });
    return cards;
  }, [cards, requiresCard, tipoDescNorm, isCredito, isPix, isDebito, cardRulesMap]);

  const cardRulesForSelected = useMemo(() => {
    if (!form.cartaoContaId) return [];
    const base = cardRulesMap[form.cartaoContaId] || [];
    return base;
  }, [cardRulesMap, form.cartaoContaId]);

  const cardRulesCompat = useMemo(() => {
    return cardRulesForSelected.filter((r) => {
      const t = (r.tipo || "").toLowerCase();
      const tNorm = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (isCredito) return tNorm.includes("cred");
      if (isDebito) return tNorm.includes("deb");
      if (isPix) return tNorm.includes("pix");
      return true;
    });
  }, [cardRulesForSelected, isCredito, isDebito, isPix]);

  const parseRuleRange = (tipo: string) => {
    const tNorm = (tipo || "").toLowerCase();
    const nums = (tNorm.match(/\d+/g) || []).map((n) => Number(n)).filter((n) => !Number.isNaN(n));
    if (nums.length === 1) return { min: nums[0], max: nums[0] };
    if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
    if (tNorm.includes("vista") || tNorm.includes("av")) return { min: 1, max: 1 };
    return null;
  };

  const allowedParcelas = useMemo(() => {
    if (isPix || isDebito || tipoDesc.includes("dinheiro")) return [1];
    if (!isCredito) return [1];
    const nums = new Set<number>();
    (cardRulesCompat.length ? cardRulesCompat : cardRulesForSelected).forEach((r) => {
      const range = parseRuleRange(r.tipo);
      if (range) {
        for (let i = range.min; i <= range.max; i++) nums.add(i);
      }
    });
    const arr = Array.from(nums).sort((a, b) => a - b);
    return arr.length ? arr : [1];
  }, [isPix, isDebito, tipoDesc, isCredito, cardRulesForSelected, cardRulesCompat]);

  const pickRuleForParcel = (parcelas: number): CardRule | undefined => {
    if (!form.cartaoContaId) return undefined;
    // filtra por regra coerente com o meio (credito/debito/pix)
    const lista = cardRulesCompat.length ? cardRulesCompat : isPix ? [] : cardRulesForSelected;
    if (isPix && lista.length === 0) return undefined;
    const exact = lista.find((r) => {
      const range = parseRuleRange(r.tipo);
      if (!range) return false;
      return parcelas >= range.min && parcelas <= range.max;
    });
    return exact || lista[0];
  };

  const tiposFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => p.tipo && map.set(p.tipo.id, p.tipo));
    return Array.from(map.values());
  }, [products]);
  const coresFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => p.cor && map.set(p.cor.id, p.cor));
    return Array.from(map.values());
  }, [products]);
  const materiaisFiltro = useMemo(() => {
    const map = new Map<string, ProductAttr>();
    products.forEach((p) => p.material && map.set(p.material.id, p.material));
    return Array.from(map.values());
  }, [products]);

  const produtosFiltrados = useMemo(() => {
    return products.filter((p) => {
      const matchTipo = !filtroTipo || p.tipo?.id === filtroTipo;
      const matchCor = !filtroCor || p.cor?.id === filtroCor;
      const matchMaterial = !filtroMaterial || p.material?.id === filtroMaterial;
      return matchTipo && matchCor && matchMaterial;
    });
  }, [products, filtroTipo, filtroCor, filtroMaterial]);

  const totalItens = useMemo(
    () =>
      itens.reduce((sum, it) => {
        const qtd = Number(it.qtde || "0");
        const valor = parseCurrency(it.valorUnit);
        return sum + qtd * valor;
      }, 0),
    [itens],
  );
  const totalFinal = useMemo(
    () => totalItens + parseCurrency(form.frete) - parseCurrency(form.desconto),
    [totalItens, form.frete, form.desconto],
  );
  const valorParcela = useMemo(
    () => (form.parcelas && form.parcelas > 0 ? totalFinal / form.parcelas : 0),
    [form.parcelas, totalFinal],
  );

  const regraSelecionada = useMemo(() => pickRuleForParcel(form.parcelas), [form.parcelas, cardRulesForSelected, cardRulesCompat]);
  const previewTaxa = useMemo(() => {
    if (!regraSelecionada)
      return { taxaPerc: 0, taxaFixa: 0, totalTaxa: 0, liquidoParcela: valorParcela, liquidoTotal: totalFinal };
    const basePerc = regraSelecionada.taxaPercentual ?? 0;
    const adicionalParcela = (regraSelecionada.adicionalParcela ?? 0) * (form.parcelas || 1);
    const taxaPerc = basePerc + adicionalParcela;
    const taxaFixa = regraSelecionada.taxaFixa ?? 0;
    const totalTaxa = (totalFinal * taxaPerc) / 100 + taxaFixa;
    const liquidoTotal = totalFinal - totalTaxa;
    const liquidoParcela = form.parcelas ? liquidoTotal / form.parcelas : liquidoTotal;
    return {
      taxaPerc,
      taxaFixa,
      totalTaxa,
      liquidoParcela,
      liquidoTotal,
    };
  }, [regraSelecionada, valorParcela, form.parcelas, totalFinal]);

  const totalLiquido = useMemo(() => {
    if (!regraSelecionada) return totalFinal;
    return previewTaxa.liquidoTotal;
  }, [regraSelecionada, previewTaxa, totalFinal]);

  const clientesFiltrados = useMemo(() => {
    const term = clienteBusca.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(term));
  }, [clienteBusca, clientes]);

  const totalColorClass = (status: string | undefined) => {
    const s = (status || "").toLowerCase();
    if (s.includes("cancel")) return "text-rose-400";
    if (s.includes("receb")) return "text-emerald-300";
    if (s.includes("pag")) return "text-amber-300";
    if (s.includes("pend")) return "text-orange-300";
    return "text-slate-100";
  };

  const statusLabel = (r: Recebimento) => {
    if (r.status === "cancelado") return "Cancelado";
    const hoje = new Date();
    const prevista = r.dataPrevista ? new Date(r.dataPrevista) : null;
    if (r.status === "recebido") {
      if (prevista && hoje < prevista) return "Pago";
      return "Recebido";
    }
    if (r.status === "previsto") {
      if (r.dataRecebida) {
        if (prevista && hoje >= prevista) return "Recebido";
        return "Pago";
      }
      return "Pendente";
    }
    return "Pendente";
  };

  const detalheStatus = useMemo(() => {
    if (!detalhe) return "";
    const base = (detalhe.status || "").toLowerCase();
    if (base.includes("cancel")) return "Cancelado";
    let status = detalhe.status || "";
    const recs = detalhe.recebimentos || [];
    if (recs.length) {
      const last = [...recs].sort((a, b) => (b.parcelaNumero ?? 0) - (a.parcelaNumero ?? 0))[0];
      const hoje = new Date();
      const prevista = last.dataPrevista ? new Date(last.dataPrevista) : null;
      if (last.status === "recebido") {
        status = "Recebido";
      } else if (last.status === "previsto" && last.dataRecebida) {
        if (prevista && hoje >= prevista) status = "Recebido";
        else status = "Pago";
      }
    }
    return status;
  }, [detalhe]);

  const carregarTudo = async () => {
    setCarregando(true);
    try {
      const [cli, tipos, ca, prd, ven] = await Promise.all([
        apiFetch<Customer[]>("/clientes"),
        apiFetch<PaymentType[]>("/financeiro/tipos-pagamento"),
        apiFetch<CardAccount[]>("/financeiro/cartoes-contas"),
        apiFetch<Product[]>("/produtos"),
        apiFetch<Sale[]>("/vendas"),
      ]);
      setClientes(cli || []);
      setPaymentTypes(tipos || []);
      const cardsData = ca || [];
      setCards(cardsData);
      setProducts(prd || []);
      setVendas(ven || []);
      // preload regras para saber quais cartoes suportam credito/link
      try {
        const entries = await Promise.all(
          cardsData.map(async (c) => {
            const rules = await apiFetch<CardRule[]>(`/financeiro/cartoes-contas/${c.id}/regras`).catch(() => []);
            return [c.id, rules] as const;
          }),
        );
        setCardRulesMap(Object.fromEntries(entries));
      } catch (err) {
        // ignora erro silencioso; sera buscado sob demanda
      }
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarTudo();
  }, []);

  useEffect(() => {
    if (!requiresCard) {
      setForm((p) => ({ ...p, cartaoContaId: "", regraId: "" }));
      setCardRules([]);
    }
  }, [requiresCard]);

useEffect(() => {
  if (isPix || isDebito || tipoDescNorm.includes("dinheiro")) {
    setForm((p) => ({ ...p, parcelas: 1, regraId: "" }));
    setParcelasInput("1");
    return;
  }
  if (!isCredito) return;
  setForm((p) => {
    const fallback = allowedParcelas[0] ?? 1;
    const valida = allowedParcelas.includes(p.parcelas) ? p.parcelas : fallback;
    return { ...p, parcelas: valida };
  });
  setParcelasInput((prev) => {
    const num = Number(prev) || 0;
    return allowedParcelas.includes(num) ? prev : String(allowedParcelas[0] ?? 1);
  });
}, [isPix, isDebito, tipoDescNorm, isCredito, allowedParcelas]);

useEffect(() => {
  if (!isCredito) return;
  const regra = pickRuleForParcel(form.parcelas);
  setForm((p) => ({
    ...p,
    regraId: regra?.id ?? "",
    prazoDias: regra?.prazoRecebimentoDias?.toString() ?? "",
    usarEscalonado: regra?.prazoEscalonadoPadrao ?? false,
  }));
}, [form.parcelas, isCredito]);

  useEffect(() => {
    if (!isCredito) return;
    const alreadyLoaded = Object.keys(cardRulesMap).length > 0;
    if (alreadyLoaded || cards.length === 0) return;
    (async () => {
      try {
        const entries = await Promise.all(
          cards.map(async (c) => {
            const rules = await apiFetch<CardRule[]>(`/financeiro/cartoes-contas/${c.id}/regras`).catch(() => []);
            return [c.id, rules] as const;
          }),
        );
        setCardRulesMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch {
        /* ignore preload errors */
      }
    })();
  }, [isCredito, cards, cardRulesMap]);

  const carregarRegras = async (cardId: string) => {
    if (!cardId) {
      setCardRules([]);
      return;
    }
    const cached = cardRulesMap[cardId];
    if (cached) {
      setCardRules(cached);
      return;
    }
    try {
      const regras = await apiFetch<CardRule[]>(`/financeiro/cartoes-contas/${cardId}/regras`);
      setCardRules(regras || []);
      setCardRulesMap((prev) => ({ ...prev, [cardId]: regras || [] }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar regras do cartao");
    }
  };

  const atualizarItem = (index: number, patch: Partial<ItemInput>) => {
    setItens((current) => current.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
  };

  const adicionarItem = () => setItens((prev) => [...prev, { produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }]);
  const removerItem = (index: number) => setItens((prev) => prev.filter((_, idx) => idx !== index));

  async function submitVenda() {
    if (!form.clienteId || !form.tipoPagamentoId) {
      setErro("Cliente e forma de pagamento sao obrigatorios.");
      return;
    }
    if (requiresCard && !form.cartaoContaId) {
      setErro("Selecione o cartao/conta para este pagamento.");
      return;
    }
    if (isCredito && (!form.parcelas || form.parcelas < 1)) {
      setErro("Informe o numero de parcelas para credito.");
      return;
    }
    if (isCredito && !allowedParcelas.includes(form.parcelas || 0)) {
      setErro("Numero de parcelas invalido para este cartao/regra.");
      return;
    }
    if (itens.some((it) => !it.produtoId)) {
      setErro("Selecione todos os produtos antes de salvar.");
      return;
    }
    if (itens.some((it) => Number(it.qtde) <= 0)) {
      setErro("Quantidade deve ser maior que zero.");
      return;
    }
    const ids = itens.map((it) => it.produtoId).filter(Boolean);
    const idsSet = new Set<string>();
    const duplicated = ids.find((id) => {
      if (idsSet.has(id)) return true;
      idsSet.add(id);
      return false;
    });
    if (duplicated) {
      setErro("Produto já adicionado. Ajuste a quantidade em vez de repetir.");
      return;
    }

    const estoqueInsuficiente = itens.find((it) => {
      const prod = products.find((p) => p.id === it.produtoId);
      const saldo = prod?.estoque?.quantidadeAtual ?? 0;
      return Number(it.qtde) > saldo;
    });
    if (estoqueInsuficiente) {
      setErro("Quantidade solicitada maior que o estoque disponivel.");
      return;
    }

    const payload = {
      data: form.data,
      clienteId: form.clienteId,
      tipoPagamentoId: form.tipoPagamentoId,
      cartaoContaId: form.cartaoContaId || undefined,
      regraId: form.regraId || undefined,
      usarEscalonadoPadrao: form.usarEscalonado || undefined,
      prazoRecebimentoDias: form.prazoDias ? Number(form.prazoDias) : undefined,
      parcelas: form.parcelas || 1,
      pagoAgora: form.pagoAgora || undefined,
      dataPagamento: form.pagoAgora ? form.data : undefined,
      frete: parseCurrency(form.frete),
      descontoTotal: parseCurrency(form.desconto),
      observacoes: form.observacoes || undefined,
      itens: itens.map((it) => ({
        produtoId: it.produtoId,
        qtde: Number(it.qtde),
        precoUnit: parseCurrency(it.valorUnit),
      })),
    };

    try {
      setErro(null);
      const result = await apiFetch<SaleDetail>("/vendas", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMensagem("Venda registrada com sucesso.");
      setDetalhe(result ?? null);
      setItens([{ produtoId: "", qtde: "1", valorUnit: "0,00", search: "" }]);
      setForm((prev) => ({
        ...prev,
        data: todayLocal(),
        frete: "0,00",
        desconto: "0,00",
        observacoes: "",
        pagoAgora: false,
      }));
      await carregarTudo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar venda");
    }
  }

  const abrirDetalhe = async (id: string) => {
    setCarregandoDetalhe(true);
    try {
      const venda = await apiFetch<SaleDetail>(`/vendas/${id}`);
      setDetalhe(venda ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar detalhes da venda");
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const renderItemOptions = (search: string, currentIndex: number) => {
    const selectedIds = new Set(
      itens
        .map((it, idx) => (idx === currentIndex ? null : it.produtoId))
        .filter((v): v is string => !!v),
    );
    const term = search.trim().toLowerCase();
    return produtosFiltrados
      .filter((p) => {
        if (selectedIds.has(p.id)) return false;
        if (!term) return true;
        return `${p.codigo} ${p.nome}`.toLowerCase().includes(term);
      })
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.codigo} - {p.nome} ({p.estoque?.quantidadeAtual ?? 0} un) - R$ {(p.preco?.precoVendaAtual ?? 0).toFixed(2)}
        </option>
      ));
  };

  const marcarPago = async () => {
    if (!payModal?.id) return;
    try {
      setErro(null);
      await apiFetch(`/vendas/${payModal.id}/pagar`, {
        method: "PATCH",
        body: JSON.stringify({ dataPagamento: payModal.data }),
      });
      setMensagem("Venda marcada como paga.");
      setPayModal(null);
      await carregarTudo();
      if (detalhe?.id === payModal.id) {
        await abrirDetalhe(payModal.id);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao marcar pagamento");
    }
  };

  const cancelarVenda = async (id: string) => {
    try {
      setCancelando(true);
      setErro(null);
      await apiFetch(`/vendas/${id}/cancelar`, { method: "PATCH" });
      setMensagem("Venda cancelada e estoque revertido.");
      await carregarTudo();
      if (detalhe?.id === id) await abrirDetalhe(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cancelar venda");
    } finally {
      setCancelando(false);
    }
  };

  const salvarCliente = async () => {
    if (!novoCliente.nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    if (novoCliente.email && !isValidEmail(novoCliente.email)) {
      setErro("Email invalido.");
      return;
    }
    try {
      setSalvandoCliente(true);
      const clienteCriado = await apiFetch<Customer>("/clientes", {
        method: "POST",
        body: JSON.stringify({
          nome: novoCliente.nome.trim(),
          telefone: novoCliente.telefone || undefined,
          email: novoCliente.email || undefined,
          observacoes: novoCliente.observacoes || undefined,
        }),
      });
      setClientes((prev) => [...prev, clienteCriado]);
      setForm((p) => ({ ...p, clienteId: clienteCriado.id }));
      setShowClienteModal(false);
      setNovoCliente({ nome: "", telefone: "", email: "" });
      setMensagem("Cliente adicionado com sucesso.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar cliente");
    } finally {
      setSalvandoCliente(false);
    }
  };

  return (
    <ProtectedShell title="Vendas" subtitle="Registre vendas com baixa de estoque e recebimentos.">
      {erro && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {erro}
        </div>
      )}
      {mensagem && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/40">
          {mensagem}
        </div>
      )}

      <div className="grid gap-6">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Nova venda</h3>
              <p className="text-sm text-slate-400">Selecione cliente, itens e forma de pagamento.</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Total itens: R$ {totalItens.toFixed(2)}</div>
              <div>Total bruto: R$ {totalFinal.toFixed(2)}</div>
              {regraSelecionada ? (
                <>
                  <div>Total liquido (c/ taxa): R$ {totalLiquido.toFixed(2)}</div>
                  <div>
                    Parcela bruta: R$ {valorParcela.toFixed(2)} • Parcela liquida: R$ {previewTaxa.liquidoParcela.toFixed(2)}
                  </div>
                </>
              ) : (
                <div>Parcela: R$ {valorParcela.toFixed(2)}</div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
            <label className="space-y-1">
              <span className="text-slate-300">Data</span>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Cliente</span>
                <button
                  type="button"
                  onClick={() => setShowClienteModal(true)}
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-100"
                >
                  + adicionar
                </button>
              </div>
              <input
                placeholder="Buscar cliente"
                value={clienteBusca}
                onChange={(e) => setClienteBusca(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
              />
              <select
                value={form.clienteId}
                onChange={(e) => setForm((p) => ({ ...p, clienteId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Selecione o cliente</option>
                {clientesFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
            <label className="space-y-1 md:col-span-2">
              <span className="text-slate-300">Forma de pagamento</span>
              <select
                value={form.tipoPagamentoId}
                onChange={(e) => setForm((p) => ({ ...p, tipoPagamentoId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Selecione</option>
                {paymentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Parcelas</span>
              <input
                inputMode="numeric"
                value={parcelasInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digits = onlyNumbers(raw);
                  setParcelasInput(raw);
                  if (!digits) {
                    setForm((p) => ({ ...p, parcelas: 0 }));
                    return;
                  }
                  setForm((p) => ({ ...p, parcelas: Number(digits) }));
                }}
                disabled={!isCredito}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 disabled:opacity-60"
              />
              {isCredito && (
                <p className="text-[11px] text-slate-400">
                  Permitidas: {allowedParcelas.join(", ")}
                </p>
              )}
            </label>
          </div>

          {requiresCard && (
            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
              <label className="space-y-1 md:col-span-2">
                <span className="text-slate-300">Cartao/conta</span>
                <select
                  value={form.cartaoContaId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm((p) => ({ ...p, cartaoContaId: id, regraId: "" }));
                    void carregarRegras(id);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                >
                  <option value="">Escolha</option>
                  {filteredCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.bandeira ? `- ${c.bandeira}` : ""} {c.pixChave ? "- Pix" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {regraSelecionada && (
                <div className="md:col-span-3 grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Regra aplicada</span>
                    <span className="font-semibold text-slate-100">{regraSelecionada.tipo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Taxa %</span>
                    <span>{((regraSelecionada.taxaPercentual ?? 0) + (regraSelecionada.adicionalParcela ?? 0)).toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Taxa fixa</span>
                    <span>R$ {(regraSelecionada.taxaFixa ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Prazo recebimento</span>
                    <span>{regraSelecionada.prazoEscalonadoPadrao ? "Escalonado 31/30" : `${regraSelecionada.prazoRecebimentoDias ?? 0} dias`}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <label className="space-y-1">
              <span className="text-slate-300">Frete</span>
              <input
                value={form.frete}
                onChange={(e) => setForm((p) => ({ ...p, frete: formatCurrency(e.target.value) }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Desconto</span>
              <input
                value={form.desconto}
                onChange={(e) => setForm((p) => ({ ...p, desconto: formatCurrency(e.target.value) }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.pagoAgora}
                onChange={(e) => setForm((p) => ({ ...p, pagoAgora: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-400"
              />
              <span>Pago agora</span>
            </label>
            <label className="space-y-1 md:col-span-3">
              <span className="text-slate-300">Observacoes</span>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                rows={2}
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
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
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
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
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
              >
                <option value="">Material</option>
                {materiaisFiltro.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">Itens</h4>
              <button
                type="button"
                onClick={adicionarItem}
                className="rounded-lg border border-cyan-500 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500 hover:text-slate-900"
              >
                Adicionar item
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {itens.map((it, idx) => {
                const produtoSelecionado = products.find((p) => p.id === it.produtoId);
                return (
                  <div key={idx} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 md:grid-cols-5">
                    <div className="md:col-span-3 space-y-1">
                      <input
                        placeholder="Buscar produto"
                        value={it.search}
                        onChange={(e) => atualizarItem(idx, { search: e.target.value })}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-50 outline-none focus:border-cyan-400"
                      />
                      <select
                        value={it.produtoId}
                        onChange={(e) => {
                          const produtoId = e.target.value;
                          if (produtoId && itens.some((p, i) => i !== idx && p.produtoId === produtoId)) {
                            setErro("Produto já adicionado. Ajuste a quantidade em vez de repetir.");
                            return;
                          }
                          const produto = products.find((p) => p.id === produtoId);
                          const preco = produto?.preco?.precoVendaAtual ?? 0;
                          atualizarItem(idx, { produtoId, valorUnit: formatCurrencyFromNumber(preco) });
                        }}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
                      >
                        <option value="">Selecione</option>
                        {renderItemOptions(it.search, idx)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Qtd</span>
                      <input
                        inputMode="numeric"
                        value={it.qtde}
                        onChange={(e) => atualizarItem(idx, { qtde: onlyNumbers(e.target.value) })}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
                      />
                      <span className="text-[11px] text-slate-500">
                        Estoque: {produtoSelecionado?.estoque?.quantidadeAtual ?? 0}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Preco</span>
                      <input
                        value={it.valorUnit}
                        onChange={(e) => atualizarItem(idx, { valorUnit: formatCurrency(e.target.value) })}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => removerItem(idx)}
                        className="mt-1 w-full rounded-lg border border-rose-500 px-2 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500 hover:text-slate-900"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={submitVenda}
                disabled={carregando}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {carregando ? "Salvando..." : "Salvar venda"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Vendas registradas</h3>
              <p className="text-sm text-slate-400">Visualize detalhes, itens e recebimentos.</p>
            </div>
            <button
              type="button"
              onClick={() => void carregarTudo()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/70 text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Forma</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-center">Parc.</th>
                  <th className="px-4 py-2 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-100">
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 text-sm">{new Date(v.data).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-sm">{v.cliente?.nome}</td>
                    <td className="px-4 py-2 text-sm">{v.tipoPagamento?.descricao}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${totalColorClass(v.status)}`}>
                      R$ {v.totalVenda?.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">{v.parcelas}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => void abrirDetalhe(v.id)}
                        className="rounded-lg border border-cyan-500 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500 hover:text-slate-900"
                      >
                        Detalhes
                      </button>
                      {v.status !== "paga" && v.status !== "recebido" && v.status !== "cancelada" && v.status !== "cancelado" && (
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPayModal({ id: v.id, data: todayLocal() })}
                            className="rounded-lg border border-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500 hover:text-slate-900"
                          >
                            Marcar pago
                          </button>
                          <button
                            type="button"
                            onClick={() => void cancelarVenda(v.id)}
                            className="rounded-lg border border-rose-500 px-2 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500 hover:text-slate-900 disabled:opacity-60"
                            disabled={cancelando}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                      Nenhuma venda registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-5">
            <h4 className="text-lg font-semibold text-slate-50">Marcar venda como paga</h4>
            <p className="text-sm text-slate-400">Informe a data do pagamento.</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <label className="space-y-1">
                <span className="text-slate-300">Data de pagamento</span>
                <input
                  type="date"
                  value={payModal.data}
                  onChange={(e) => setPayModal((p) => (p ? { ...p, data: e.target.value } : p))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={marcarPago}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-500"
              >
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
          <div className="w-full max-w-5xl rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-50">Detalhes da venda</h4>
                <p className="text-sm text-slate-400">
                  {detalhe.cliente?.nome} - {new Date(detalhe.data).toLocaleDateString()} - {detalhe.parcelas} parcela(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                {detalhe.status !== "paga" && detalhe.status !== "recebido" && detalhe.status !== "cancelada" && detalhe.status !== "cancelado" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPayModal({ id: detalhe.id, data: todayLocal() })}
                      className="rounded-lg border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500 hover:text-slate-900"
                    >
                      Marcar pago
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelarVenda(detalhe.id)}
                      className="rounded-lg border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500 hover:text-slate-900"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetalhe(null)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-rose-500"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-slate-200">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-xl font-semibold text-emerald-300">R$ {detalhe.totalVenda?.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">Forma de pagamento</div>
                <div className="text-sm">{detalhe.tipoPagamento?.descricao}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">Status</div>
                <div className="text-sm capitalize">{detalheStatus || detalhe.status}</div>
              </div>
            </div>

            {detalhe.observacoes && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                {detalhe.observacoes}
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <h5 className="text-sm font-semibold text-slate-100">Itens</h5>
                <div className="mt-2 space-y-2 text-sm">
                  {detalhe.itens?.map((it) => (
                    <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                      <div>
                        <div className="font-semibold text-slate-100">{it.item?.nome}</div>
                        <div className="text-xs text-slate-400">Qtd: {it.qtde}</div>
                      </div>
                      <div className="text-right text-slate-100">
                        <div className="text-xs text-slate-400">Unit: R$ {it.precoUnit.toFixed(2)}</div>
                        <div className="font-semibold text-emerald-300">R$ {it.subtotal.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                  {(!detalhe.itens || detalhe.itens.length === 0) && (
                    <div className="text-xs text-slate-400">Nenhum item</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <h5 className="text-sm font-semibold text-slate-100">Recebimentos</h5>
                {carregandoDetalhe && <div className="text-xs text-slate-400">Carregando...</div>}
                {!carregandoDetalhe && (
                  <div className="mt-2 space-y-2 text-sm">
                    {detalhe.recebimentos?.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">Parcela {r.parcelaNumero}</div>
                          <div className="text-xs text-slate-400">
                            Prevista: {new Date(r.dataPrevista).toLocaleDateString()}
                            {r.dataRecebida ? ` - Recebida: ${new Date(r.dataRecebida).toLocaleDateString()}` : ""}
                          </div>
                          <div className="text-xs text-slate-400">
                            {r.cartaoConta?.nome ? `Cartao: ${r.cartaoConta.nome}` : ""} {r.tipoPagamento?.descricao || ""}
                          </div>
                        </div>
                      <div className="text-right text-slate-100">
                        <div className="text-xs text-slate-400">Bruto: R$ {r.valorBruto.toFixed(2)}</div>
                        <div className="text-xs text-slate-400">Taxa: R$ {r.valorTaxa.toFixed(2)}</div>
                        <div className="font-semibold text-emerald-300">Liquido: R$ {r.valorLiquido.toFixed(2)}</div>
                        <div className="text-[11px] text-slate-400">{statusLabel(r)}</div>
                      </div>
                    </div>
                  ))}
                  {(!detalhe.recebimentos || detalhe.recebimentos.length === 0) && (
                    <div className="text-xs text-slate-400">Nenhum recebimento criado.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg">
            <h4 className="text-lg font-semibold text-slate-50">Novo cliente</h4>
            <p className="text-sm text-slate-400">Cadastre e selecione para esta venda.</p>
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <label className="space-y-1">
                <span className="text-slate-300">Nome*</span>
                <input
                  value={novoCliente.nome}
                  onChange={(e) => setNovoCliente((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  placeholder="Nome do cliente"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-300">Telefone</span>
                <input
                  value={novoCliente.telefone}
                  onChange={(e) => setNovoCliente((p) => ({ ...p, telefone: maskPhone(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  placeholder="(99) 99999-9999"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-300">Email</span>
                <input
                  value={novoCliente.email}
                  onChange={(e) => setNovoCliente((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  placeholder="email@exemplo.com"
                  type="email"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-300">Observacoes</span>
                <textarea
                  value={novoCliente.observacoes}
                  onChange={(e) => setNovoCliente((p) => ({ ...p, observacoes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                  rows={3}
                  placeholder="Observacoes do cliente"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowClienteModal(false);
                  setNovoCliente({ nome: "", telefone: "", email: "" });
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={salvarCliente}
                disabled={salvandoCliente}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {salvandoCliente ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
