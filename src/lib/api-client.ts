"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type ApiOptions = RequestInit & { noAuth?: boolean };

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = options.noAuth ? null : typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const rawMessage = body.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(' ')
      : rawMessage ?? `Erro ${res.status}`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("api-error", { detail: message }));
    }
    throw new Error(message);
  }
  return res.json().catch(() => ({}));
}

export { API_URL };
