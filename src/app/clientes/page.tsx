"use client";

import { useState } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { apiFetch } from "@/lib/api-client";

export default function ClientesPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Cadastro de clientes</h3>
          <p className="text-sm text-slate-400">Dados de contato e observações.</p>
          <form
            className="mt-4 space-y-3 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const body = {
                nome: fd.get("nome"),
                telefone: fd.get("telefone") || undefined,
                email: fd.get("email") || undefined,
                observacoes: fd.get("observacoes") || undefined,
              };
              try {
                await apiFetch("/produtos/clientes", {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                setMessage("Cliente cadastrado");
                setError(null);
                e.currentTarget.reset();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro ao salvar");
                setMessage(null);
              }
            }}
          >
            <input
              name="nome"
              required
              placeholder="Nome"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
            />
            <input
              name="telefone"
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
              Salvar cliente
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Histórico de compras</h3>
          <p className="text-sm text-slate-400">(Integre aqui a lista/histórico conforme API)</p>
        </div>
      </div>
    </ProtectedShell>
  );
}
