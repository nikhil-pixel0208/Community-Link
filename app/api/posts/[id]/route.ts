import { HttpError } from "@/lib/auth";
import { ok, requireUserOr401, route } from "@/lib/api";
import { getPostDTO, purgeNow } from "@/lib/posts";
import { tallyVotes } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  const post = getPostDTO(id, user);
  if (!post) throw new HttpError(404, "That post is gone — resolved or expired.");
  return ok({ post, votes: tallyVotes(id) });
});

/** Destroy the content now, skipping the receipt window. */
export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  purgeNow(id, user);
  return ok({ ok: true });
});
