import { getDb, nowMs } from "./db";
import { newId } from "./ids";
import { HttpError, type UserRow } from "./auth";
import { evaluateResolution, logEvent, resolvePost, sweep } from "./lifecycle";
import { toPostDTO, type PostRow } from "./serialize";
import { TEMPLATES, URGENCIES, isTemplateId, type TemplateId, type Urgency } from "./templates";
import { assertNotMuted, getMembership, requireMembership } from "./zones";
import { findOrCreateThread } from "./chat";
import type { MemberRole, PostDTO } from "./types";

/* ---------------------------------------------------------------- *
 * Spam prevention: cheap sliding-window counters, no extra infra.
 * ---------------------------------------------------------------- */
export function checkRate(userId: string, bucket: string, limit: number, windowMs: number): void {
  const db = getDb();
  const since = nowMs() - windowMs;
  const count = (
    db
      .prepare("SELECT COUNT(*) AS n FROM rate_events WHERE user_id = ? AND bucket = ? AND created_at > ?")
      .get(userId, bucket, since) as { n: number }
  ).n;
  if (count >= limit) {
    const mins = Math.ceil(windowMs / 60000);
    throw new HttpError(429, `Slow down — ${limit} per ${mins} minute(s) keeps this zone readable.`);
  }
  db.prepare("INSERT INTO rate_events (id, user_id, bucket, created_at) VALUES (?,?,?,?)").run(
    newId("rat"),
    userId,
    bucket,
    nowMs(),
  );
}

/** Derive the headline + body from whatever the template collected. */
function deriveTitleAndBody(template: TemplateId, payload: Record<string, unknown>): { title: string; body: string } {
  const def = TEMPLATES[template];
  const firstText = def.fields.find((f) => f.required && (f.type === "text" || f.type === "textarea"));
  const firstArea = def.fields.find((f) => f.type === "textarea");
  const title = String((firstText && payload[firstText.name]) ?? "").trim();
  const bodyRaw = firstArea && firstArea.name !== firstText?.name ? payload[firstArea.name] : "";
  return { title, body: String(bodyRaw ?? "").trim() };
}

export function createPost(
  zoneId: string,
  author: UserRow,
  input: {
    template: string;
    payload: Record<string, unknown>;
    ttlMs: number;
    count?: number;
    urgency?: string;
    isAnonymous?: boolean;
  },
): PostDTO {
  if (!isTemplateId(input.template)) throw new HttpError(400, "Unknown template.");
  const def = TEMPLATES[input.template];
  const membership = requireMembership(zoneId, author.id);
  assertNotMuted(membership);

  if (input.template === "announcement" && membership.role === "member") {
    throw new HttpError(403, "Announcements are an organiser tool. Post a question, or message an organiser.");
  }

  // Validate required fields declared by the template.
  const payload: Record<string, unknown> = {};
  for (const field of def.fields) {
    const raw = input.payload?.[field.name];
    if (field.required && (raw === undefined || raw === null || String(raw).trim() === "")) {
      throw new HttpError(400, `"${field.label}" is required.`);
    }
    if (raw === undefined || raw === null) continue;
    if (field.type === "tags" || field.type === "options") {
      const arr = Array.isArray(raw) ? raw : String(raw).split(",");
      const clean = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, field.max ?? 8);
      if (clean.length) payload[field.name] = clean;
    } else {
      const text = String(raw).trim();
      if (text) payload[field.name] = text.slice(0, 2000);
    }
  }

  const { title, body } = deriveTitleAndBody(input.template, payload);
  if (!title) throw new HttpError(400, "Give your post a headline.");

  checkRate(author.id, "post", 12, 60 * 60 * 1000);

  const ttl = Math.min(Math.max(5 * 60_000, Number(input.ttlMs) || def.defaultTtlMs), 7 * 24 * 60 * 60 * 1000);
  const urgency: Urgency = URGENCIES.includes(input.urgency as Urgency) ? (input.urgency as Urgency) : "normal";

  let slots = 1;
  if (def.countLabel) {
    slots = Math.min(Math.max(1, Math.round(Number(input.count) || def.defaultCount || 1)), 500);
  }

  const now = nowMs();
  const id = newId("pst");
  getDb()
    .prepare(
      `INSERT INTO posts (id, zone_id, author_id, template, title, body, payload, created_at, expires_at,
                          resolve_mode, slots_needed, slots_filled, status, is_anonymous, urgency)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'open',?,?)`,
    )
    .run(
      id,
      zoneId,
      author.id,
      input.template,
      title.slice(0, 180),
      body.slice(0, 2000),
      JSON.stringify(payload),
      now,
      now + ttl,
      def.resolveMode,
      slots,
      input.isAnonymous ? 1 : 0,
      urgency,
    );

  logEvent(getDb(), {
    zoneId,
    subjectType: "post",
    subjectId: id,
    type: "created",
    actorId: author.id,
    detail: { template: input.template, title, expiresAt: now + ttl, slots },
  });

  return getPostDTO(id, author)!;
}

