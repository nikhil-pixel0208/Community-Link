import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok, readPosition, requireZone, route } from "@/lib/api";
import { toZoneSummary } from "@/lib/serialize";
import { sweep } from "@/lib/lifecycle";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  sweep();
  const user = await currentUser();
  const zone = requireZone(slug);

  const position = readPosition(request);

  return ok({ zone: toZoneSummary(getDb(), zone, user, position) });
});
