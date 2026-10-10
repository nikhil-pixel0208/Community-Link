import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { toPublicUser } from "@/lib/serialize";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({
    user: toPublicUser(user),
    privacy: {
      sharePreciseLocation: Boolean(user.share_precise_location),
      discoverable: Boolean(user.discoverable),
    },
  });
});

export const PATCH = route(async (request: Request) => {
  const user = await requireUserOr401();
  const body = await readJson<{
    displayName?: string;
    bio?: string;
    skills?: string[];
    sharePreciseLocation?: boolean;
    discoverable?: boolean;
  }>(request);
  const db = getDb();

  if (typeof body.displayName === "string" && body.displayName.trim()) {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(body.displayName.trim().slice(0, 60), user.id);
  }
  if (typeof body.bio === "string") {
    db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(body.bio.slice(0, 240), user.id);
  }
  if (Array.isArray(body.skills)) {
    const skills = body.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
    db.prepare("UPDATE users SET skills = ? WHERE id = ?").run(JSON.stringify(skills), user.id);
  }
  if (typeof body.sharePreciseLocation === "boolean") {
    db.prepare("UPDATE users SET share_precise_location = ? WHERE id = ?").run(
      body.sharePreciseLocation ? 1 : 0,
      user.id,
    );
  }
  if (typeof body.discoverable === "boolean") {
    db.prepare("UPDATE users SET discoverable = ? WHERE id = ?").run(body.discoverable ? 1 : 0, user.id);
  }

  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as Parameters<typeof toPublicUser>[0];
  return ok({ user: toPublicUser(fresh) });
});
