"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageMeta } from "@/components/page-meta";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
};

type Sale = {
  id: string;
  data: string;
  totalVenda: number;
  status: string;
  tipoPagamento?: { descricao: string };
};

type PaginationEntry = number | "ellipsis";

const buildPaginationItems = (current: number, total: number): PaginationEntry[] => {
  const safeTotal = Math.max(1, total);
  if (safeTotal <= 5) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }
  const items: PaginationEntry[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(safeTotal - 1, current + 1);
  if (start > 2) {
    items.push("ellipsis");
  }
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }
  if (end < safeTotal - 1) {
    items.push("ellipsis");
  }
  items.push(safeTotal);
  return items;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [telefoneInput, setTelefoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [modalCliente, setModalCliente] = useState<Cliente | null>(null);
  const [modalVendas, setModalVendas] = useState<Sale[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const searchDebounce = useRef<NodeJS.Timeout | null>(null);
  const firstSearch = useRef(true);
  const PER_PAGE = 20;

  const loadClientes = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroNome.trim()) params.append("nome", filtroNome.trim());
      params.append("page", String(targetPage));
      params.append("limit", String(PER_PAGE));
      const data = await apiFetch<Cliente[]>(`/clientes?${params.toString()}`);
      const list = data ?? [];
      setClientes(list);
      setHasMore(list.length === PER_PAGE);
      setError(null);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClientes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    searchDebounce.current = setTimeout(() => {
      void loadClientes(1);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroNome]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (salvandoCliente) return;
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const body = {
      nome: (fd.get("nome") ?? "").toString().trim(),
      telefone: telefoneInput.trim() || undefined,
      email: emailInput.trim() || undefined,
      observacoes: (fd.get("observacoes") ?? "").toString().trim() || undefined,
    };
    if (!body.nome) {
      setError("Informe o nome do cliente");
      return;
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      setError("Email inválido");
      return;
    }
    try {
      setSalvandoCliente(true);
      setMessage(null);
      setError(null);
      await apiFetch("/clientes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Cliente cadastrado com sucesso");
      formEl.reset();
      setTelefoneInput("");
      setEmailInput("");
      await loadClientes(1);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cliente");
      setMessage(null);
    } finally {
      setSalvandoCliente(false);
    }
  };

  const carregarVendasCliente = async (cliente: Cliente) => {
    setModalCliente(cliente);
    setModalLoading(true);
    try {
      const vendas = await apiFetch<Sale[]>(`/clientes/${cliente.id}/vendas`);
      setModalVendas(vendas || []);
      setError(null);
    } catch (err) {
      setModalVendas([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar vendas do cliente");
    } finally {
      setModalLoading(false);
    }
  };

  const canLoadMore = useMemo(() => hasMore && !loading, [hasMore, loading]);
  const resolvedTotalPages = useMemo(() => (hasMore ? page + 1 : page), [hasMore, page]);
  const paginationItems = useMemo(
    () => buildPaginationItems(page, resolvedTotalPages),
    [page, resolvedTotalPages],
  );

  return (
    <div>
      <PageMeta title="Clientes" subtitle="Relacionamento e contatos" />
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

      <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="flex-1 space-y-1 text-sm">
            <span className="text-xs text-slate-400">Buscar por nome</span>
            <input
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder="Digite para buscar"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400"
          >
            Adicionar cliente
          </button>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60">
          {loading ? (
            <div className="p-3 text-sm text-slate-400">Carregando...</div>
          ) : clientes.length === 0 ? (
            <div className="p-3 text-sm text-slate-400">Nenhum cliente cadastrado.</div>
          ) : (
            <>
              <div className="hidden max-h-[520px] overflow-auto lg:block">
                <table className="min-w-full text-sm text-slate-200">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">Telefone</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Observações</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{c.nome}</td>
                        <td className="px-4 py-2">{c.telefone ?? "-"}</td>
                        <td className="px-4 py-2">{c.email ?? "-"}</td>
                        <td className="px-4 py-2">{c.observacoes ?? "-"}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void carregarVendasCliente(c)}
                            className="rounded-lg border border-cyan-500 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500 hover:text-slate-900"
                          >
                            Ver vendas
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 lg:hidden">
                {clientes.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-900/70 p-3 ring-1 ring-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-50">{c.nome}</p>
                        <p className="text-xs text-slate-400">{c.telefone ?? "-"}</p>
                        <p className="text-xs text-slate-400">{c.email ?? "-"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void carregarVendasCliente(c)}
                        className="rounded-lg border border-cyan-500 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500 hover:text-slate-900"
                      >
                        Ver vendas
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">Obs: {c.observacoes ?? "-"}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="border-t border-slate-800 bg-slate-900/70 px-4 py-2">
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    disabled={page === 1 || loading}
                    onClick={() => void loadClientes(Math.max(1, page - 1))}
                  />
                </PaginationItem>
                {paginationItems.map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        isActive={item === page}
                        disabled={item === page || loading}
                        onClick={() => void loadClientes(item)}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext disabled={!canLoadMore} onClick={() => void loadClientes(page + 1)} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-50">Novo cliente</h4>
                <p className="text-sm text-slate-400">Cadastre e use na lista de clientes.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setTelefoneInput("");
                  setEmailInput("");
                }}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-rose-500"
              >
                Fechar
              </button>
            </div>

            <form className="mt-3 grid gap-3 text-sm md:grid-cols-2" onSubmit={handleSubmit}>
              <input
                name="nome"
                required
                placeholder="Nome"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="telefone"
                value={telefoneInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  let masked = digits;
                  if (digits.length > 2 && digits.length <= 6) {
                    masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                  } else if (digits.length > 6) {
                    masked = `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
                  }
                  setTelefoneInput(masked);
                }}
                placeholder="Telefone"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <textarea
                name="observacoes"
                placeholder="Observações"
                className="md:col-span-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setTelefoneInput("");
                    setEmailInput("");
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-100 transition hover:border-rose-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoCliente}
                  className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {salvandoCliente ? "Salvando..." : "Salvar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">{modalCliente.nome}</p>
                <p className="text-xs text-slate-400">
                  {modalCliente.telefone || "-"} â€¢ {modalCliente.email || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalCliente(null);
                  setModalVendas([]);
                }}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
              {modalLoading ? (
                <div className="p-3 text-slate-400">Carregando vendas...</div>
              ) : modalVendas.length === 0 ? (
                <div className="p-3 text-slate-400">Nenhuma venda para este cliente.</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Forma</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalVendas.map((v) => (
                      <tr key={v.id} className="border-t border-slate-800">
                        <td className="px-3 py-2">{v.data ? new Date(v.data).toLocaleDateString() : "-"}</td>
                        <td className="px-3 py-2">{v.tipoPagamento?.descricao || "-"}</td>
                        <td className="px-3 py-2 text-right">R$ {Number(v.totalVenda || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 capitalize">{v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
