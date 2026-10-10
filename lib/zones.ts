import { getDb, nowMs } from "./db";
import { newId, newJoinCode, slugify } from "./ids";
import { HttpError, type UserRow } from "./auth";
import { logEvent } from "./lifecycle";
import { distanceM, toZoneSummary, type ZoneRow } from "./serialize";
import type { MemberRole, ZoneKind, ZoneSummary } from "./types";

export const ZONE_KINDS: { id: ZoneKind; label: string; blurb: string }[] = [
  { id: "hackathon", label: "Hackathon", blurb: "Teams, mentors, organisers — all in one hall" },
  { id: "campus", label: "Campus", blurb: "A college or university ground" },
  { id: "event", label: "Event", blurb: "Conference, fest, meetup, wedding" },
  { id: "transit", label: "Transit hub", blurb: "Station, airport, bus terminal" },
  { id: "techpark", label: "Tech park", blurb: "Office campus or business district" },
  { id: "neighbourhood", label: "Neighbourhood", blurb: "A few streets that share a problem" },
];

export function getZoneBySlug(slug: string): ZoneRow | null {
  return (getDb().prepare("SELECT * FROM zones WHERE slug = ?").get(slug) as ZoneRow | undefined) ?? null;
}

export function getZoneById(id: string): ZoneRow | null {
  return (getDb().prepare("SELECT * FROM zones WHERE id = ?").get(id) as ZoneRow | undefined) ?? null;
}

export interface MembershipRow {
  id: string;
  zone_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: number;
  last_seen_at: number;
  left_at: number | null;
  is_banned: number;
  muted_until: number | null;
}

export function getMembership(zoneId: string, userId: string): MembershipRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM memberships WHERE zone_id = ? AND user_id = ?")
      .get(zoneId, userId) as MembershipRow | undefined) ?? null
  );
}

/** Throws unless the user is an active, unbanned member of the zone. */
export function requireMembership(zoneId: string, userId: string): MembershipRow {
  const m = getMembership(zoneId, userId);
  if (!m || m.left_at !== null) throw new HttpError(403, "Join this zone to take part.");
  if (m.is_banned) throw new HttpError(403, "You have been removed from this zone.");
  getDb().prepare("UPDATE memberships SET last_seen_at = ? WHERE id = ?").run(nowMs(), m.id);
  return m;
}

export function requireStaff(zoneId: string, userId: string): MembershipRow {
  const m = requireMembership(zoneId, userId);
  if (m.role !== "organizer" && m.role !== "moderator") {
    throw new HttpError(403, "Only organisers and moderators can do that.");
  }
  return m;
}

export function assertNotMuted(m: MembershipRow): void {
  if (m.muted_until && m.muted_until > nowMs()) {
    const mins = Math.ceil((m.muted_until - nowMs()) / 60000);
    throw new HttpError(403, `You are muted in this zone for another ${mins} minute(s).`);
  }
}

export function listZonesFor(
  viewer: UserRow | null,
  position: { lat: number; lng: number } | null,
): ZoneSummary[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM zones ORDER BY ends_at ASC").all() as ZoneRow[];
  const summaries = rows.map((z) => toZoneSummary(db, z, viewer, position));
  return summaries.sort((a, b) => {
    if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
    if (a.distanceM !== null && b.distanceM !== null) return a.distanceM - b.distanceM;
    return a.endsAt - b.endsAt;
  });
}

