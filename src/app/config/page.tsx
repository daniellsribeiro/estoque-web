"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageMeta } from "@/components/page-meta";

type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt?: string;
};

export default function ConfigPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", active: true });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [passwordUser, setPasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [pref, setPref] = useState<{ alertaEstoque: number } | null>(null);
  const [prefOrig, setPrefOrig] = useState<{ alertaEstoque: number } | null>(null);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefEditing, setPrefEditing] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>("/users");
      setUsers(data || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadPreferences();
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Preencha nome, email e senha.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          active: form.active,
        }),
      });
      setMessage("Usuário criado com sucesso.");
      setForm({ name: "", email: "", password: "", active: true });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  const loadPreferences = async () => {
    setPrefLoading(true);
    try {
      const data = await apiFetch<{ alertaEstoque: number }>("/preferences");
      const prefData = data ?? { alertaEstoque: 0 };
      setPref(prefData);
      setPrefOrig(prefData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar preferências");
    } finally {
      setPrefLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!pref) return;
    setPrefSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/preferences", {
        method: "PATCH",
        body: JSON.stringify({ alertaEstoque: pref.alertaEstoque }),
      });
      setPrefOrig({ alertaEstoque: pref.alertaEstoque });
      setMessage("Preferências salvas.");
      setPrefEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar preferências");
    } finally {
      setPrefSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordUser) return;
    if (!passwordForm.password.trim() || passwordForm.password.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setSavingPassword(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/users/${passwordUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: passwordForm.password }),
      });
      setMessage("Senha atualizada com sucesso.");
      setPasswordForm({ password: "", confirm: "" });
      setPasswordUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    setTogglingId(id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !current }),
      });
      setMessage("Status atualizado.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar status");
    } finally {
      setTogglingId(null);
      setConfirmUser(null);
    }
  };

  return (
    <div>
      <PageMeta title="Configurações" subtitle="Preferências e gestão de acesso" />
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg bg-emerald-700/40 px-4 py-2 text-sm text-emerald-50 font-semibold ring-1 ring-emerald-500 shadow shadow-emerald-500/60">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-200 ring-1 ring-rose-500/40">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Usuários</h3>
                <p className="text-sm text-slate-400">Gerencie acesso e status.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewUser(true)}
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-500"
                >
                  Adicionar usuário
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3 lg:hidden">
              {loading ? (
                <div className="rounded-lg bg-slate-900/60 p-3 text-sm text-slate-300 ring-1 ring-slate-800">
                  Carregando...
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-lg bg-slate-900/60 p-3 text-sm text-slate-300 ring-1 ring-slate-800">
                  Nenhum usuário.
                </div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-lg bg-slate-900/60 p-3 text-sm text-slate-200 ring-1 ring-slate-800"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-50">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                      <span className={`text-xs font-semibold ${u.active ? "text-emerald-300" : "text-rose-300"}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Criado em: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordUser({ id: u.id, name: u.name });
                          setPasswordForm({ password: "", confirm: "" });
                        }}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
                      >
                        Alterar senha
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmUser({ id: u.id, name: u.name, active: u.active })}
                        disabled={togglingId === u.id}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          u.active
                            ? "border border-rose-500 text-rose-100 hover:bg-rose-500 hover:text-slate-900"
                            : "border border-emerald-500 text-emerald-100 hover:bg-emerald-500 hover:text-slate-900"
                        } disabled:opacity-60 ml-2`}
                      >
                        {togglingId === u.id ? "Salvando..." : u.active ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 hidden max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 lg:block">
              {loading ? (
                <div className="p-3 text-sm text-slate-400">Carregando...</div>
              ) : users.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">Nenhum usuário.</div>
              ) : (
                <table className="min-w-full text-sm text-slate-200">
                  <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-800">
                        <td className="px-4 py-2">{u.name}</td>
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2">
                          <span className={u.active ? "text-emerald-300" : "text-rose-300"}>
                            {u.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordUser({ id: u.id, name: u.name });
                              setPasswordForm({ password: "", confirm: "" });
                            }}
                            className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
                          >
                            Alterar senha
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUser({ id: u.id, name: u.name, active: u.active })}
                            disabled={togglingId === u.id}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                              u.active
                                ? "border border-rose-500 text-rose-100 hover:bg-rose-500 hover:text-slate-900"
                                : "border border-emerald-500 text-emerald-100 hover:bg-emerald-500 hover:text-slate-900"
                            } disabled:opacity-60 ml-2`}
                          >
                            {togglingId === u.id ? "Salvando..." : u.active ? "Desativar" : "Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Preferências</h3>
                <p className="text-sm text-slate-400">Alertas e parâmetros da loja.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPreferences()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-400"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefEditing((v) => {
                      if (v && prefOrig) setPref(prefOrig);
                      return !v;
                    });
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    prefEditing
                      ? "border border-rose-500 text-rose-100 hover:bg-rose-500 hover:text-slate-900"
                      : "border border-cyan-500 text-cyan-100 hover:bg-cyan-500 hover:text-slate-900"
                  }`}
                >
                  {prefEditing ? "Fechar edição" : "Editar"}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Alerta de estoque (quantidade mínima)</span>
                <input
                  type="number"
                  min={0}
                  value={pref?.alertaEstoque ?? ""}
                  onChange={(e) =>
                    setPref((p) => ({
                      ...(p ?? {}),
                      alertaEstoque: e.target.value === "" ? NaN : Math.max(0, Number(e.target.value)),
                    }))
                  }
                  disabled={!prefEditing}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400 disabled:opacity-50"
                />
                <p className="text-xs text-slate-500">Destaca produtos com quantidade igual ou abaixo desse valor.</p>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pref && prefEditing) setPref({ alertaEstoque: 0 });
                }}
                disabled={!prefEditing}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500 disabled:opacity-50"
              >
                Limpar
              </button>
              <button
                type="button"
                  onClick={() => {
                    if (pref?.alertaEstoque === undefined || Number.isNaN(pref.alertaEstoque)) {
                      setError("Informe um valor de alerta de estoque.");
                      return;
                    }
                    void savePreferences();
                  }}
                disabled={prefSaving || prefLoading || !prefEditing}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {prefSaving ? "Salvando..." : "Salvar preferências"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-5 text-sm text-slate-200 ring-1 ring-slate-700 shadow-2xl">
            <h4 className="text-lg font-semibold text-slate-50">Confirmar status</h4>
            <p className="mt-2 text-slate-300">
              {confirmUser.active
                ? `Desativar o usuário ${confirmUser.name}?`
                : `Ativar o usuário ${confirmUser.name}?`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void toggleActive(confirmUser.id, confirmUser.active)}
                disabled={togglingId === confirmUser.id}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {togglingId === confirmUser.id ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-5 text-sm text-slate-200 ring-1 ring-slate-700 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Alterar senha</h3>
                <p className="text-sm text-slate-400">Usuário: {passwordUser.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPasswordUser(null);
                  setPasswordForm({ password: "", confirm: "" });
                }}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Fechar
              </button>
            </div>
            <div className="mt-3 grid gap-3 text-sm">
              <input
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Nova senha (mín. 6 caracteres)"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Confirmar senha"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordUser(null);
                  setPasswordForm({ password: "", confirm: "" });
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordSave()}
                disabled={savingPassword}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {savingPassword ? "Salvando..." : "Salvar senha"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-5 text-sm text-slate-200 ring-1 ring-slate-700 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Novo usuário</h3>
                <p className="text-sm text-slate-400">Cadastre rapidamente.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewUser(false)}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Fechar
              </button>
            </div>
            <div className="mt-3 grid gap-3 text-sm">
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <input
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Senha (mín. 6 caracteres)"
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 outline-none focus:border-cyan-400"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400"
                />
                <span>Usuário ativo</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm({ name: "", email: "", password: "", active: true })}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
