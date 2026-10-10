import type { Database } from "better-sqlite3";
import { nowMs } from "./db";
import type { UserRow } from "./auth";
import { TEMPLATES, type TemplateId } from "./templates";
import type {
  MemberRole,
  PostDTO,
  PostStatus,
  PublicUser,
  ResponseDTO,
  ZoneKind,
  ZoneSummary,
} from "./types";

export function toPublicUser(row: UserRow | undefined | null): PublicUser | null {
  if (!row) return null;
  let skills: string[] = [];
  try {
    skills = JSON.parse(row.skills ?? "[]");
  } catch {
    skills = [];
  }
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarHue: row.avatar_hue,
    bio: row.bio ?? "",
    skills,
    trustScore: row.trust_score,
  };
}

const ANONYMOUS: PublicUser = {
  id: "anonymous",
  handle: "anonymous",
  displayName: "Someone in this zone",
  avatarHue: 215,
  bio: "",
  skills: [],
  trustScore: 50,
};

export interface ZoneRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  lat: number;
  lng: number;
  radius_m: number;
  join_code: string;
  starts_at: number;
  ends_at: number;
  purge_at: number;
  created_by: string | null;
  created_at: number;
  archived_at: number | null;
}

/** Great-circle distance in metres. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function toZoneSummary(
  db: Database,
  zone: ZoneRow,
  viewer: UserRow | null,
  position: { lat: number; lng: number } | null,
): ZoneSummary {
  const memberCount = (
    db
      .prepare("SELECT COUNT(*) AS n FROM memberships WHERE zone_id = ? AND left_at IS NULL AND is_banned = 0")
      .get(zone.id) as { n: number }
  ).n;
  const openPostCount = (
    db.prepare("SELECT COUNT(*) AS n FROM posts WHERE zone_id = ? AND status = 'open'").get(zone.id) as { n: number }
  ).n;

  const membership = viewer
    ? (db
        .prepare("SELECT role, is_banned FROM memberships WHERE zone_id = ? AND user_id = ? AND left_at IS NULL")
        .get(zone.id, viewer.id) as { role: MemberRole; is_banned: number } | undefined)
    : undefined;

  const dist = position ? distanceM(position.lat, position.lng, zone.lat, zone.lng) : null;

  return {
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    kind: zone.kind as ZoneKind,
    description: zone.description,
    lat: zone.lat,
    lng: zone.lng,
    radiusM: zone.radius_m,
    startsAt: zone.starts_at,
    endsAt: zone.ends_at,
    archivedAt: zone.archived_at,
    memberCount,
    openPostCount,
    distanceM: dist,
    inRange: dist === null ? false : dist <= zone.radius_m,
    isMember: Boolean(membership && !membership.is_banned),
    role: membership ? membership.role : null,
    // The join code is a secret handshake: members only.
    joinCode: membership ? zone.join_code : null,
  };
}

export interface PostRow {
  id: string;
  zone_id: string;
  author_id: string;
  template: string;
  title: string;
  body: string;
  payload: string;
  created_at: number;
  expires_at: number;
  resolve_mode: string;
  slots_needed: number;
  slots_filled: number;
  status: string;
  resolved_at: number | null;
  resolved_by: string | null;
  resolution_note: string | null;
  purge_at: number | null;
  is_anonymous: number;
  urgency: string;
  view_count: number;
  pinned: number;
}

interface ResponseRow {
  id: string;
  post_id: string;
  user_id: string;
  kind: string;
  body: string;
  meta: string;
  status: string;
  created_at: number;
}

function toResponseDTO(db: Database, row: ResponseRow, viewerId: string | null): ResponseDTO {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as UserRow | undefined;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(row.meta ?? "{}");
  } catch {
    meta = {};
  }
  return {
    id: row.id,
    user: toPublicUser(user) ?? ANONYMOUS,
    kind: row.kind,
    body: row.body,
    meta,
    status: row.status as ResponseDTO["status"],
    createdAt: row.created_at,
    isMine: row.user_id === viewerId,
  };
}

export function toPostDTO(
  db: Database,
  row: PostRow,
  viewer: UserRow | null,
  viewerRole: MemberRole | null,
): PostDTO {
  const viewerId = viewer?.id ?? null;
  const isAuthor = viewerId === row.author_id;
  const canModerate = viewerRole === "moderator" || viewerRole === "organizer";

  const authorRow = db.prepare("SELECT * FROM users WHERE id = ?").get(row.author_id) as UserRow | undefined;
  const showAuthor = !row.is_anonymous || isAuthor || canModerate;

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  // Verification secrets never leave the author's own session.
  if (!isAuthor) {
    delete payload.secret_check;
    delete payload.withheld;
  }

  const allResponses = db
    .prepare("SELECT * FROM responses WHERE post_id = ? ORDER BY created_at ASC")
    .all(row.id) as ResponseRow[];

  // Responders see their own response; the author (and mods) see everything.
  const visible = allResponses.filter(
    (r) => isAuthor || canModerate || r.user_id === viewerId || r.status === "accepted",
  );

  const mine = allResponses.find((r) => r.user_id === viewerId && r.status !== "withdrawn");

  return {
    id: row.id,
    zoneId: row.zone_id,
    template: row.template as TemplateId,
    title: row.title,
    body: row.body,
    payload,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolveMode: TEMPLATES[row.template as TemplateId]?.resolveMode ?? "manual",
    slotsNeeded: row.slots_needed,
    slotsFilled: row.slots_filled,
    status: row.status as PostStatus,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    purgeAt: row.purge_at,
    urgency: row.urgency as PostDTO["urgency"],
    isAnonymous: Boolean(row.is_anonymous),
    pinned: Boolean(row.pinned),
    author: showAuthor ? toPublicUser(authorRow) : ANONYMOUS,
    isAuthor,
    canModerate,
    responseCount: allResponses.filter((r) => r.status !== "withdrawn").length,
    responses: visible.map((r) => toResponseDTO(db, r, viewerId)),
    myResponse: mine ? toResponseDTO(db, mine, viewerId) : null,
    serverNow: nowMs(),
  };
}
