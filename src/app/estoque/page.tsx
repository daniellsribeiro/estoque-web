"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CircleMinus, History, ShoppingCart } from "lucide-react";
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

type CompraDetalhe = {
  id: string;
  data?: string;
  fornecedor?: { nome: string };
  tipoPagamento?: { descricao: string };
  totalCompra?: number;
  status?: string;
  observacoes?: string | null;
  itens?: {
    id: string;
    qtde: number;
    valorUnit: number;
    valorTotal: number;
    item?: { nome: string; codigo: string };
  }[];
};

type EstoqueHistorico = {
  quantidadeAnterior: number;
  quantidadeNova: number;
  quantidadeAdicionada: number;
  quantidadeSubtraida: number;
  motivo: string;
  referencia?: string;
  compraId?: string;
  vendaId?: string;
  dataMudanca?: string;
};

type VendaDetalhe = {
  id: string;
  data?: string;
  cliente?: { nome?: string | null } | null;
  tipoPagamento?: { descricao?: string | null } | null;
  parcelas?: number | null;
  totalVenda?: number | null;
  valorLiquido?: number | null;
  status?: string | null;
  observacoes?: string | null;
  itens?: { id: string; qtde: number; precoUnit: number; subtotal: number; item?: { nome?: string | null; codigo?: string | null } }[];
  recebimentos?: {
    id: string;
    parcelaNumero?: number | null;
    valorBruto?: number;
    valorLiquido?: number;
    valorTaxa?: number;
    dataPrevista?: string | null;
    dataRecebida?: string | null;
    status?: string;
    cartaoConta?: { nome?: string | null } | null;
    tipoPagamento?: { descricao?: string | null } | null;
  }[];
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const formatCurrencyBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoResponse[]>([]);
  const [busca, setBusca] = useState("");
  const [minAlerta, setMinAlerta] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarBaixa, setMostrarBaixa] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCor, setFiltroCor] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [baixaProdutoId, setBaixaProdutoId] = useState("");
  const [baixaQtd, setBaixaQtd] = useState<string>("");
  const [baixaMotivo, setBaixaMotivo] = useState("");
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [historicoProduto, setHistoricoProduto] = useState<ProdutoResponse | null>(null);
  const [historicoMovimentos, setHistoricoMovimentos] = useState<EstoqueHistorico[]>([]);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [detalheCompra, setDetalheCompra] = useState<CompraDetalhe | null>(null);
  const [carregandoCompra, setCarregandoCompra] = useState(false);
  const [detalheVenda, setDetalheVenda] = useState<VendaDetalhe | null>(null);
  const [carregandoVenda, setCarregandoVenda] = useState(false);

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
      const campos = [p.codigo, p.nome, p.tipo, p.cor, p.material, p.tamanho]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchBusca = !term || campos.includes(term);
      const matchTipo = !filtroTipo || p.tipo === filtroTipo;
      const matchCor = !filtroCor || p.cor === filtroCor;
      const matchMaterial = !filtroMaterial || p.material === filtroMaterial;
      return matchBusca && matchTipo && matchCor && matchMaterial;
    });
  }, [produtos, busca, filtroTipo, filtroCor, filtroMaterial]);

  const totalSkus = filtrados.length;
  const totalPecas = filtrados.reduce((acc, p) => acc + (p.quantidadeAtual ?? 0), 0);
  const baixos = filtrados.filter((p) => (p.quantidadeAtual ?? 0) <= minAlerta);

  const tiposFiltro = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.tipo && set.add(p.tipo));
    return Array.from(set);
  }, [produtos]);
  const coresFiltro = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.cor && set.add(p.cor));
    return Array.from(set);
  }, [produtos]);
  const materiaisFiltro = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.material && set.add(p.material));
    return Array.from(set);
  }, [produtos]);

  const enviarBaixa = async () => {
    const qtd = Number(baixaQtd.replace(",", "."));
    if (!baixaProdutoId || !qtd || qtd <= 0) {
      setErro("Informe produto e quantidade maior que zero");
      setSucesso(null);
      return;
    }
    const produtoSelecionado = produtos.find((p) => p.id === baixaProdutoId);
    const saldoAtual = produtoSelecionado?.quantidadeAtual ?? 0;
    if (qtd > saldoAtual) {
      setErro("Quantidade de baixa maior que o saldo do produto");
      setSucesso(null);
      return;
    }
    setErro(null);
    setSucesso(null);
    try {
      const motivoFinal = (baixaMotivo || "BAIXA").trim().toUpperCase();
      await apiFetch(`/produtos/${baixaProdutoId}/estoque/baixa`, {
        method: "POST",
        body: JSON.stringify({
          quantidade: qtd,
          motivo: motivoFinal,
          referencia: undefined,
        }),
      });
      setSucesso("Baixa registrada com sucesso");
      setBaixaQtd("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar baixa");
    }
  };

  const abrirHistorico = async (produto: ProdutoResponse) => {
    setHistoricoProduto(produto);
    setHistoricoMovimentos([]);
    setHistoricoCarregando(true);
    try {
      setErro(null);
      const movimentos = await apiFetch<EstoqueHistorico[]>(`/produtos/${produto.id}/estoque/historico`);
      setHistoricoMovimentos(movimentos ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar histórico");
    } finally {
      setHistoricoCarregando(false);
    }
  };

  const abrirCompra = async (compraId: string) => {
    setDetalheCompra(null);
    setCarregandoCompra(true);
    try {
      const compra = await apiFetch<CompraDetalhe>(`/compras/${compraId}`);
      setDetalheCompra(compra ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar compra");
    } finally {
      setCarregandoCompra(false);
    }
  };

  const abrirVenda = async (vendaId: string) => {
    setDetalheVenda(null);
    setCarregandoVenda(true);
    try {
      const venda = await apiFetch<VendaDetalhe>(`/vendas/${vendaId}`);
      setDetalheVenda(venda ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar venda");
    } finally {
      setCarregandoVenda(false);
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
            <button
              onClick={() => setMostrarBaixa((prev) => !prev)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400"
            >
              {mostrarBaixa ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {mostrarBaixa && (
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
                onChange={(e) => setBaixaMotivo(e.target.value.toUpperCase())}
                placeholder="Motivo"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
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
                    setBaixaMotivo("");
                  }}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 font-semibold text-slate-100 transition hover:bg-slate-600"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}
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

          <div className="grid gap-2 md:grid-cols-4 text-sm">
            <input
              placeholder="Filtrar por nome, código ou observação"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 md:col-span-2"
            />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
            >
              <option value="">Tipo</option>
              {tiposFiltro.map((t) => (
                <option key={t} value={t}>
                  {t}
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
                <option key={c} value={c}>
                  {c}
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
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

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
                    <th className="px-4 py-2 text-right">Ações</th>
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
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirHistorico(p)}
                              className="rounded-lg bg-slate-800 p-2 text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                              title="Ver histórico"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBaixaProdutoId(p.id);
                                setMostrarBaixa(true);
                              }}
                              className="rounded-lg bg-rose-500/90 p-2 text-slate-50 ring-1 ring-rose-400 transition hover:bg-rose-400"
                              title="Registrar baixa"
                            >
                              <CircleMinus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {historicoProduto && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-50">
                    Historico de estoque - {historicoProduto.codigo} ({historicoProduto.nome})
                  </p>
                  <p className="text-xs text-slate-400">Movimentacoes registradas</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHistoricoProduto(null);
                    setHistoricoMovimentos([]);
                    setHistoricoCarregando(false);
                  }}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                >
                  Fechar
                </button>
              </div>
              {historicoCarregando ? (
                <p className="mt-3 text-slate-300">Carregando historico...</p>
              ) : historicoMovimentos.length ? (
                <ul className="mt-3 space-y-2">
                  {historicoMovimentos.map((mov, idx) => (
                    <li
                      key={`${mov.dataMudanca ?? ""}-${idx}`}
                      className="rounded-lg bg-slate-800/60 px-3 py-2 ring-1 ring-slate-700/60"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-50">{mov.motivo}</p>
                          {mov.referencia && <p className="text-xs text-slate-400">Ref: {mov.referencia}</p>}
                        </div>
                        <span className="text-xs text-slate-400">
                          {mov.dataMudanca ? new Date(mov.dataMudanca).toLocaleString("pt-BR") : "-"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        De {mov.quantidadeAnterior} para {mov.quantidadeNova}
                      </p>
                      <div className="mt-1 flex gap-4 text-sm font-semibold">
                        <span className="text-emerald-200">+{mov.quantidadeAdicionada}</span>
                        <span className="text-rose-200">-{mov.quantidadeSubtraida}</span>
                      </div>
                      {(mov.compraId || mov.vendaId) && (
                        <div className="mt-2 flex gap-2">
                          {mov.compraId && (
                            <button
                              type="button"
                              onClick={() => abrirCompra(mov.compraId as string)}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                              title="Ver detalhes da compra"
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Compra
                            </button>
                          )}
                          {mov.vendaId && (
                            <button
                              type="button"
                              onClick={() => abrirVenda(mov.vendaId as string)}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                              title="Ver detalhes da venda"
                            >
                              <BadgeDollarSign className="h-4 w-4" />
                              Venda
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-300">Sem historico registrado para este produto.</p>
              )}
            </div>
          )}

        </div>
      </div>

      {(carregandoCompra || detalheCompra) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Detalhes da compra</p>
                {detalheCompra?.id && <p className="text-xs text-slate-400">ID: {detalheCompra.id}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetalheCompra(null);
                  setCarregandoCompra(false);
                }}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
            {carregandoCompra ? (
              <p className="mt-4 text-slate-300">Carregando compra...</p>
            ) : detalheCompra ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-400">Fornecedor</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.fornecedor?.nome ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Pagamento</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.tipoPagamento?.descricao ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Data</p>
                    <p className="font-semibold text-slate-50">
                      {detalheCompra.data ? detalheCompra.data.slice(0, 10) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="font-semibold text-slate-50">{detalheCompra.status ?? "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-slate-50">
                    {formatCurrencyBRL(Number(detalheCompra.totalCompra ?? 0))}
                  </p>
                  {detalheCompra.observacoes && (
                    <p className="mt-2 text-xs text-slate-400">Obs: {detalheCompra.observacoes}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Itens</p>
                  {detalheCompra.itens && detalheCompra.itens.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {detalheCompra.itens.map((it) => (
                        <li
                          key={it.id}
                          className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-50">
                                {it.item?.nome ?? "-"} ({it.item?.codigo ?? ""})
                              </p>
                              <p className="text-xs text-slate-400">Qtd: {it.qtde}</p>
                            </div>
                            <div className="text-right text-xs text-slate-300">
                              <div>Unit: {formatCurrencyBRL(Number(it.valorUnit ?? 0))}</div>
                              <div>Total: {formatCurrencyBRL(Number(it.valorTotal ?? 0))}</div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
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

      {(carregandoVenda || detalheVenda) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Detalhes da venda</p>
                {detalheVenda?.id && <p className="text-xs text-slate-400">ID: {detalheVenda.id}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetalheVenda(null);
                  setCarregandoVenda(false);
                }}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
            {carregandoVenda ? (
              <p className="mt-4 text-slate-300">Carregando venda...</p>
            ) : detalheVenda ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-400">Cliente</p>
                    <p className="font-semibold text-slate-50">{detalheVenda.cliente?.nome ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Pagamento</p>
                    <p className="font-semibold text-slate-50">{detalheVenda.tipoPagamento?.descricao ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Data</p>
                    <p className="font-semibold text-slate-50">
                      {detalheVenda.data ? detalheVenda.data.slice(0, 10) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Parcelas</p>
                    <p className="font-semibold text-slate-50">{detalheVenda.parcelas ?? "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-slate-50">
                    {formatCurrencyBRL(Number(detalheVenda.totalVenda ?? 0))}
                  </p>
                  <p className="text-xs text-slate-400">
                    Líquido: {formatCurrencyBRL(Number(detalheVenda.valorLiquido ?? detalheVenda.totalVenda ?? 0))}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">Status: {detalheVenda.status ?? "-"}</p>
                  {detalheVenda.observacoes && (
                    <p className="mt-2 text-xs text-slate-400">Obs: {detalheVenda.observacoes}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Itens</p>
                  {detalheVenda.itens && detalheVenda.itens.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {detalheVenda.itens.map((it) => (
                        <li
                          key={it.id}
                          className="rounded-lg bg-slate-800/60 p-3 ring-1 ring-slate-700/60"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-50">
                                {it.item?.nome ?? "-"} ({it.item?.codigo ?? ""})
                              </p>
                              <p className="text-xs text-slate-400">Qtd: {it.qtde}</p>
                            </div>
                            <div className="text-right text-xs text-slate-300">
                              <div>Unit: {formatCurrencyBRL(Number(it.precoUnit ?? 0))}</div>
                              <div>Total: {formatCurrencyBRL(Number(it.subtotal ?? 0))}</div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-slate-300">Nenhum item listado.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Recebimentos</p>
                  {detalheVenda.recebimentos && detalheVenda.recebimentos.length > 0 ? (
                    <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
                      <table className="min-w-full text-xs text-slate-200">
                        <thead className="bg-slate-900/70 text-left uppercase text-[11px] text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Parcela</th>
                            <th className="px-3 py-2">Prevista</th>
                            <th className="px-3 py-2">Recebida</th>
                            <th className="px-3 py-2 text-right">Bruto</th>
                            <th className="px-3 py-2 text-right">Taxa</th>
                            <th className="px-3 py-2 text-right">Líquido</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalheVenda.recebimentos.map((r) => (
                            <tr key={r.id} className="border-t border-slate-800">
                              <td className="px-3 py-2">{r.parcelaNumero ?? "-"}</td>
                              <td className="px-3 py-2">{r.dataPrevista ? r.dataPrevista.slice(0, 10) : "-"}</td>
                              <td className="px-3 py-2">{r.dataRecebida ? r.dataRecebida.slice(0, 10) : "-"}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyBRL(Number(r.valorBruto ?? 0))}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyBRL(Number(r.valorTaxa ?? 0))}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyBRL(Number(r.valorLiquido ?? 0))}</td>
                              <td className="px-3 py-2 capitalize">{r.status ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-300">Nenhum recebimento listado.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-rose-200">Venda não encontrada.</p>
            )}
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
