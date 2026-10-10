import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { ok, readJson, requireUserOr401, route } from "@/lib/api";
import { toZoneSummary, type ZoneRow } from "@/lib/serialize";
import { joinByProof } from "@/lib/zones";

/** One shot: resolve a code to its zone and walk in. */
export const POST = route(async (request: Request) => {
  const user = await requireUserOr401();
  const body = await readJson<{ code?: string }>(request);
  const code = (body.code ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (!code) throw new HttpError(400, "Enter a zone code.");

  const db = getDb();
  const zone = db.prepare("SELECT * FROM zones WHERE join_code = ?").get(code) as ZoneRow | undefined;
  if (!zone) throw new HttpError(404, "No zone uses that code.");

  joinByProof(zone, user, { code });
  return ok({ zone: toZoneSummary(db, zone, user, null) });
});
