import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { extendPost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  const body = await readJson<{ extraMs?: number }>(request);
  const post = extendPost(id, user, Number(body.extraMs ?? 60 * 60 * 1000));
  return ok({ post });
});
