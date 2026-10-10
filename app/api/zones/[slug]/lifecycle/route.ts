import { ok, requireUserOr401, requireZone, route } from "@/lib/api";
import { listLifecycle } from "@/lib/moderation";
import { sweep } from "@/lib/lifecycle";
import { requireMembership } from "@/lib/zones";

/**
 * The zone's memory. Content disappears; the *fact* that it existed and why it
 * ended stays, so the community can see the system is honest.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);
  sweep();
  return ok({ events: listLifecycle(zone.id), serverNow: Date.now() });
});
