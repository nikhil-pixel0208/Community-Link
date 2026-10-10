import { HttpError } from "@/lib/auth";
import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { getChannel, listChannelMessages, postChannelMessage } from "@/lib/chat";
import { sweep } from "@/lib/lifecycle";
import { requireMembership } from "@/lib/zones";

type Ctx = { params: Promise<{ slug: string; channel: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { slug, channel: channelSlug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);
  sweep();

  const channel = getChannel(zone.id, channelSlug);
  if (!channel) throw new HttpError(404, "No such channel.");
  return ok({ messages: listChannelMessages(channel.id, user), serverNow: Date.now() });
});

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { slug, channel: channelSlug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const channel = getChannel(zone.id, channelSlug);
  if (!channel) throw new HttpError(404, "No such channel.");

  const body = await readJson<{ body?: string }>(request);
  const message = postChannelMessage(zone.id, channel, user, String(body.body ?? ""));
  return ok({ message }, { status: 201 });
});
