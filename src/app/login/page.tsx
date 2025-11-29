"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Não foi possível fazer login");
      }

      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("userName", data.user?.name ?? "");
      router.replace("/painel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 lg:flex-row lg:items-center lg:gap-16">
        <div className="mb-12 max-w-xl lg:mb-0">
          <p className="mb-4 inline-flex items-center rounded-full bg-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 ring-1 ring-slate-700">
            Controle de Estoque • Vendas • Financeiro
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
            Bem-vindo de volta, vamos abrir o painel da loja.
          </h1>
          <p className="mt-4 text-lg text-slate-200/80">
            Acesse com suas credenciais para gerenciar produtos, compras, vendas e financeiro em um
            só lugar.
          </p>
          <div className="mt-6 flex items-center gap-3 text-sm text-slate-300/80">
            <span className="h-px w-10 bg-slate-600" />
            Ambiente seguro com autenticação JWT
          </div>
        </div>

        <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-2xl ring-1 ring-slate-800 backdrop-blur">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white">Login</h2>
            <p className="text-sm text-slate-300/80">Entre com seu e-mail corporativo e senha.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="voce@sualoja.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/40">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300/80">
            Não tem acesso?{" "}
            <Link href="#" className="font-semibold text-cyan-300 hover:text-cyan-200">
              Fale com o administrador
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
