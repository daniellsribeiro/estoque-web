"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string };

export function GlobalNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as string;
      setToasts((prev) => [...prev, { id: Date.now(), message: detail }]);
    };
    window.addEventListener("api-error", handler);
    return () => window.removeEventListener("api-error", handler);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="w-72 rounded-lg bg-rose-500/90 px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-rose-200/60"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