export interface FeedOptions {
  template?: string | null;
  query?: string | null;
  mine?: boolean;
  includeSettled?: boolean;
}

/**
 * The feed.
 *
 * `open` posts are visible to the whole zone. The moment a post is fulfilled or
 * expires it drops out of everyone's feed — the author, the people who
 * responded and the moderators keep a short-lived receipt, and then it's gone
 * for them too.
 */
export function listPosts(zoneId: string, viewer: UserRow, opts: FeedOptions = {}): PostDTO[] {
  sweep();
  const db = getDb();
  const membership = getMembership(zoneId, viewer.id);
  const role: MemberRole | null = membership?.role ?? null;
  const canModerate = role === "organizer" || role === "moderator";

  const blocked = new Set(
    (db.prepare("SELECT blocked_id FROM blocks WHERE blocker_id = ?").all(viewer.id) as { blocked_id: string }[]).map(
      (b) => b.blocked_id,
    ),
  );

  const rows = db
    .prepare(
      `SELECT * FROM posts
        WHERE zone_id = ? AND status != 'removed'
        ORDER BY pinned DESC,
                 CASE urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END ASC,
                 created_at DESC`,
    )
    .all(zoneId) as PostRow[];

  const out: PostDTO[] = [];
  for (const row of rows) {
    if (blocked.has(row.author_id)) continue;
    if (opts.template && row.template !== opts.template) continue;
    if (opts.mine && row.author_id !== viewer.id) continue;

    if (row.status !== "open") {
      // Settled posts are receipts, not content. Only the people it concerned.
      const involved =
        row.author_id === viewer.id ||
        canModerate ||
        Boolean(db.prepare("SELECT 1 FROM responses WHERE post_id = ? AND user_id = ?").get(row.id, viewer.id));
      if (!involved) continue;
      if (opts.includeSettled === false) continue;
    }

    if (opts.query) {
      const q = opts.query.toLowerCase();
      const hay = `${row.title} ${row.body} ${row.payload}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push(toPostDTO(db, row, viewer, role));
  }
  return out;
}

export function getPostRow(postId: string): PostRow | null {
  return (getDb().prepare("SELECT * FROM posts WHERE id = ?").get(postId) as PostRow | undefined) ?? null;
}

export function getPostDTO(postId: string, viewer: UserRow): PostDTO | null {
  const row = getPostRow(postId);
  if (!row) return null;
  const membership = getMembership(row.zone_id, viewer.id);
  return toPostDTO(getDb(), row, viewer, membership?.role ?? null);
}

/* ---------------------------------------------------------------- *
 * Engaging with a post
 * ---------------------------------------------------------------- */

export function respondToPost(
  postId: string,
  user: UserRow,
  input: { body?: string; kind?: string; meta?: Record<string, unknown>; openThread?: boolean },
): { post: PostDTO; threadId: string | null } {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) throw new HttpError(404, "That post is gone — it was already resolved or it expired.");
  if (row.status !== "open") throw new HttpError(410, "That post has already been settled.");

  const membership = requireMembership(row.zone_id, user.id);
  assertNotMuted(membership);
  if (row.author_id === user.id) throw new HttpError(400, "You can't respond to your own post.");

  const def = TEMPLATES[row.template as TemplateId];
  checkRate(user.id, "respond", 40, 60 * 60 * 1000);

  const kind = input.kind ?? defaultResponseKind(row.template as TemplateId);

  // Poll votes are a toggle, not a conversation.
  if (kind === "vote") {
    const optionIndex = Number(input.meta?.option ?? -1);
    db.prepare("DELETE FROM responses WHERE post_id = ? AND user_id = ? AND kind = 'vote'").run(postId, user.id);
    db.prepare(
      "INSERT INTO responses (id, post_id, user_id, kind, body, meta, status, created_at) VALUES (?,?,?,?,?,?,'pending',?)",
    ).run(newId("rsp"), postId, user.id, "vote", "", JSON.stringify({ option: optionIndex }), nowMs());
    return { post: getPostDTO(postId, user)!, threadId: null };
  }

  const existing = db
    .prepare("SELECT * FROM responses WHERE post_id = ? AND user_id = ? AND kind != 'vote' AND status != 'withdrawn'")
    .get(postId, user.id) as { id: string } | undefined;
  if (existing) throw new HttpError(409, "You've already responded to this one.");

  const body = (input.body ?? "").trim().slice(0, 1200);
  const responseId = newId("rsp");
  db.prepare(
    "INSERT INTO responses (id, post_id, user_id, kind, body, meta, status, created_at) VALUES (?,?,?,?,?,?,'pending',?)",
  ).run(responseId, postId, user.id, kind, body, JSON.stringify(input.meta ?? {}), nowMs());

  logEvent(db, {
    zoneId: row.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: "responded",
    actorId: user.id,
    detail: { kind, template: row.template },
  });

  // Quota templates (promotions) need no human in the loop.
  if (def.resolveMode === "quota") {
    db.prepare("UPDATE responses SET status = 'accepted', decided_at = ? WHERE id = ?").run(nowMs(), responseId);
  }

  let threadId: string | null = null;
  const wantsThread = input.openThread !== false && kind !== "ack" && def.resolveMode !== "quota";
  if (wantsThread) {
    // Coordination happens in a private thread bound to this post. When the post
    // resolves, the thread closes with it — no orphaned chats.
    const thread = findOrCreateThread(row.zone_id, user.id, row.author_id, {
      topic: row.title,
      postId: row.id,
    });
    threadId = thread.id;
    if (body) {
      db.prepare("INSERT INTO dm_messages (id, thread_id, user_id, body, created_at) VALUES (?,?,?,?,?)").run(
        newId("dmm"),
        thread.id,
        user.id,
        body,
        nowMs(),
      );
    }
  }

  evaluateResolution(db, postId, user.id);
  return { post: getPostDTO(postId, user)!, threadId };
}

function defaultResponseKind(template: TemplateId): string {
  switch (template) {
    case "lost_found":
    case "found_item":
      return "claim";
    case "requirement":
      return "offer";
    case "promotion":
      return "claim";
    case "announcement":
      return "ack";
    case "question":
      return "answer";
    default:
      return "offer";
  }
}

export function withdrawResponse(postId: string, user: UserRow): PostDTO {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) throw new HttpError(404, "That post is gone.");
  db.prepare(
    "UPDATE responses SET status = 'withdrawn', decided_at = ? WHERE post_id = ? AND user_id = ? AND status = 'pending'",
  ).run(nowMs(), postId, user.id);
  logEvent(db, {
    zoneId: row.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: "withdrawn",
    actorId: user.id,
  });
  evaluateResolution(db, postId, user.id);
  return getPostDTO(postId, user)!;
}

/** The author accepting a response is what closes the loop — and kills the post. */
export function decideResponse(
  postId: string,
  responseId: string,
  user: UserRow,
  decision: "accepted" | "declined",
): PostDTO {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) throw new HttpError(404, "That post is gone.");
  if (row.author_id !== user.id) throw new HttpError(403, "Only the author can decide on responses.");
  if (row.status !== "open") throw new HttpError(410, "That post is already settled.");

  const resp = db.prepare("SELECT * FROM responses WHERE id = ? AND post_id = ?").get(responseId, postId) as
    | { id: string; user_id: string }
    | undefined;
  if (!resp) throw new HttpError(404, "That response is gone.");

  db.prepare("UPDATE responses SET status = ?, decided_at = ? WHERE id = ?").run(decision, nowMs(), responseId);
  logEvent(db, {
    zoneId: row.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: decision === "accepted" ? "accepted" : "declined",
    actorId: user.id,
    detail: { responder: resp.user_id },
  });

  if (decision === "accepted") {
    // Helping someone is the only way trust goes up.
    db.prepare("UPDATE users SET trust_score = MIN(100, trust_score + 3) WHERE id = ?").run(resp.user_id);
  }

  evaluateResolution(db, postId, user.id);
  return getPostDTO(postId, user)!;
}

/** Author closes the post themselves ("sorted it offline", "found it myself"). */
export function closePost(postId: string, user: UserRow, note: string): PostDTO {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) throw new HttpError(404, "That post is gone.");
  const membership = getMembership(row.zone_id, user.id);
  const isStaff = membership?.role === "organizer" || membership?.role === "moderator";
  if (row.author_id !== user.id && !isStaff) throw new HttpError(403, "Only the author can close this.");
  if (row.status !== "open") throw new HttpError(410, "Already settled.");

  resolvePost(db, postId, user.id, note?.trim() || "Closed by the author");
  return getPostDTO(postId, user)!;
}

/** Give a post more time — explicit, logged, and capped. */
export function extendPost(postId: string, user: UserRow, extraMs: number): PostDTO {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) throw new HttpError(404, "That post is gone.");
  if (row.author_id !== user.id) throw new HttpError(403, "Only the author can extend this.");
  if (row.status !== "open") throw new HttpError(410, "Already settled.");

  const extra = Math.min(Math.max(5 * 60_000, extraMs), 3 * 24 * 60 * 60 * 1000);
  const base = Math.max(row.expires_at, nowMs());
  db.prepare("UPDATE posts SET expires_at = ? WHERE id = ?").run(base + extra, postId);
  logEvent(db, {
    zoneId: row.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: "extended",
    actorId: user.id,
    detail: { extraMs: extra, newExpiry: base + extra },
  });
  return getPostDTO(postId, user)!;
}

/** Skip the receipt grace period and destroy the content now. */
export function purgeNow(postId: string, user: UserRow): void {
  const db = getDb();
  const row = getPostRow(postId);
  if (!row) return;
  const membership = getMembership(row.zone_id, user.id);
  const isStaff = membership?.role === "organizer" || membership?.role === "moderator";
  if (row.author_id !== user.id && !isStaff) throw new HttpError(403, "Not yours to delete.");

  logEvent(db, {
    zoneId: row.zone_id,
    subjectType: "post",
    subjectId: postId,
    type: "purged",
    actorId: user.id,
    detail: { template: row.template, manual: true },
  });
  db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
}

export function tallyVotes(postId: string): Record<number, number> {
  const rows = getDb()
    .prepare("SELECT meta FROM responses WHERE post_id = ? AND kind = 'vote'")
    .all(postId) as { meta: string }[];
  const tally: Record<number, number> = {};
  for (const r of rows) {
    try {
      const idx = Number(JSON.parse(r.meta).option);
      if (Number.isInteger(idx)) tally[idx] = (tally[idx] ?? 0) + 1;
    } catch {
      /* ignore */
    }
  }
  return tally;
}
