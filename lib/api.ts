import { NextResponse } from "next/server";
import { HttpError, currentUser, type UserRow } from "./auth";
import { ensureSweeper } from "./lifecycle";
import { ensureSeed } from "./seed";
import { getZoneBySlug } from "./zones";
import type { ZoneRow } from "./serialize";

/**
 * Both calls are idempotent and cost a single indexed lookup once warm, so we
 * run them per request rather than caching a `booted` flag — that way wiping
 * the database underneath a running server recovers on the next request.
 */
function boot() {
  ensureSeed();
  ensureSweeper();
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function fail(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/** Wraps a route handler: boots the app, maps thrown HttpErrors to responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      boot();
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error("[api]", err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      return fail(500, message);
    }
  };
}

export async function requireUserOr401(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export function requireZone(slug: string): ZoneRow {
  const zone = getZoneBySlug(slug);
  if (!zone) throw new HttpError(404, "That zone doesn't exist (or it already ended).");
  return zone;
}

/**
 * Coarse position from the query string, or null.
 * Absent params must stay absent — `Number(null)` is 0, which would silently
 * place every user off the coast of Africa.
 */
export function readPosition(request: Request): { lat: number; lng: number } | null {
  const url = new URL(request.url);
  const rawLat = url.searchParams.get("lat");
  const rawLng = url.searchParams.get("lng");
  if (rawLat === null || rawLng === null) return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
}
