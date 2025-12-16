"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showLista, setShowLista] = useState(false);
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
      if (showLista === false) setShowLista(true);
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
      setShowLista(true);
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

  return (
    <ProtectedShell title="Clientes" subtitle="Relacionamento e contatos">
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

      <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Clientes</h3>
            <p className="text-sm text-slate-400">Buscar, cadastrar e ver vendas de cada cliente.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400"
            >
              {showForm ? "Fechar" : "Adicionar cliente"}
            </button>
            <button
              onClick={() => setShowLista((v) => !v)}
              className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400 transition"
            >
              {showLista ? "Ocultar lista" : "Mostrar lista"}
            </button>
          </div>
        </div>

        {showForm && (
          <form className="mt-2 grid gap-3 text-sm md:grid-cols-2" onSubmit={handleSubmit}>
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
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={salvandoCliente}
                className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {salvandoCliente ? "Salvando..." : "Salvar cliente"}
              </button>
            </div>
          </form>
        )}

        {showLista && (
          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60">
            <div className="grid gap-3 border-b border-slate-800 bg-slate-900/50 px-4 py-3 text-sm md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Buscar por nome</span>
                <input
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Digite para buscar"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
            {loading ? (
              <div className="p-3 text-sm text-slate-400">Carregando...</div>
            ) : clientes.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">Nenhum cliente cadastrado.</div>
            ) : (
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
            )}
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (page > 1) {
                    void loadClientes(page - 1);
                  }
                }}
                disabled={page === 1 || loading}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-400">Página {page}</span>
              <button
                type="button"
                onClick={() => {
                  if (canLoadMore) {
                    void loadClientes(page + 1);
                  }
                }}
                disabled={!canLoadMore}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {modalCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">{modalCliente.nome}</p>
                <p className="text-xs text-slate-400">
                  {modalCliente.telefone || "-"} • {modalCliente.email || "-"}
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
    </ProtectedShell>
  );
}
