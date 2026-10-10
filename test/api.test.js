'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/server');

function setup(clock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-test-'));
  const { server, store } = createApp({ dataFile: path.join(dir, 'db.json'), now: () => clock.t });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        base,
        store,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function call(base, method, url, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(base, name, role = 'participant') {
  const r = await call(base, 'POST', '/api/login', null, { name, role, organiserCode: 'organiser-demo' });
  assert.equal(r.status, 201);
  return r.data.token;
}

// Hall centre, good accuracy. Two consecutive fixes are needed to enter (debounce).
const HALL = { lat: 16.9891, lng: 82.2475, accuracy: 10 };
async function enterHall(base, token) {
  await call(base, 'POST', '/api/location/check-in', token, HALL);
  const r = await call(base, 'POST', '/api/location/check-in', token, HALL);
  assert.equal(r.data.state, 'entered');
  return token;
}

async function loginInHall(base, name, role = 'participant') {
  return enterHall(base, await login(base, name, role));
}

test('lost & found: post is removed once the owner resolves it', async () => {
  const clock = { t: Date.parse('2026-10-10T10:00:00Z') };
  const app = await setup(clock);
  try {
    const owner = await loginInHall(app.base, 'Asha');
    const finder = await loginInHall(app.base, 'Ben');

    const created = await call(app.base, 'POST', '/api/posts', owner, {
      template: 'lost_found', title: 'Lost watch', body: 'Silver watch, engraved "A"', location: 'Hall B',
    });
    assert.equal(created.status, 201);
    const id = created.data.post.id;

    let feed = await call(app.base, 'GET', '/api/posts', finder);
    assert.equal(feed.data.posts.length, 1);

    const reply = await call(app.base, 'POST', `/api/posts/${id}/responses`, finder, { text: 'I have it at the desk' });
    assert.equal(reply.status, 201);
    assert.equal(reply.data.post.responses.length, 1);

    const closed = await call(app.base, 'DELETE', `/api/posts/${id}`, owner);
    assert.equal(closed.status, 200);

    feed = await call(app.base, 'GET', '/api/posts', finder);
    assert.equal(feed.data.posts.length, 0, 'resolved post vanishes from the feed');
    assert.equal(app.store.findPost(id), null, 'and is removed from storage');
  } finally {
    await app.close();
  }
});

test('requirement: only the author can close, others cannot', async () => {
  const clock = { t: Date.parse('2026-10-10T10:00:00Z') };
  const app = await setup(clock);
  try {
    const owner = await loginInHall(app.base, 'Asha');
    const other = await loginInHall(app.base, 'Ben');
    const { data } = await call(app.base, 'POST', '/api/posts', owner, {
      template: 'requirement', title: 'Need Python dev', body: 'For 2 days',
    });
    const denied = await call(app.base, 'DELETE', `/api/posts/${data.post.id}`, other);
    assert.equal(denied.status, 403);
  } finally {
    await app.close();
  }
});

test('posts expire automatically when their timeline runs out', async () => {
  const clock = { t: Date.parse('2026-10-10T10:00:00Z') };
  const app = await setup(clock);
  try {
    const owner = await loginInHall(app.base, 'Asha');
    await call(app.base, 'POST', '/api/posts', owner, {
      template: 'communication', channel: 'public', title: 'Quiet hour', body: 'Please keep it down', ttlMinutes: 10,
    });
    let feed = await call(app.base, 'GET', '/api/posts', owner);
    assert.equal(feed.data.posts.length, 1);

    clock.t += 11 * 60 * 1000;
    feed = await call(app.base, 'GET', '/api/posts', owner);
    assert.equal(feed.data.posts.length, 0);
  } finally {
    await app.close();
  }
});

test('communication: organisers-channel message is hidden from other participants', async () => {
  const clock = { t: Date.parse('2026-10-10T10:00:00Z') };
  const app = await setup(clock);
  try {
    const student = await loginInHall(app.base, 'Asha');
    const peer = await loginInHall(app.base, 'Ben');
    const org = await loginInHall(app.base, 'Priya', 'organiser');

    const created = await call(app.base, 'POST', '/api/posts', student, {
      template: 'communication', channel: 'organisers', title: 'PPT readiness', body: 'Not started yet, can we get 30 more min?',
    });
    assert.equal(created.status, 201);

    assert.equal((await call(app.base, 'GET', '/api/posts', peer)).data.posts.length, 0);
    assert.equal((await call(app.base, 'GET', '/api/posts', org)).data.posts.length, 1);
    assert.equal((await call(app.base, 'GET', '/api/posts', student)).data.posts.length, 1);
  } finally {
    await app.close();
  }
});

test('participants cannot post announcements; organisers can', async () => {
  const clock = { t: Date.parse('2026-10-10T10:00:00Z') };
  const app = await setup(clock);
  try {
    const student = await loginInHall(app.base, 'Asha');
    const org = await loginInHall(app.base, 'Priya', 'organiser');
    const body = { template: 'announcement', title: 'Lunch', body: 'Served at 1pm' };
    assert.equal((await call(app.base, 'POST', '/api/posts', student, body)).status, 403);
    assert.equal((await call(app.base, 'POST', '/api/posts', org, body)).status, 201);
  } finally {
    await app.close();
  }
});

test('organiser login requires the organiser code', async () => {
  const clock = { t: 0 };
  const app = await setup(clock);
  try {
    const r = await call(app.base, 'POST', '/api/login', null, { name: 'Fake', role: 'organiser', organiserCode: 'nope' });
    assert.equal(r.status, 403);
  } finally {
    await app.close();
  }
});

test('protected routes reject missing tokens', async () => {
  const app = await setup({ t: 0 });
  try {
    assert.equal((await call(app.base, 'GET', '/api/posts')).status, 401);
  } finally {
    await app.close();
  }
});

test('posting requires being inside a zone', async () => {
  const app = await setup({ t: Date.parse('2026-10-10T10:00:00Z') });
  try {
    const outsider = await login(app.base, 'Asha');
    const r = await call(app.base, 'POST', '/api/posts', outsider, { template: 'communication', body: 'hi' });
    assert.equal(r.status, 403);
    assert.match(r.data.error, /zone/);
  } finally {
    await app.close();
  }
});

test('zone posts are visible only to people inside that zone; replies are blocked outside', async () => {
  const app = await setup({ t: Date.parse('2026-10-10T10:00:00Z') });
  try {
    const inside = await loginInHall(app.base, 'Asha');
    const outside = await login(app.base, 'Ben');
    const created = await call(app.base, 'POST', '/api/posts', inside, {
      template: 'lost_found', body: 'Lost a silver watch near the stage',
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.post.zoneId, 'hack-hall');

    const outsiderFeed = await call(app.base, 'GET', '/api/posts', outside);
    assert.equal(outsiderFeed.data.posts.length, 0, 'outsiders see nothing');

    const reply = await call(app.base, 'POST', `/api/posts/${created.data.post.id}/responses`, outside, { text: 'found it' });
    assert.equal(reply.status, 404);
  } finally {
    await app.close();
  }
});

test('a rejected low-accuracy fix does not let someone in', async () => {
  const app = await setup({ t: Date.parse('2026-10-10T10:00:00Z') });
  try {
    const token = await login(app.base, 'Ben');
    const bad = { lat: 16.9891, lng: 82.2475, accuracy: 400 };
    await call(app.base, 'POST', '/api/location/check-in', token, bad);
    const r = await call(app.base, 'POST', '/api/location/check-in', token, bad);
    assert.equal(r.data.state, 'rejected');
    assert.equal(r.data.reason, 'low_accuracy');
    assert.equal((await call(app.base, 'GET', '/api/location/status', token)).data.membership, null);
  } finally {
    await app.close();
  }
});

test('leaving a zone or forgetting location hides zone posts immediately', async () => {
  const app = await setup({ t: Date.parse('2026-10-10T10:00:00Z') });
  try {
    const token = await loginInHall(app.base, 'Asha');
    await call(app.base, 'POST', '/api/posts', token, { template: 'communication', body: 'Anyone for a study group?' });
    assert.equal((await call(app.base, 'GET', '/api/posts', token)).data.posts.length, 1);

    await call(app.base, 'POST', '/api/location/leave', token);
    assert.equal((await call(app.base, 'GET', '/api/posts', token)).data.posts.length, 0);

    await enterHall(app.base, token);
    assert.equal((await call(app.base, 'GET', '/api/posts', token)).data.posts.length, 1);
    await call(app.base, 'POST', '/api/location/forget', token);
    assert.equal((await call(app.base, 'GET', '/api/location/status', token)).data.membership, null);
  } finally {
    await app.close();
  }
});

test('zones list exposes geometry but no one\'s presence', async () => {
  const app = await setup({ t: 0 });
  try {
    const token = await loginInHall(app.base, 'Asha');
    const r = await call(app.base, 'GET', '/api/zones', token);
    assert.equal(r.status, 200);
    assert.equal(r.data.zones.length, 2);
    assert.equal(JSON.stringify(r.data).includes('usr_'), false);
  } finally {
    await app.close();
  }
});
