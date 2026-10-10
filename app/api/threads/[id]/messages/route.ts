import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { getThread, listThreadMessages, sendThreadMessage, toThreadDTO } from "@/lib/chat";
import { sweep } from "@/lib/lifecycle";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  sweep();
  const thread = getThread(id, user);
  return ok({
    thread: toThreadDTO(thread, user),
    messages: listThreadMessages(thread.id, user),
    serverNow: Date.now(),
  });
});

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUserOr401();
  const thread = getThread(id, user);
  const body = await readJson<{ body?: string }>(request);
  const message = sendThreadMessage(thread, user, String(body.body ?? ""));
  return ok({ message }, { status: 201 });
});
