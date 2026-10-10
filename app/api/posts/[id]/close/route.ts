import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { closePost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  const body = await readJson<{ note?: string }>(request);
  const post = closePost(id, user, String(body.note ?? ""));
  return ok({ post });
});
