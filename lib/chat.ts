import { getDb, nowMs } from "./db";
import { newId } from "./ids";
import { HttpError, type UserRow } from "./auth";
import { toPublicUser } from "./serialize";
import { assertNotMuted, getMembership, requireMembership } from "./zones";
import type { ChannelDTO, ChannelMessageDTO, MemberRole, ThreadDTO, ThreadMessageDTO } from "./types";

/** Zone chatter self-destructs too — it is context, not an archive. */
export const CHANNEL_MESSAGE_TTL_MS = 12 * 60 * 60 * 1000;

export interface ChannelRow {
  id: string;
  zone_id: string;
  slug: string;
  name: string;
  description: string;
  kind: "public" | "announce";
  created_at: number;
}

export interface ThreadRow {
  id: string;
  zone_id: string;
  user_lo: string;
  user_hi: string;
  topic: string;
  post_id: string | null;
  created_at: number;
  closed_at: number | null;
  close_reason: string | null;
}

/* ------------------------------------------------------------------ *
 * 1 → many : public zone channels
 * ------------------------------------------------------------------ */

export function listChannels(zoneId: string): ChannelDTO[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM channels WHERE zone_id = ? ORDER BY created_at ASC").all(zoneId) as ChannelRow[];
  return rows.map((c) => {
    const stats = db
      .prepare(
        "SELECT COUNT(*) AS n, MAX(created_at) AS last FROM channel_messages WHERE channel_id = ? AND deleted_at IS NULL",
      )
      .get(c.id) as { n: number; last: number | null };
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      kind: c.kind,
      messageCount: stats.n,
      lastMessageAt: stats.last,
    };
  });
}

export function getChannel(zoneId: string, slug: string): ChannelRow | null {
  return (
    (getDb().prepare("SELECT * FROM channels WHERE zone_id = ? AND slug = ?").get(zoneId, slug) as
      | ChannelRow
      | undefined) ?? null
  );
}

export function listChannelMessages(channelId: string, viewer: UserRow, limit = 100): ChannelMessageDTO[] {
  const db = getDb();
  const blocked = new Set(
    (db.prepare("SELECT blocked_id FROM blocks WHERE blocker_id = ?").all(viewer.id) as { blocked_id: string }[]).map(
      (b) => b.blocked_id,
    ),
  );
  const rows = db
    .prepare(
      `SELECT m.*, u.id AS u_id, u.handle, u.display_name, u.avatar_hue, u.bio, u.skills, u.trust_score,
              u.share_precise_location, u.discoverable, u.created_at AS u_created
         FROM channel_messages m JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC LIMIT ?`,
    )
    .all(channelId, limit) as Record<string, unknown>[];

  return rows
    .reverse()
    .filter((r) => !blocked.has(r.user_id as string))
    .map((r) => ({
      id: r.id as string,
      user: toPublicUser({
        id: r.u_id as string,
        handle: r.handle as string,
        display_name: r.display_name as string,
        avatar_hue: r.avatar_hue as number,
        bio: r.bio as string,
        skills: r.skills as string,
        trust_score: r.trust_score as number,
        share_precise_location: r.share_precise_location as number,
        discoverable: r.discoverable as number,
        created_at: r.u_created as number,
      })!,
      body: r.body as string,
      createdAt: r.created_at as number,
      expiresAt: (r.expires_at as number | null) ?? null,
      isMine: r.user_id === viewer.id,
      postId: (r.post_id as string | null) ?? null,
    }));
}

export function postChannelMessage(
  zoneId: string,
  channel: ChannelRow,
  user: UserRow,
  body: string,
): ChannelMessageDTO {
  const membership = requireMembership(zoneId, user.id);
  assertNotMuted(membership);

  const text = body.trim();
  if (!text) throw new HttpError(400, "Say something first.");
  if (text.length > 1200) throw new HttpError(400, "Keep it under 1200 characters.");

  if (channel.kind === "announce" && membership.role === "member") {
    throw new HttpError(
      403,
      "Only organisers can broadcast here. Use General, or message an organiser privately.",
    );
  }

  const now = nowMs();
  const id = newId("msg");
  getDb()
    .prepare(
      "INSERT INTO channel_messages (id, channel_id, user_id, body, created_at, expires_at) VALUES (?,?,?,?,?,?)",
    )
    .run(id, channel.id, user.id, text, now, now + CHANNEL_MESSAGE_TTL_MS);

  return {
    id,
    user: toPublicUser(user)!,
    body: text,
    createdAt: now,
    expiresAt: now + CHANNEL_MESSAGE_TTL_MS,
    isMine: true,
    postId: null,
  };
}

