import type { Database } from "better-sqlite3";
import { getDb, nowMs } from "./db";
import { newId } from "./ids";
import { EXPIRY_GRACE_MS, RESOLUTION_GRACE_MS, TEMPLATES, type TemplateId } from "./templates";

/**
 * The lifecycle ("vanish") engine.
 *
 * Community Link's rule: no post outlives its purpose. A post leaves the feed
 * the instant either
 *   (a) its resolution contract is satisfied — the thing it asked for happened, or
 *   (b) its timeline runs out.
 *
 * Resolution flips it to a short-lived receipt that only the people involved can
 * see; the sweeper then hard-deletes the row. We keep an append-only
 * `lifecycle_events` trail so the zone can always answer "what happened to it?"
 * without keeping the content itself.
 */

export type LifecycleEventType =
  | "created"
  | "responded"
  | "withdrawn"
  | "accepted"
  | "declined"
  | "resolved"
  | "expired"
  | "removed"
  | "purged"
  | "extended"
  | "thread_closed"
  | "zone_archived";

export function logEvent(
  db: Database,
  args: {
    zoneId: string;
    subjectType: "post" | "thread" | "message" | "zone";
    subjectId: string;
    type: LifecycleEventType;
    actorId?: string | null;
    detail?: Record<string, unknown>;
  },
): void {
  db.prepare(
    `INSERT INTO lifecycle_events (id, zone_id, subject_type, subject_id, type, actor_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("evt"),
    args.zoneId,
    args.subjectType,
    args.subjectId,
    args.type,
    args.actorId ?? null,
    JSON.stringify(args.detail ?? {}),
    nowMs(),
  );
}

interface PostRow {
  id: string;
  zone_id: string;
  author_id: string;
  template: TemplateId;
  title: string;
  status: string;
  expires_at: number;
  resolve_mode: string;
  slots_needed: number;
  slots_filled: number;
  purge_at: number | null;
  resolved_at: number | null;
}

/**
 * Mark a post fulfilled. This is the moment the post stops being a post and
 * becomes a disappearing receipt.
 */
export function resolvePost(
  db: Database,
  postId: string,
  actorId: string | null,
  reason: string,
  detail: Record<string, unknown> = {},
): void {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId) as PostRow | undefined;
  if (!post || post.status !== "open") return;

  const at = nowMs();
  db.prepare(
    `UPDATE posts
        SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution_note = ?, purge_at = ?
      WHERE id = ?`,
  ).run(at, actorId, reason, at + RESOLUTION_GRACE_MS, postId);

  logEvent(db, {
    zoneId: post.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: "resolved",
    actorId,
    detail: { reason, template: post.template, title: post.title, ...detail },
  });

  // Any private thread spun up *for* this post has served its purpose too.
  closeThreadsForPost(db, postId, "The request this thread was about is resolved.");
}

export function closeThreadsForPost(db: Database, postId: string, reason: string): void {
  const threads = db
    .prepare("SELECT id, zone_id FROM dm_threads WHERE post_id = ? AND closed_at IS NULL")
    .all(postId) as { id: string; zone_id: string }[];
  const at = nowMs();
  for (const t of threads) {
    db.prepare("UPDATE dm_threads SET closed_at = ?, close_reason = ? WHERE id = ?").run(at, reason, t.id);
    logEvent(db, {
      zoneId: t.zone_id,
      subjectType: "thread",
      subjectId: t.id,
      type: "thread_closed",
      detail: { reason, postId },
    });
  }
}

/**
 * Re-evaluate a post's resolution contract after a response changes.
 * Returns true if the post resolved as a result.
 */
export function evaluateResolution(db: Database, postId: string, actorId: string | null): boolean {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId) as PostRow | undefined;
  if (!post || post.status !== "open") return false;

  const def = TEMPLATES[post.template];
  if (!def) return false;

  const accepted = db
    .prepare("SELECT COUNT(*) AS n FROM responses WHERE post_id = ? AND status = 'accepted'")
    .get(postId) as { n: number };

  db.prepare("UPDATE posts SET slots_filled = ? WHERE id = ?").run(accepted.n, postId);

  switch (def.resolveMode) {
    case "claim_confirm":
      // One confirmed claim means the item changed hands. Done.
      if (accepted.n >= 1) {
        resolvePost(db, postId, actorId, "Handover confirmed", { acceptedCount: accepted.n });
        return true;
      }
      return false;

    case "fill_slots":
      if (accepted.n >= post.slots_needed) {
        resolvePost(db, postId, actorId, "All slots filled", {
          filled: accepted.n,
          needed: post.slots_needed,
        });
        return true;
      }
      return false;

    case "quota": {
      const claims = db
        .prepare("SELECT COUNT(*) AS n FROM responses WHERE post_id = ? AND status IN ('pending','accepted')")
        .get(postId) as { n: number };
      db.prepare("UPDATE posts SET slots_filled = ? WHERE id = ?").run(claims.n, postId);
      if (claims.n >= post.slots_needed) {
        resolvePost(db, postId, actorId, "Every claim taken", { claims: claims.n });
        return true;
      }
      return false;
    }

    case "manual":
      // The author accepting an answer *is* the author saying "I'm done".
      if (accepted.n >= 1) {
        resolvePost(db, postId, actorId, "Marked answered by the author", { acceptedCount: accepted.n });
        return true;
      }
      return false;

    case "deadline":
    default:
      // Purely time-bound: only the clock (or an explicit close) ends it.
      return false;
  }
}

/**
 * The sweeper. Idempotent and cheap — safe to call on every read as well as on
 * a timer, which is what keeps the UI honest without a job queue.
 */
export function sweep(db: Database = getDb()): {
  expired: number;
  purged: number;
  messagesPurged: number;
  zonesArchived: number;
} {
  const now = nowMs();
  let expired = 0;
  let purged = 0;
  let messagesPurged = 0;
  let zonesArchived = 0;

  const run = db.transaction(() => {
    // 1. Posts whose timeline ran out without being fulfilled.
    const stale = db
      .prepare("SELECT id, zone_id, template, title FROM posts WHERE status = 'open' AND expires_at <= ?")
      .all(now) as { id: string; zone_id: string; template: string; title: string }[];
    for (const p of stale) {
      db.prepare("UPDATE posts SET status = 'expired', purge_at = ? WHERE id = ?").run(now + EXPIRY_GRACE_MS, p.id);
      logEvent(db, {
        zoneId: p.zone_id,
        subjectType: "post",
        subjectId: p.id,
        type: "expired",
        detail: { template: p.template, title: p.title },
      });
      closeThreadsForPost(db, p.id, "The post this thread was about expired.");
      expired++;
    }

    // 2. Receipts past their grace period: the content is destroyed for real.
    const doomed = db
      .prepare("SELECT id, zone_id, template, status FROM posts WHERE purge_at IS NOT NULL AND purge_at <= ?")
      .all(now) as { id: string; zone_id: string; template: string; status: string }[];
    for (const p of doomed) {
      logEvent(db, {
        zoneId: p.zone_id,
        subjectType: "post",
        subjectId: p.id,
        type: "purged",
        detail: { template: p.template, previousStatus: p.status },
      });
      db.prepare("DELETE FROM posts WHERE id = ?").run(p.id);
      purged++;
    }

    // 3. Ephemeral channel chatter.
    const gone = db
      .prepare("DELETE FROM channel_messages WHERE expires_at IS NOT NULL AND expires_at <= ?")
      .run(now);
    messagesPurged += gone.changes;

    // 4. Zones that have ended, then zones past their purge window.
    const ended = db
      .prepare("SELECT id, name FROM zones WHERE archived_at IS NULL AND ends_at <= ?")
      .all(now) as { id: string; name: string }[];
    for (const z of ended) {
      db.prepare("UPDATE zones SET archived_at = ? WHERE id = ?").run(now, z.id);
      logEvent(db, {
        zoneId: z.id,
        subjectType: "zone",
        subjectId: z.id,
        type: "zone_archived",
        detail: { name: z.name },
      });
      zonesArchived++;
    }
    // Hard delete: cascades wipe posts, messages, threads, memberships.
    db.prepare("DELETE FROM zones WHERE purge_at <= ?").run(now);

    // 5. Rate-limit bookkeeping.
    db.prepare("DELETE FROM rate_events WHERE created_at < ?").run(now - 60 * 60 * 1000);
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  });

  run();
  return { expired, purged, messagesPurged, zonesArchived };
}

declare global {
  // eslint-disable-next-line no-var
  var __communityLinkSweeper: NodeJS.Timeout | undefined;
}

/** Background tick so posts vanish even when nobody is looking at the feed. */
export function ensureSweeper(): void {
  if (globalThis.__communityLinkSweeper) return;
  globalThis.__communityLinkSweeper = setInterval(() => {
    try {
      sweep();
    } catch (err) {
      console.error("[lifecycle] sweep failed", err);
    }
  }, 5000);
  // Don't hold the process open in short-lived contexts.
  globalThis.__communityLinkSweeper.unref?.();
}
