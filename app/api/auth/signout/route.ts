import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSessionCookie, revokeSession } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const POST = route(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) revokeSession(token);
  await clearSessionCookie();
  return ok({ ok: true });
});
