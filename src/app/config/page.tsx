"use client";

import { ProtectedShell } from "@/components/protected-shell";

export default function ConfigPage() {
  return (
    <ProtectedShell title="Configurações" subtitle="Preferências da loja">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Usuários</h3>
          <p className="text-sm text-slate-400">Gerencie acesso e status de usuários.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Gerenciar usuários
          </a>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <h3 className="text-lg font-semibold text-slate-50">Preferências</h3>
          <p className="text-sm text-slate-400">Parâmetros da loja e integrações.</p>
          <a
            href="#"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            Ajustar
          </a>
        </div>
      </div>
    </ProtectedShell>
  );
}
