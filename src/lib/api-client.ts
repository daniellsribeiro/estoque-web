"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type ApiOptions = RequestInit & { noAuth?: boolean };

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? "include",
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
      if (res.status === 401 || res.status === 403) {
        window.dispatchEvent(new CustomEvent("api-unauthorized"));
      }
    }
    throw new Error(message);
  }
  return res.json().catch(() => ({}));
}

export { API_URL };
