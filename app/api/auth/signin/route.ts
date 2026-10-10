import { getDb } from "@/lib/db";
import { HttpError, createUser, issueSession, setSessionCookie, type UserRow } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/api";
import { toPublicUser } from "@/lib/serialize";

/**
 * Identity, hackathon-style: claim a handle and you're in. No password wall
 * between a judge and the demo — but every session is still a real,
 * server-issued, httpOnly cookie, so authorisation downstream is genuine.
 */
export const POST = route(async (request: Request) => {
  const body = await readJson<{ handle?: string; displayName?: string; userId?: string }>(request);
  const db = getDb();

  let user: UserRow | null = null;

  if (body.userId) {
    user = (db.prepare("SELECT * FROM users WHERE id = ?").get(body.userId) as UserRow | undefined) ?? null;
    if (!user) throw new HttpError(404, "That demo identity no longer exists.");
  } else {
    const handle = (body.handle ?? "").trim().toLowerCase().replace(/^@/, "");
    if (!handle) throw new HttpError(400, "Pick a handle.");
    user = (db.prepare("SELECT * FROM users WHERE handle = ?").get(handle) as UserRow | undefined) ?? null;
    if (!user) {
      user = createUser({ handle, displayName: body.displayName?.trim() || handle });
    }
  }

  const token = issueSession(user.id);
  await setSessionCookie(token);
  return ok({ user: toPublicUser(user) });
});
