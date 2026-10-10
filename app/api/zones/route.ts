import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok, readJson, readPosition, requireUserOr401, route } from "@/lib/api";
import { toZoneSummary } from "@/lib/serialize";
import { createZone, listZonesFor } from "@/lib/zones";
import type { ZoneKind } from "@/lib/types";

export const GET = route(async (request: Request) => {
  const user = await currentUser();
  const position = readPosition(request);
  return ok({ zones: listZonesFor(user, position) });
});

export const POST = route(async (request: Request) => {
  const user = await requireUserOr401();
  const body = await readJson<{
    name?: string;
    kind?: string;
    description?: string;
    lat?: number;
    lng?: number;
    radiusM?: number;
    durationMs?: number;
  }>(request);

  const zone = createZone(user, {
    name: String(body.name ?? ""),
    kind: (body.kind ?? "event") as ZoneKind,
    description: String(body.description ?? ""),
    lat: Number(body.lat),
    lng: Number(body.lng),
    radiusM: Number(body.radiusM ?? 500),
    durationMs: Number(body.durationMs ?? 24 * 60 * 60 * 1000),
  });

  return ok({ zone: toZoneSummary(getDb(), zone, user, null) }, { status: 201 });
});
