"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (payload && typeof payload === "object" && "error" in payload) {
      message = String((payload as { error: unknown }).error);
    }
    throw new ApiError(res.status, message);
  }
  return payload as T;
}

/**
 * Poll a JSON endpoint. Realtime enough for a zone (sub-second feel on action,
 * a few seconds for ambient updates) without a socket layer to babysit.
 */
export function usePoll<T>(
  path: string | null,
  { intervalMs = 4000, enabled = true }: { intervalMs?: number; enabled?: boolean } = {},
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path && enabled));
  const pathRef = useRef(path);
  pathRef.current = path;
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const next = await api<T>(p);
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Network trouble");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path || !enabled) return;
    setLoading(true);
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, enabled, intervalMs, refresh]);

  return { data, error, loading, refresh, setData: setData as never };
}

/** A ticking clock so countdowns stay honest without re-fetching. */
export function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

/* ----------------------------- formatting ----------------------------- */

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 45_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function formatDistance(m: number | null): string {
  if (m === null) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
