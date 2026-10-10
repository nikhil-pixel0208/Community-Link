import { getDb, nowMs } from "./db";
import { newId } from "./ids";
import { HttpError, type UserRow } from "./auth";
import { logEvent } from "./lifecycle";
import { toPublicUser } from "./serialize";
import { getMembership, requireStaff } from "./zones";
import type { LifecycleEventDTO, MemberDTO, MemberRole, ReportDTO } from "./types";

export { REPORT_REASON_LIST } from "./report-reasons";

export function fileReport(
  zoneId: string,
  reporter: UserRow,
  input: { targetType: string; targetId: string; reason: string; note?: string },
): void {
  const db = getDb();
  if (!["post", "channel_message", "dm_message", "user"].includes(input.targetType)) {
    throw new HttpError(400, "Unknown report target.");
  }
  const dupe = db
    .prepare("SELECT 1 FROM reports WHERE reporter_id = ? AND target_id = ? AND status = 'open'")
    .get(reporter.id, input.targetId);
  if (dupe) throw new HttpError(409, "You already reported this. A moderator will look at it.");

  db.prepare(
    `INSERT INTO reports (id, zone_id, reporter_id, target_type, target_id, reason, note, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    newId("rep"),
    zoneId,
    reporter.id,
    input.targetType,
    input.targetId,
    input.reason.slice(0, 120),
    (input.note ?? "").slice(0, 600),
    nowMs(),
  );

  // Three open reports auto-hides a post until a human looks at it.
  if (input.targetType === "post") {
    const n = (
      db.prepare("SELECT COUNT(*) AS n FROM reports WHERE target_id = ? AND status = 'open'").get(input.targetId) as {
        n: number;
      }
    ).n;
    if (n >= 3) {
      db.prepare("UPDATE posts SET status = 'removed', purge_at = ? WHERE id = ? AND status = 'open'").run(
        nowMs() + 60 * 60 * 1000,
        input.targetId,
      );
      logEvent(db, {
        zoneId,
        subjectType: "post",
        subjectId: input.targetId,
        type: "removed",
        detail: { auto: true, reports: n },
      });
    }
  }
}

export function listReports(zoneId: string, staff: UserRow): ReportDTO[] {
  requireStaff(zoneId, staff.id);
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM reports WHERE zone_id = ? ORDER BY status = 'open' DESC, created_at DESC LIMIT 100")
    .all(zoneId) as Record<string, string | number>[];

  return rows.map((r) => {
    const reporter = db.prepare("SELECT * FROM users WHERE id = ?").get(r.reporter_id) as UserRow | undefined;
    let snippet = "(content already gone)";
    if (r.target_type === "post") {
      const p = db.prepare("SELECT title FROM posts WHERE id = ?").get(r.target_id) as { title: string } | undefined;
      if (p) snippet = p.title;
    } else if (r.target_type === "channel_message") {
      const m = db.prepare("SELECT body FROM channel_messages WHERE id = ?").get(r.target_id) as
        | { body: string }
        | undefined;
      if (m) snippet = m.body.slice(0, 160);
    } else if (r.target_type === "user") {
      const u = db.prepare("SELECT handle FROM users WHERE id = ?").get(r.target_id) as { handle: string } | undefined;
      if (u) snippet = `@${u.handle}`;
    }
    return {
      id: r.id as string,
      reporter: toPublicUser(reporter)!,
      targetType: r.target_type as string,
      targetId: r.target_id as string,
      reason: r.reason as string,
      note: r.note as string,
      status: r.status as string,
      createdAt: r.created_at as number,
      snippet,
    };
  });
}

export function resolveReport(
  zoneId: string,
  staff: UserRow,
  reportId: string,
  action: "dismiss" | "remove_content" | "mute_author" | "ban_author",
): void {
  requireStaff(zoneId, staff.id);
  const db = getDb();
  const report = db.prepare("SELECT * FROM reports WHERE id = ? AND zone_id = ?").get(reportId, zoneId) as
    | { id: string; target_type: string; target_id: string }
    | undefined;
  if (!report) throw new HttpError(404, "Report not found.");

  let targetUser: string | null = null;
  if (report.target_type === "post") {
    const p = db.prepare("SELECT author_id FROM posts WHERE id = ?").get(report.target_id) as
      | { author_id: string }
      | undefined;
    targetUser = p?.author_id ?? null;
  } else if (report.target_type === "channel_message") {
    const m = db.prepare("SELECT user_id FROM channel_messages WHERE id = ?").get(report.target_id) as
      | { user_id: string }
      | undefined;
    targetUser = m?.user_id ?? null;
  } else if (report.target_type === "user") {
    targetUser = report.target_id;
  }

  const now = nowMs();
  if (action === "remove_content" || action === "mute_author" || action === "ban_author") {
    if (report.target_type === "post") {
      db.prepare("UPDATE posts SET status = 'removed', purge_at = ? WHERE id = ?").run(now + 5 * 60_000, report.target_id);
      logEvent(db, {
        zoneId,
        subjectType: "post",
        subjectId: report.target_id,
        type: "removed",
        actorId: staff.id,
      });
    } else if (report.target_type === "channel_message") {
      db.prepare("UPDATE channel_messages SET deleted_at = ?, deleted_by = ? WHERE id = ?").run(
        now,
        staff.id,
        report.target_id,
      );
    }
  }
  if (action === "mute_author" && targetUser) {
    db.prepare("UPDATE memberships SET muted_until = ? WHERE zone_id = ? AND user_id = ?").run(
      now + 60 * 60 * 1000,
      zoneId,
      targetUser,
    );
  }
  if (action === "ban_author" && targetUser) {
    db.prepare("UPDATE memberships SET is_banned = 1, left_at = ? WHERE zone_id = ? AND user_id = ?").run(
      now,
      zoneId,
      targetUser,
    );
    db.prepare("UPDATE users SET trust_score = MAX(0, trust_score - 25) WHERE id = ?").run(targetUser);
  }

  db.prepare("UPDATE reports SET status = ?, handled_by = ?, handled_at = ? WHERE id = ?").run(
    action === "dismiss" ? "dismissed" : "actioned",
    staff.id,
    now,
    reportId,
  );

  db.prepare(
    "INSERT INTO mod_actions (id, zone_id, actor_id, action, target_type, target_id, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
  ).run(newId("mac"), zoneId, staff.id, action, report.target_type, report.target_id, `report:${reportId}`, now);
}

export function toggleBlock(blocker: UserRow, targetId: string): { blocked: boolean } {
  const db = getDb();
  if (blocker.id === targetId) throw new HttpError(400, "You can't block yourself.");
  const existing = db
    .prepare("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?")
    .get(blocker.id, targetId);
  if (existing) {
    db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(blocker.id, targetId);
    return { blocked: false };
  }
  db.prepare("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)").run(
    blocker.id,
    targetId,
    nowMs(),
  );
  return { blocked: true };
}

export function listMembers(zoneId: string, viewer: UserRow): MemberDTO[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.*, m.role, m.joined_at, m.last_seen_at, m.is_banned, m.muted_until
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.zone_id = ? AND m.left_at IS NULL
        ORDER BY CASE m.role WHEN 'organizer' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, u.display_name`,
    )
    .all(zoneId) as (UserRow & {
    role: MemberRole;
    joined_at: number;
    last_seen_at: number;
    is_banned: number;
    muted_until: number | null;
  })[];

  const blocked = new Set(
    (db.prepare("SELECT blocked_id FROM blocks WHERE blocker_id = ?").all(viewer.id) as { blocked_id: string }[]).map(
      (b) => b.blocked_id,
    ),
  );

  return rows.map((r) => ({
    user: toPublicUser(r)!,
    role: r.role,
    joinedAt: r.joined_at,
    lastSeenAt: r.last_seen_at,
    isBanned: Boolean(r.is_banned),
    mutedUntil: r.muted_until,
    isBlockedByMe: blocked.has(r.id),
  }));
}

