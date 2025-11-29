"use client";

import { useEffect, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Supplier = {
  id: string;
  nome: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
};

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [filter, setFilter] = useState("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function handleCreate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const body = {
      nome: fd.get("nome"),
      endereco: fd.get("endereco") || undefined,
      telefone: novoTelefone || undefined,
      email: fd.get("email") || undefined,
      observacoes: fd.get("observacoes") || undefined,
    };
    await apiFetch("/produtos/fornecedores", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await loadSuppliers();
    form.reset();
    setNovoTelefone("");
    setMessage("Fornecedor cadastrado");
    setError(null);
  }

  async function handleUpdate() {
    if (!editing) return;
    const body = {
      nome: editing.nome,
      endereco: editing.endereco,
      telefone: editing.telefone,
      email: editing.email,
      observacoes: editing.observacoes,
    };
    await apiFetch(`/produtos/fornecedores/${editing.id}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await loadSuppliers();
    setEditing(null);
    setMessage("Fornecedor atualizado");
    setError(null);
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
    <ProtectedShell title="Fornecedores" subtitle="Parceiros de suprimento">
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
        <div className="lg:col-span-1 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Cadastro de fornecedores</h3>
          <p className="text-sm text-slate-400">Contatos e observações.</p>
          <form
            className="mt-4 space-y-3 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await handleCreate(e.currentTarget);
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
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-900 transition hover:bg-cyan-300"
            >
              Salvar fornecedor
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Fornecedores</h3>
              <p className="text-sm text-slate-400">Edite ou exclua (se não estiver em uso).</p>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por nome ou observação"
              className="w-64 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-400"
            />
          </div>

          <div className="mt-4 max-h-[480px] overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-200">
            {loading ? (
              <div className="p-4 text-slate-400">Carregando...</div>
            ) : suppliers.length === 0 ? (
              <div className="p-4 text-slate-400">Nenhum fornecedor cadastrado.</div>
            ) : (
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
                  {suppliers
                    .filter((s) => {
                      const term = filter.toLowerCase();
                      return (
                        s.nome.toLowerCase().includes(term) ||
                        (s.observacoes ?? "").toLowerCase().includes(term)
                      );
                    })
                    .map((s) => (
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
                              onClick={() => setEditing(s)}
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
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedShell>
  );
}
