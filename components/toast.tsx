"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Tone = "info" | "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
}

const Ctx = createContext<{
  push: (t: { tone?: Tone; title: string; detail?: string }) => void;
} | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: { tone?: Tone; title: string; detail?: string }) => {
    const id = ++seq;
    setItems((prev) => [...prev.slice(-3), { id, tone: t.tone ?? "info", title: t.title, detail: t.detail }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-rise pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${
              t.tone === "error"
                ? "border-rose-500/40 bg-rose-950/80 text-rose-100"
                : t.tone === "success"
                  ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-100"
                  : "border-ink-600 bg-ink-850/90 text-ink-100"
            }`}
          >
            <p className="font-medium">{t.title}</p>
            {t.detail ? <p className="mt-0.5 text-xs opacity-75">{t.detail}</p> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.push;
}