export function listLifecycle(zoneId: string, limit = 60): LifecycleEventDTO[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM lifecycle_events WHERE zone_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(zoneId, limit) as Record<string, string | number | null>[];
  return rows.map((r) => {
    const actor = r.actor_id
      ? (db.prepare("SELECT * FROM users WHERE id = ?").get(r.actor_id) as UserRow | undefined)
      : undefined;
    let detail: Record<string, unknown> = {};
    try {
      detail = JSON.parse((r.detail as string) ?? "{}");
    } catch {
      detail = {};
    }
    return {
      id: r.id as string,
      subjectType: r.subject_type as string,
      subjectId: r.subject_id as string,
      type: r.type as string,
      detail,
      createdAt: r.created_at as number,
      actor: toPublicUser(actor),
    };
  });
}

export function setMemberRole(zoneId: string, staff: UserRow, targetId: string, role: MemberRole): void {
  const me = requireStaff(zoneId, staff.id);
  if (me.role !== "organizer") throw new HttpError(403, "Only organisers can change roles.");
  const target = getMembership(zoneId, targetId);
  if (!target) throw new HttpError(404, "Not a member of this zone.");
  getDb().prepare("UPDATE memberships SET role = ? WHERE id = ?").run(role, target.id);
  getDb()
    .prepare(
      "INSERT INTO mod_actions (id, zone_id, actor_id, action, target_type, target_id, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(newId("mac"), zoneId, staff.id, `role:${role}`, "user", targetId, "", nowMs());
}
