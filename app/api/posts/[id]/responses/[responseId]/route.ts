import { HttpError } from "@/lib/auth";
import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { decideResponse } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string; responseId: string }> };

/**
 * The author accepting a response is the single most important event in the
 * product: it is what fulfils the post's contract and triggers the vanish.
 */
export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id, responseId } = await ctx.params;
  const user = await requireUserOr401();
  const body = await readJson<{ decision?: string }>(request);
  const decision = body.decision === "declined" ? "declined" : body.decision === "accepted" ? "accepted" : null;
  if (!decision) throw new HttpError(400, "Decision must be 'accepted' or 'declined'.");

  const post = decideResponse(id, responseId, user, decision);
  return ok({ post });
});
