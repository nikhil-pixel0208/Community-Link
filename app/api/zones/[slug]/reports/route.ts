import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { fileReport, listReports, resolveReport } from "@/lib/moderation";
import { requireMembership } from "@/lib/zones";
import { HttpError } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  return ok({ reports: listReports(zone.id, user) });
});

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);
  const body = await readJson<{ targetType?: string; targetId?: string; reason?: string; note?: string }>(request);
  if (!body.targetId || !body.targetType || !body.reason) throw new HttpError(400, "Missing report details.");
  fileReport(zone.id, user, {
    targetType: body.targetType,
    targetId: body.targetId,
    reason: body.reason,
    note: body.note,
  });
  return ok({ ok: true }, { status: 201 });
});

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const body = await readJson<{ reportId?: string; action?: string }>(request);
  const actions = ["dismiss", "remove_content", "mute_author", "ban_author"] as const;
  if (!body.reportId || !actions.includes(body.action as (typeof actions)[number])) {
    throw new HttpError(400, "Unknown moderation action.");
  }
  resolveReport(zone.id, user, body.reportId, body.action as (typeof actions)[number]);
  return ok({ reports: listReports(zone.id, user) });
});
