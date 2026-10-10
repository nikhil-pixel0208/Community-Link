import { ok, requireUserOr401, requireZone, route } from "@/lib/api";
import { listChannels, listStaff } from "@/lib/chat";
import { requireMembership } from "@/lib/zones";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const membership = requireMembership(zone.id, user.id);
  return ok({ channels: listChannels(zone.id), staff: listStaff(zone.id), myRole: membership.role });
});
