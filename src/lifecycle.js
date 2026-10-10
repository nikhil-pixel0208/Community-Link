'use strict';

// Lifecycle rules for posts: validation, visibility, replies, closing and expiry.
// Everything here is pure (no I/O) so it can be unit tested directly.
//
// A post is removed from the store when:
//   1. its author closes it (resolved / requirement met / withdrawn / done), or
//   2. its timeline runs out (expiresAt <= now), checked on every read and by a sweeper.

const { getTemplate, ttlBoundsMs, CHANNELS } = require('./templates');

const MAX_TITLE = 120;
const MAX_BODY = 2000;
const MAX_LOCATION = 120;

function err(status, message) {
  return { ok: false, status, error: message };
}

function ok(value) {
  return { ok: true, value };
}

function isOrganiser(user) {
  return !!user && user.role === 'organiser';
}

function isExpired(post, now) {
  return post.expiresAt <= now;
}

function isLive(post, now) {
  return post.status === 'open' && !isExpired(post, now);
}

// Organiser-channel messages are a private line between the author and the organisers.
// Public posts are visible to every participant in the zone.
function canView(post, user) {
  if (!user) return false;
  if (post.channel === 'organisers') {
    return user.id === post.authorId || isOrganiser(user);
  }
  return true;
}

function canReply(post, user, now) {
  if (!user || !isLive(post, now)) return false;
  const template = getTemplate(post.template);
  if (!template || !template.allowsReplies) return false;
  return canView(post, user);
}

function canClose(post, user) {
  return !!user && user.id === post.authorId;
}

function deriveTitle(body) {
  const firstLine = body.split('\n')[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
}

function validatePost(input, user, now) {
  if (!user) return err(401, 'Log in first.');
  if (!input || typeof input !== 'object') return err(400, 'Invalid post body.');

  const template = getTemplate(input.template);
  if (!template) return err(400, 'Unknown template.');

  if (template.organiserOnly && !isOrganiser(user)) {
    return err(403, `Only organisers can create ${template.label} posts.`);
  }

  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return err(400, 'Write a message first.');
  if (body.length > MAX_BODY) return err(400, `Message must be ${MAX_BODY} characters or fewer.`);

  let location = null;
  if (template.usesLocation && typeof input.location === 'string' && input.location.trim()) {
    location = input.location.trim();
    if (location.length > MAX_LOCATION) return err(400, `Location must be ${MAX_LOCATION} characters or fewer.`);
  }

  const channel = input.channel === undefined ? 'public' : input.channel;
  if (!CHANNELS.includes(channel) || !template.channels.includes(channel)) {
    return err(400, `Channel must be one of: ${template.channels.join(', ')}.`);
  }

  const bounds = ttlBoundsMs(template);
  let ttlMs = bounds.defaultMs;
  if (input.ttlMinutes !== undefined && input.ttlMinutes !== null && input.ttlMinutes !== '') {
    const minutes = Number(input.ttlMinutes);
    if (!Number.isFinite(minutes)) return err(400, 'Timeline must be a number of minutes.');
    ttlMs = Math.round(minutes * 60 * 1000);
    if (ttlMs < bounds.minMs || ttlMs > bounds.maxMs) {
      return err(400, `Timeline must be between ${bounds.minMs / 60000} and ${bounds.maxMs / 60000} minutes.`);
    }
  }

  // Messages are text-first: when no title is given, use the start of the message.
  const givenTitle = typeof input.title === 'string' ? input.title.trim() : '';
  if (givenTitle.length > MAX_TITLE) return err(400, `Title must be ${MAX_TITLE} characters or fewer.`);
  const title = givenTitle || deriveTitle(body);

  return ok({
    template: template.id,
    channel,
    title,
    body,
    location,
    createdAt: now,
    expiresAt: now + ttlMs,
    status: 'open',
  });
}

function validateReply(input, post, user, now) {
  if (!canReply(post, user, now)) return err(403, 'You cannot reply to this post.');
  const text = input && typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) return err(400, 'Reply cannot be empty.');
  if (text.length > MAX_BODY) return err(400, `Reply must be ${MAX_BODY} characters or fewer.`);
  return ok({ text, authorId: user.id, authorName: user.name, createdAt: now });
}

// Removes expired posts from the list. Returns { posts, removed } without mutating input.
function sweepExpired(posts, now) {
  const kept = [];
  let removed = 0;
  for (const post of posts) {
    if (isExpired(post, now) || post.status !== 'open') {
      removed += 1;
    } else {
      kept.push(post);
    }
  }
  return { posts: kept, removed };
}

// Visible, live posts for a given user, newest first, with reply counts trimmed for the UI.
function feedFor(posts, user, now, filter = {}) {
  return posts
    .filter((p) => isLive(p, now) && canView(p, user))
    .filter((p) => !filter.template || p.template === filter.template)
    .filter((p) => !filter.channel || p.channel === filter.channel)
    .filter((p) => !filter.zoneId || p.zoneId === filter.zoneId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  MAX_TITLE,
  MAX_BODY,
  isOrganiser,
  isExpired,
  isLive,
  canView,
  canReply,
  canClose,
  validatePost,
  validateReply,
  sweepExpired,
  feedFor,
};
