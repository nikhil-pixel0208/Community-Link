import { getDb } from "@/lib/db";
import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { toZoneSummary } from "@/lib/serialize";
import { joinByProof, leaveZone } from "@/lib/zones";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const body = await readJson<{ code?: string; lat?: number; lng?: number }>(request);

  const { method } = joinByProof(zone, user, {
    code: body.code,
    lat: typeof body.lat === "number" ? body.lat : undefined,
    lng: typeof body.lng === "number" ? body.lng : undefined,
  });

  return ok({ zone: toZoneSummary(getDb(), zone, user, null), method });
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  leaveZone(zone.id, user.id);
  return ok({ ok: true });
});