/* ------------------------------------------------------------------ *
 * 1 → 1 : private threads (the "quietly ask an organiser" path)
 * ------------------------------------------------------------------ */

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function findOrCreateThread(
  zoneId: string,
  userA: string,
  userB: string,
  opts: { topic?: string; postId?: string | null } = {},
): ThreadRow {
  if (userA === userB) throw new HttpError(400, "You can't open a thread with yourself.");
  const db = getDb();
  const [lo, hi] = pair(userA, userB);
  const postId = opts.postId ?? null;

  const existing = db
    .prepare(
      `SELECT * FROM dm_threads
        WHERE zone_id = ? AND user_lo = ? AND user_hi = ? AND (post_id IS ? OR post_id = ?)`,
    )
    .get(zoneId, lo, hi, postId, postId) as ThreadRow | undefined;
  if (existing) return existing;

  // A block in either direction kills the thread before it starts.
  const blocked = db
    .prepare(
      "SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
    )
    .get(userA, userB, userB, userA);
  if (blocked) throw new HttpError(403, "You can't message this person.");

  const id = newId("thr");
  db.prepare(
    "INSERT INTO dm_threads (id, zone_id, user_lo, user_hi, topic, post_id, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(id, zoneId, lo, hi, opts.topic ?? "", postId, nowMs());
  return db.prepare("SELECT * FROM dm_threads WHERE id = ?").get(id) as ThreadRow;
}

export function listThreads(zoneId: string, viewer: UserRow): ThreadDTO[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM dm_threads WHERE zone_id = ? AND (user_lo = ? OR user_hi = ?) ORDER BY created_at DESC")
    .all(zoneId, viewer.id, viewer.id) as ThreadRow[];

  return rows
    .map((t) => toThreadDTO(t, viewer))
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
}

export function toThreadDTO(t: ThreadRow, viewer: UserRow): ThreadDTO {
  const db = getDb();
  const partnerId = t.user_lo === viewer.id ? t.user_hi : t.user_lo;
  const partner = db.prepare("SELECT * FROM users WHERE id = ?").get(partnerId) as UserRow | undefined;
  const membership = getMembership(t.zone_id, partnerId);
  const last = db
    .prepare("SELECT body, created_at FROM dm_messages WHERE thread_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .get(t.id) as { body: string; created_at: number } | undefined;
  const unread = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM dm_messages WHERE thread_id = ? AND user_id != ? AND read_at IS NULL AND deleted_at IS NULL",
      )
      .get(t.id, viewer.id) as { n: number }
  ).n;
  const post = t.post_id
    ? (db.prepare("SELECT title FROM posts WHERE id = ?").get(t.post_id) as { title: string } | undefined)
    : undefined;

  return {
    id: t.id,
    zoneId: t.zone_id,
    partner: toPublicUser(partner) ?? {
      id: partnerId,
      handle: "unknown",
      displayName: "Former member",
      avatarHue: 0,
      bio: "",
      skills: [],
      trustScore: 0,
    },
    partnerRole: (membership?.role ?? "member") as MemberRole,
    topic: t.topic,
    postId: t.post_id,
    postTitle: post?.title ?? null,
    createdAt: t.created_at,
    closedAt: t.closed_at,
    closeReason: t.close_reason,
    lastMessageAt: last?.created_at ?? null,
    lastMessagePreview: last?.body?.slice(0, 120) ?? "",
    unreadCount: unread,
  };
}

export function getThread(threadId: string, viewer: UserRow): ThreadRow {
  const t = getDb().prepare("SELECT * FROM dm_threads WHERE id = ?").get(threadId) as ThreadRow | undefined;
  if (!t) throw new HttpError(404, "That conversation no longer exists.");
  if (t.user_lo !== viewer.id && t.user_hi !== viewer.id) throw new HttpError(403, "Not your conversation.");
  return t;
}

export function listThreadMessages(threadId: string, viewer: UserRow): ThreadMessageDTO[] {
  const db = getDb();
  db.prepare("UPDATE dm_messages SET read_at = ? WHERE thread_id = ? AND user_id != ? AND read_at IS NULL").run(
    nowMs(),
    threadId,
    viewer.id,
  );
  const rows = db
    .prepare("SELECT * FROM dm_messages WHERE thread_id = ? AND deleted_at IS NULL ORDER BY created_at ASC")
    .all(threadId) as { id: string; user_id: string; body: string; created_at: number; read_at: number | null }[];
  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    body: m.body,
    createdAt: m.created_at,
    isMine: m.user_id === viewer.id,
    readAt: m.read_at,
  }));
}

export function sendThreadMessage(thread: ThreadRow, user: UserRow, body: string): ThreadMessageDTO {
  const membership = requireMembership(thread.zone_id, user.id);
  assertNotMuted(membership);
  if (thread.closed_at) throw new HttpError(410, "This conversation is closed — its purpose was served.");

  const text = body.trim();
  if (!text) throw new HttpError(400, "Write a message first.");
  if (text.length > 2000) throw new HttpError(400, "Keep it under 2000 characters.");

  const partnerId = thread.user_lo === user.id ? thread.user_hi : thread.user_lo;
  const blocked = getDb()
    .prepare("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?")
    .get(partnerId, user.id);
  if (blocked) throw new HttpError(403, "You can't message this person.");

  const id = newId("dmm");
  const now = nowMs();
  getDb()
    .prepare("INSERT INTO dm_messages (id, thread_id, user_id, body, created_at) VALUES (?,?,?,?,?)")
    .run(id, thread.id, user.id, text, now);

  return { id, userId: user.id, body: text, createdAt: now, isMine: true, readAt: null };
}

/** Organisers + moderators of a zone — the "who can I ask privately" directory. */
export function listStaff(zoneId: string): { user: ReturnType<typeof toPublicUser>; role: MemberRole }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.*, m.role FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.zone_id = ? AND m.left_at IS NULL AND m.is_banned = 0 AND m.role IN ('organizer','moderator')
        ORDER BY m.role DESC, u.display_name ASC`,
    )
    .all(zoneId) as (UserRow & { role: MemberRole })[];
  return rows.map((r) => ({ user: toPublicUser(r), role: r.role }));
}
