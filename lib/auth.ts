import { cookies } from "next/headers";
import { getDb, nowMs } from "./db";
import { newId } from "./ids";

export const SESSION_COOKIE = "cl_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_hue: number;
  bio: string;
  skills: string;
  trust_score: number;
  share_precise_location: number;
  discoverable: number;
  created_at: number;
}

export function createUser(input: {
  handle: string;
  displayName: string;
  bio?: string;
  skills?: string[];
  avatarHue?: number;
}): UserRow {
  const db = getDb();
  const handle = input.handle.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_.]{3,24}$/.test(handle)) {
    throw new Error("Handle must be 3–24 characters: letters, numbers, dot or underscore.");
  }
  const existing = db.prepare("SELECT id FROM users WHERE handle = ?").get(handle);
  if (existing) throw new Error(`The handle @${handle} is already taken in this space.`);

  const id = newId("usr");
  const hue = input.avatarHue ?? Math.floor(Math.abs(hashCode(handle)) % 360);
  db.prepare(
    `INSERT INTO users (id, handle, display_name, avatar_hue, bio, skills, trust_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 50, ?)`,
  ).run(id, handle, input.displayName.trim() || handle, hue, input.bio ?? "", JSON.stringify(input.skills ?? []), nowMs());

  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function issueSession(userId: string): string {
  const token = newId("ses", 28);
  const now = nowMs();
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

export function revokeSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userForToken(token: string | undefined | null): UserRow | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowMs()) as UserRow | undefined;
  return row ?? null;
}

/** Current user from the session cookie, or null. */
export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
