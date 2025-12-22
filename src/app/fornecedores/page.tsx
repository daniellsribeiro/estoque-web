"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageMeta } from "@/components/page-meta";

type Supplier = {
  id: string;
  nome: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  principal?: boolean;
};

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [filter, setFilter] = useState("");
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const maskPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Supplier[]>("/produtos/fornecedores");
      setSuppliers(data ?? []);
      setMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter((s) => {
    const term = filter.toLowerCase();
    return s.nome.toLowerCase().includes(term) || (s.observacoes ?? "").toLowerCase().includes(term);
  });

  async function handleCreate(form: HTMLFormElement) {
    if (salvandoCadastro) return;
    const fd = new FormData(form);
    const principal = fd.get("principal") !== null;
    const body = {
      nome: fd.get("nome"),
      endereco: fd.get("endereco") || undefined,
      telefone: novoTelefone || undefined,
      email: fd.get("email") || undefined,
      observacoes: fd.get("observacoes") || undefined,
      principal,
    };
    try {
      setSalvandoCadastro(true);
      setMessage(null);
      setError(null);
      await apiFetch("/produtos/fornecedores", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadSuppliers();
      form.reset();
      setNovoTelefone("");
      setMessage("Fornecedor cadastrado");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setMessage(null);
      throw err;
    } finally {
      setSalvandoCadastro(false);
    }
  }

  async function handleUpdate() {
    if (!editing || salvandoEdicao) return;
    const body = {
      nome: editing.nome,
      endereco: editing.endereco,
      telefone: editing.telefone,
      email: editing.email,
      observacoes: editing.observacoes,
      principal: editing.principal ?? true,
    };
    try {
      setSalvandoEdicao(true);
      setMessage(null);
      setError(null);
      await apiFetch(`/produtos/fornecedores/${editing.id}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadSuppliers();
      setEditing(null);
      setMessage("Fornecedor atualizado");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setMessage(null);
      throw err;
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir fornecedor? Só será removido se não houver compras vinculadas.")) return;
    try {
      await apiFetch(`/produtos/fornecedores/${id}`, { method: "DELETE" });
      await loadSuppliers();
      setMessage("Fornecedor excluído");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
      setMessage(null);
    }
  }

  return (
    <div>
      <PageMeta title="Fornecedores" subtitle="Parceiros de suprimento" />
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

      <div className="space-y-6">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/*<div>
              <h3 className="text-lg font-semibold text-slate-50">Fornecedores</h3>
              <p className="text-sm text-slate-400">Edite ou exclua (se não estiver em uso).</p>
            </div>*/}
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por nome ou observação"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400 md:w-64"
            />
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setNovoTelefone("");
              }}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500"
            >
              Cadastrar fornecedor
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
            {loading ? (
              <div className="p-4 text-slate-400">Carregando...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-4 text-slate-400">Nenhum fornecedor cadastrado.</div>
            ) : (
              <>
                <div className="hidden max-h-[480px] overflow-auto lg:block">
                  <table className="min-w-full">
                    <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-2">Nome</th>
                        <th className="px-4 py-2">Endereço</th>
                        <th className="px-4 py-2">Contato</th>
                        <th className="px-4 py-2">Observações</th>
                        <th className="px-4 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((s) => (
                        <tr key={s.id} className="border-t border-slate-800">
                          <td className="px-4 py-2">{s.nome}</td>
                          <td className="px-4 py-2">{s.endereco || "-"}</td>
                          <td className="px-4 py-2">
                            <div>{s.telefone || "-"}</div>
                            <div className="text-xs text-slate-400">{s.email || "-"}</div>
                          </td>
                          <td className="px-4 py-2">{s.observacoes || "-"}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                                onClick={() => setEditing({ ...s, principal: s.principal ?? true })}
                              >
                                Editar
                              </button>
                              <button
                                className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                                onClick={() => handleDelete(s.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 p-3 lg:hidden">
                  {filteredSuppliers.map((s) => (
                    <div key={s.id} className="rounded-lg bg-slate-900/70 p-3 ring-1 ring-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-50">{s.nome}</p>
                          <p className="text-xs text-slate-400">{s.telefone || "-"}</p>
                          <p className="text-xs text-slate-400">{s.email || "-"}</p>
                        </div>
                        <span className={`text-xs font-semibold ${s.principal ? "text-emerald-300" : "text-slate-400"}`}>
                          {s.principal ? "Principal" : "Secund\u00e1rio"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">Endereço: {s.endereco || "-"}</p>
                      <p className="mt-1 text-xs text-slate-300">Obs: {s.observacoes || "-"}</p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                          onClick={() => setEditing({ ...s, principal: s.principal ?? true })}
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-400"
                          onClick={() => handleDelete(s.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {editing && (
            <div className="mt-4 rounded-lg bg-slate-900/60 p-4 ring-1 ring-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">Editar fornecedor</p>
                <button
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                  onClick={() => setEditing(null)}
                >
                  Fechar
                </button>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  maxLength={30}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <input
                  value={editing.telefone ?? ""}
                  onChange={(e) => setEditing({ ...editing, telefone: maskPhone(e.target.value) })}
                  placeholder="Telefone"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <input
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="Email"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <input
                  value={editing.endereco ?? ""}
                  onChange={(e) => setEditing({ ...editing, endereco: e.target.value })}
                  placeholder="Endereço"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <textarea
                  value={editing.observacoes ?? ""}
                  onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                  placeholder="Observações"
                  className="md:col-span-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
                />
                <label className="md:col-span-2 flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editing.principal ?? true}
                    onChange={(e) => setEditing({ ...editing, principal: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400"
                  />
                  <span>Fornecedor principal</span>
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      await handleUpdate();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao salvar");
                    }
                  }}
                  disabled={salvandoEdicao}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-sm text-slate-200 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-50">Cadastrar fornecedor</p>
                <p className="text-xs text-slate-400">Contatos e observações.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNovoTelefone("");
                }}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await handleCreate(e.currentTarget);
                  setShowCreateModal(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro ao salvar");
                  setMessage(null);
                }
              }}
            >
              <input
                name="nome"
                required
                maxLength={30}
                placeholder="Nome"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="endereco"
                placeholder="Endereço"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="telefone"
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(maskPhone(e.target.value))}
                placeholder="Telefone"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <textarea
                name="observacoes"
                placeholder="Observações"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  name="principal"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400"
                />
                <span>Fornecedor principal</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNovoTelefone("");
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-rose-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoCadastro}
                  className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {salvandoCadastro ? "Salvando..." : "Salvar fornecedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