export function createZone(
  creator: UserRow,
  input: {
    name: string;
    kind: ZoneKind;
    description?: string;
    lat: number;
    lng: number;
    radiusM: number;
    durationMs: number;
  },
): ZoneRow {
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 3) throw new HttpError(400, "Give the zone a name with at least 3 characters.");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new HttpError(400, "A zone needs a centre point.");
  }

  let slug = slugify(name);
  if (!slug) slug = "zone";
  let candidate = slug;
  let n = 2;
  while (db.prepare("SELECT 1 FROM zones WHERE slug = ?").get(candidate)) {
    candidate = `${slug}-${n++}`;
  }

  const now = nowMs();
  const endsAt = now + Math.max(30 * 60_000, input.durationMs);
  const id = newId("zon");
  db.prepare(
    `INSERT INTO zones (id, slug, name, kind, description, lat, lng, radius_m, join_code,
                        starts_at, ends_at, purge_at, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    candidate,
    name,
    input.kind,
    input.description ?? "",
    input.lat,
    input.lng,
    Math.min(Math.max(50, Math.round(input.radiusM)), 20_000),
    newJoinCode(),
    now,
    endsAt,
    endsAt + 24 * 60 * 60 * 1000, // content survives 24h past the zone, then it's gone
    creator.id,
    now,
  );

  joinZone(id, creator.id, "organizer");
  seedDefaultChannels(id);
  return getZoneById(id)!;
}

export function seedDefaultChannels(zoneId: string): void {
  const db = getDb();
  const now = nowMs();
  const defaults = [
    { slug: "general", name: "General", description: "Everyone in the zone. Think before you broadcast.", kind: "public" },
    {
      slug: "announcements",
      name: "Announcements",
      description: "Organisers post, everyone reads.",
      kind: "announce",
    },
  ];
  for (const c of defaults) {
    const exists = db.prepare("SELECT 1 FROM channels WHERE zone_id = ? AND slug = ?").get(zoneId, c.slug);
    if (exists) continue;
    db.prepare(
      "INSERT INTO channels (id, zone_id, slug, name, description, kind, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(newId("chn"), zoneId, c.slug, c.name, c.description, c.kind, now);
  }
}

export function joinZone(zoneId: string, userId: string, role: MemberRole = "member"): MembershipRow {
  const db = getDb();
  const now = nowMs();
  const existing = getMembership(zoneId, userId);
  if (existing) {
    if (existing.is_banned) throw new HttpError(403, "You have been removed from this zone.");
    db.prepare("UPDATE memberships SET left_at = NULL, last_seen_at = ? WHERE id = ?").run(now, existing.id);
    return getMembership(zoneId, userId)!;
  }
  db.prepare(
    `INSERT INTO memberships (id, zone_id, user_id, role, joined_at, last_seen_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(newId("mem"), zoneId, userId, role, now, now);
  return getMembership(zoneId, userId)!;
}

export function leaveZone(zoneId: string, userId: string): void {
  getDb()
    .prepare("UPDATE memberships SET left_at = ? WHERE zone_id = ? AND user_id = ?")
    .run(nowMs(), zoneId, userId);
}

/**
 * Two ways in, both opt-in:
 *  - you are physically inside the radius, or
 *  - you were given the join code.
 * We never persist the coordinates you prove presence with.
 */
export function joinByProof(
  zone: ZoneRow,
  user: UserRow,
  proof: { code?: string; lat?: number; lng?: number },
): { membership: MembershipRow; method: "code" | "location" } {
  if (zone.archived_at) throw new HttpError(410, "This zone has ended.");

  if (proof.code && proof.code.trim().toUpperCase().replace(/\s/g, "") === zone.join_code) {
    const membership = joinZone(zone.id, user.id);
    logEvent(getDb(), {
      zoneId: zone.id,
      subjectType: "zone",
      subjectId: zone.id,
      type: "created",
      actorId: user.id,
      detail: { action: "joined", method: "code" },
    });
    return { membership, method: "code" };
  }

  if (typeof proof.lat === "number" && typeof proof.lng === "number") {
    const d = distanceM(proof.lat, proof.lng, zone.lat, zone.lng);
    if (d <= zone.radius_m) {
      const membership = joinZone(zone.id, user.id);
      logEvent(getDb(), {
        zoneId: zone.id,
        subjectType: "zone",
        subjectId: zone.id,
        type: "created",
        actorId: user.id,
        detail: { action: "joined", method: "location" },
      });
      return { membership, method: "location" };
    }
    throw new HttpError(
      403,
      `You're about ${formatDistance(d)} away. Get within ${formatDistance(zone.radius_m)} of the zone, or use a join code.`,
    );
  }

  throw new HttpError(400, "Share your location or enter the zone's join code.");
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
