import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { listMembers, setMemberRole } from "@/lib/moderation";
import { requireMembership } from "@/lib/zones";
import { HttpError } from "@/lib/auth";
import type { MemberRole } from "@/lib/types";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const me = requireMembership(zone.id, user.id);
  return ok({ members: listMembers(zone.id, user), myRole: me.role });
});

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const body = await readJson<{ userId?: string; role?: string }>(request);
  if (!body.userId) throw new HttpError(400, "Which member?");
  if (!["member", "organizer", "moderator"].includes(String(body.role))) {
    throw new HttpError(400, "Unknown role.");
  }
  setMemberRole(zone.id, user, body.userId, body.role as MemberRole);
  return ok({ members: listMembers(zone.id, user) });
});
