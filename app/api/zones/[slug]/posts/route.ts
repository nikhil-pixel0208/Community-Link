import { ok, readJson, requireUserOr401, requireZone, route } from "@/lib/api";
import { createPost, listPosts, tallyVotes } from "@/lib/posts";
import { requireMembership } from "@/lib/zones";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  requireMembership(zone.id, user.id);

  const url = new URL(request.url);
  const posts = listPosts(zone.id, user, {
    template: url.searchParams.get("template"),
    query: url.searchParams.get("q"),
    mine: url.searchParams.get("mine") === "1",
  });

  // Poll tallies are aggregate-only — individual votes stay private.
  const votes: Record<string, Record<number, number>> = {};
  for (const p of posts) {
    if (p.template === "question") votes[p.id] = tallyVotes(p.id);
  }

  return ok({ posts, votes, serverNow: Date.now() });
});

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const user = await requireUserOr401();
  const zone = requireZone(slug);
  const body = await readJson<{
    template?: string;
    payload?: Record<string, unknown>;
    ttlMs?: number;
    count?: number;
    urgency?: string;
    isAnonymous?: boolean;
  }>(request);

  const post = createPost(zone.id, user, {
    template: String(body.template ?? ""),
    payload: body.payload ?? {},
    ttlMs: Number(body.ttlMs ?? 0),
    count: body.count,
    urgency: body.urgency,
    isAnonymous: Boolean(body.isAnonymous),
  });
  return ok({ post }, { status: 201 });
});
