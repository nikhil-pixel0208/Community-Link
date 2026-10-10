'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { Store } = require('./store');
const { Presence, PresenceError } = require('./presence');
const events = require('./events');
const { TEMPLATES, TEMPLATE_IDS } = require('./templates');
const lifecycle = require('./lifecycle');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_JSON_BYTES = 64 * 1024;
const SWEEP_INTERVAL_MS = 30 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_JSON_BYTES) {
        reject(new HttpError(413, 'Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new HttpError(400, 'Body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

// Expired and closed posts are purged here so nothing stale is ever served.
function purge(store, now) {
  const { posts, removed } = lifecycle.sweepExpired(store.posts(), now);
  if (removed) store.replacePosts(posts);
  return removed;
}

// Accept the token either as "Authorization: Bearer <token>" or as "X-Session-Token: <token>".
// Some preview proxies drop the Authorization header, so the custom header is the fallback.
function currentUser(store, req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1].trim() : (req.headers['x-session-token'] || '').toString().trim();
  return token ? store.userByToken(token) : null;
}

function requireUser(store, req) {
  const user = currentUser(store, req);
  if (!user) throw new HttpError(401, 'Log in first.');
  return user;
}

function serveStatic(req, res, urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// Shapes a post for the client: never leaks other users' tokens; includes derived fields.
function present(post, user, now) {
  const template = TEMPLATES[post.template];
  return {
    id: post.id,
    template: post.template,
    templateLabel: template.label,
    channel: post.channel,
    title: post.title,
    body: post.body,
    location: post.location,
    createdAt: post.createdAt,
    expiresAt: post.expiresAt,
    secondsLeft: Math.max(0, Math.round((post.expiresAt - now) / 1000)),
    zoneId: post.zoneId,
    author: { id: post.authorId, name: post.authorName, role: post.authorRole },
    isMine: !!user && user.id === post.authorId,
    canReply: lifecycle.canReply(post, user, now),
    canClose: lifecycle.canClose(post, user),
    replyLabel: template.replyLabel,
    closeLabel: template.closeLabel,
    responses: post.responses.map((r) => ({
      id: r.id,
      text: r.text,
      authorName: r.authorName,
      createdAt: r.createdAt,
    })),
  };
}

function createApp({ dataFile, now = () => Date.now(), zones } = {}) {
  const store = new Store(dataFile);
  const presence = new Presence({ zones });

  async function handleApi(req, res, url) {
    const t = now();
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /api/templates') {
      return sendJson(res, 200, {
        templates: TEMPLATE_IDS.map((id) => {
          const tpl = TEMPLATES[id];
          return {
            id,
            label: tpl.label,
            description: tpl.description,
            organiserOnly: tpl.organiserOnly,
            allowsReplies: tpl.allowsReplies,
            channels: tpl.channels,
            ttlMinutes: tpl.ttlMinutes,
          };
        }),
      });
    }

    if (route === 'POST /api/login') {
      const body = await readJson(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const role = body.role === 'organiser' ? 'organiser' : 'participant';
      if (!name || name.length > 60) throw new HttpError(400, 'Name is required (max 60 characters).');
      if (role === 'organiser') {
        const expected = process.env.ORGANISER_CODE || 'organiser-demo';
        if (body.organiserCode !== expected) throw new HttpError(403, 'Invalid organiser code.');
      }
      const { token, user } = store.createUser({ name, role });
      return sendJson(res, 201, { token, user });
    }

    if (route === 'GET /api/me') {
      const user = requireUser(store, req);
      return sendJson(res, 200, { user });
    }

    // Public client settings. The Maps key is meant for the browser; restrict it by HTTP referrer in Google Cloud.
    if (route === 'GET /api/config') {
      return sendJson(res, 200, { mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
    }

    if (route === 'GET /api/events') {
      const user = requireUser(store, req);
      const member = presence.membership(user.id, t);
      if (!member) return sendJson(res, 200, { events: [], zone: null, now: t });
      const list = events.eventsInZone(store.events(), member.zoneId, t).map(events.present);
      return sendJson(res, 200, { events: list, zone: presence.membershipView(user.id, t), now: t });
    }

    if (route === 'POST /api/events') {
      const user = requireUser(store, req);
      const member = presence.membership(user.id, t);
      if (!member) throw new HttpError(403, 'Enter a zone before adding an event.');
      const body = await readJson(req);
      const result = events.validateEvent(body, user, t);
      if (!result.ok) throw new HttpError(result.status, result.error);
      const event = store.addEvent({ ...result.value, zoneId: member.zoneId });
      return sendJson(res, 201, { event: events.present(event) });
    }

    const eventMatch = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
    if (eventMatch && req.method === 'DELETE') {
      const user = requireUser(store, req);
      if (user.role !== 'organiser') throw new HttpError(403, 'Only organisers can remove events.');
      // Demo events are generated, not stored, so they cannot be removed.
      const removed = store.removeEvent(eventMatch[1]);
      if (!removed) throw new HttpError(404, 'Event not found.');
      return sendJson(res, 200, { removed: true });
    }

    if (route === 'GET /api/zones') {
      requireUser(store, req);
      return sendJson(res, 200, { zones: presence.zoneList() });
    }

    if (route === 'GET /api/location/status') {
      const user = requireUser(store, req);
      return sendJson(res, 200, { membership: presence.membershipView(user.id, t), zones: presence.zoneList() });
    }

    // Body: { lat, lng, accuracy }. Coordinates are evaluated and then discarded; only the
    // resulting zone membership state is kept (in memory).
    if (route === 'POST /api/location/check-in') {
      const user = requireUser(store, req);
      const body = await readJson(req);
      try {
        const result = presence.checkIn(user.id, body, t);
        return sendJson(res, 200, result);
      } catch (e) {
        if (e instanceof PresenceError) throw new HttpError(e.status, e.message);
        throw e;
      }
    }

    if (route === 'POST /api/location/leave') {
      const user = requireUser(store, req);
      presence.leave(user.id);
      return sendJson(res, 200, { membership: null });
    }

    if (route === 'POST /api/location/forget') {
      const user = requireUser(store, req);
      presence.forget(user.id);
      return sendJson(res, 200, { membership: null, forgotten: true });
    }

    if (route === 'GET /api/posts') {
      const user = requireUser(store, req);
      purge(store, t);
      const member = presence.membership(user.id, t);
      if (!member) return sendJson(res, 200, { posts: [], zone: null, now: t });
      const posts = lifecycle.feedFor(store.posts(), user, t, {
        template: url.searchParams.get('template') || undefined,
        channel: url.searchParams.get('channel') || undefined,
        zoneId: member.zoneId,
      });
      return sendJson(res, 200, {
        posts: posts.map((p) => present(p, user, t)),
        zone: presence.membershipView(user.id, t),
        now: t,
      });
    }

    if (route === 'POST /api/posts') {
      const user = requireUser(store, req);
      const member = presence.membership(user.id, t);
      if (!member) throw new HttpError(403, 'Enter a zone before posting.');
      const body = await readJson(req);
      const result = lifecycle.validatePost(body, user, t);
      if (!result.ok) throw new HttpError(result.status, result.error);
      const post = store.addPost({
        ...result.value,
        zoneId: member.zoneId,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
      });
      return sendJson(res, 201, { post: present(post, user, t) });
    }

    const replyMatch = /^\/api\/posts\/([^/]+)\/responses$/.exec(url.pathname);
    if (replyMatch && req.method === 'POST') {
      const user = requireUser(store, req);
      purge(store, t);
      const post = store.findPost(replyMatch[1]);
      const member = presence.membership(user.id, t);
      // Posts from other zones are invisible, so they behave as if they don't exist.
      if (!post || !lifecycle.isLive(post, t) || !member || member.zoneId !== post.zoneId) {
        throw new HttpError(404, 'Post not found or already closed.');
      }
      const body = await readJson(req);
      const result = lifecycle.validateReply(body, post, user, t);
      if (!result.ok) throw new HttpError(result.status, result.error);
      store.addResponse(post.id, result.value);
      return sendJson(res, 201, { post: present(post, user, t) });
    }

    const postMatch = /^\/api\/posts\/([^/]+)$/.exec(url.pathname);
    if (postMatch && req.method === 'DELETE') {
      // Closing (resolved / requirement met / withdrawn / done) removes the post entirely.
      const user = requireUser(store, req);
      const post = store.findPost(postMatch[1]);
      if (!post) throw new HttpError(404, 'Post not found or already closed.');
      if (!lifecycle.canClose(post, user)) throw new HttpError(403, 'Only the author can close this post.');
      store.removePost(post.id);
      return sendJson(res, 200, { removed: true, id: post.id });
    }

    throw new HttpError(404, 'Not found.');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) console.log(new Date().toISOString(), req.method, url.pathname);
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else if (req.method === 'GET') {
        serveStatic(req, res, url.pathname);
      } else {
        res.writeHead(405).end();
      }
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) {
        sendJson(res, status, { error: status === 500 ? 'Something went wrong.' : e.message });
      }
    }
  });

  const sweeper = setInterval(() => {
    purge(store, now());
    presence.sweep(now());
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();
  server.on('close', () => clearInterval(sweeper));

  return { server, store };
}

module.exports = { createApp, present };
