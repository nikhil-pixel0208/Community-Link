"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

interface SessionValue {
  user: PublicUser | null;
  loading: boolean;
  signIn: (input: { handle?: string; displayName?: string; userId?: string }) => Promise<PublicUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Coarse position, held in memory only, never written to the server. */
  coords: Coords | null;
  locationState: "idle" | "asking" | "granted" | "denied" | "unsupported";
  requestLocation: () => Promise<Coords | null>;
  clearLocation: () => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationState, setLocationState] = useState<SessionValue["locationState"]>("idle");

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: PublicUser | null }>("/api/me");
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (input: { handle?: string; displayName?: string; userId?: string }) => {
    const res = await api<{ user: PublicUser }>("/api/auth/signin", { method: "POST", json: input });
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await api("/api/auth/signout", { method: "POST" });
    setUser(null);
  }, []);

  const requestLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("unsupported");
      return null;
    }
    setLocationState("asking");
    return new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setCoords(next);
          setLocationState("granted");
          resolve(next);
        },
        () => {
          setLocationState("denied");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 },
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setLocationState("idle");
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, signIn, signOut, refresh, coords, locationState, requestLocation, clearLocation }),
    [user, loading, signIn, signOut, refresh, coords, locationState, requestLocation, clearLocation],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
