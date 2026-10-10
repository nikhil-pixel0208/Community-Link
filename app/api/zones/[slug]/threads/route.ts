import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { findOrCreateThread, listThreads, toThreadDTO } from "@/lib/chat";
import { requireMembership } from "@/lib/zones";
import { HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);
  return ok({ threads: listThreads(zone.id, user), serverNow: Date.now() });
});

/** Open (or reuse) a private 1:1 line — the "ask the organiser quietly" path. */
export const POST = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);

  const body = await readJson<{ partnerId?: string; topic?: string; postId?: string }>(request);
  if (!body.partnerId) throw new HttpError(400, "Who do you want to message?");
  const partnerMember = getDb()
    .prepare("SELECT 1 FROM memberships WHERE zone_id = ? AND user_id = ? AND left_at IS NULL AND is_banned = 0")
    .get(zone.id, body.partnerId);
  if (!partnerMember) throw new HttpError(404, "That person isn't in this zone.");

  const thread = findOrCreateThread(zone.id, user.id, body.partnerId, {
    topic: body.topic,
    postId: body.postId ?? null,
  });
  return ok({ thread: toThreadDTO(thread, user) }, { status: 201 });
});
