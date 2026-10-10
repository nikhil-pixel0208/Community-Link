import { getDb } from "@/lib/db";
import type { UserRow } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { toPublicUser } from "@/lib/serialize";

/** The demo roster, so a judge can switch seats and see both sides of a 1:1 chat. */
export const GET = route(async () => {
  const rows = getDb()
    .prepare("SELECT * FROM users ORDER BY trust_score DESC LIMIT 40")
    .all() as UserRow[];
  const db = getDb();
  const users = rows.map((u) => {
    const roles = db
      .prepare(
        `SELECT z.name AS zone, m.role FROM memberships m JOIN zones z ON z.id = m.zone_id
          WHERE m.user_id = ? AND m.left_at IS NULL ORDER BY CASE m.role WHEN 'organizer' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END`,
      )
      .all(u.id) as { zone: string; role: string }[];
    return { ...toPublicUser(u)!, roles };
  });
  return ok({ users });
});
