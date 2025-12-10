"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
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

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Cliente[]>("/clientes");
      setClientes(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClientes();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
      setError("Email inv?lido");
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
      setError(null);
      formEl.reset();
      setTelefoneInput("");
      setEmailInput("");
      await loadClientes();
      setShowForm(false);
      setShowLista(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cliente");
      setMessage(null);
    } finally {
      setSalvandoCliente(false);
    }
  };

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
            <p className="text-sm text-slate-400">Cadastrar e consultar clientes.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-4 py-2">{c.nome}</td>
                      <td className="px-4 py-2">{c.telefone ?? "-"}</td>
                      <td className="px-4 py-2">{c.email ?? "-"}</td>
                      <td className="px-4 py-2">{c.observacoes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </ProtectedShell>
  );
}
