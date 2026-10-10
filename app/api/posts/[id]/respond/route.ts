import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { respondToPost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  const body = await readJson<{
    body?: string;
    kind?: string;
    meta?: Record<string, unknown>;
    openThread?: boolean;
  }>(request);

  const result = respondToPost(id, user, body);
  return ok(result, { status: 201 });
});
