import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { toggleBlock } from "@/lib/moderation";
import { HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const GET = route(async () => {
  const user = await requireUserOr401();
  const rows = getDb()
    .prepare(
      "SELECT u.id, u.handle, u.display_name FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?",
    )
    .all(user.id) as { id: string; handle: string; display_name: string }[];
  return ok({ blocked: rows });
});

export const POST = route(async (request: Request) => {
  const user = await requireUserOr401();
  const body = await readJson<{ userId?: string }>(request);
  if (!body.userId) throw new HttpError(400, "Who?");
  return ok(toggleBlock(user, body.userId));
});
