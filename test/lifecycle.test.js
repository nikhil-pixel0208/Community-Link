'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lc = require('../src/lifecycle');

const NOW = 1_000_000_000_000;
const participant = { id: 'p1', name: 'Asha', role: 'participant' };
const otherParticipant = { id: 'p2', name: 'Ben', role: 'participant' };
const organiser = { id: 'o1', name: 'Org', role: 'organiser' };

function makePost(overrides = {}) {
  return {
    id: 'post_1',
    template: 'lost_found',
    channel: 'public',
    title: 't',
    body: 'b',
    location: null,
    createdAt: NOW,
    expiresAt: NOW + 60 * 60 * 1000,
    status: 'open',
    authorId: participant.id,
    authorName: participant.name,
    authorRole: participant.role,
    responses: [],
    ...overrides,
  };
}

test('participants can create lost & found and requirement posts', () => {
  for (const template of ['lost_found', 'requirement', 'communication']) {
    const r = lc.validatePost({ template, title: 'x', body: 'y' }, participant, NOW);
    assert.equal(r.ok, true, template);
  }
});

test('promotions and announcements are organiser-only', () => {
  for (const template of ['promotion', 'announcement']) {
    const denied = lc.validatePost({ template, title: 'x', body: 'y' }, participant, NOW);
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
    const allowed = lc.validatePost({ template, title: 'x', body: 'y' }, organiser, NOW);
    assert.equal(allowed.ok, true);
  }
});

test('communication channel: organisers-only messages are private', () => {
  const input = { template: 'communication', title: 'PPT', body: 'Ready in 30 min?', channel: 'organisers' };
  const r = lc.validatePost(input, participant, NOW);
  assert.equal(r.ok, true);
  const post = makePost({ ...r.value, id: 'c1', authorId: participant.id });

  assert.equal(lc.canView(post, participant), true, 'author sees own message');
  assert.equal(lc.canView(post, organiser), true, 'organiser sees it');
  assert.equal(lc.canView(post, otherParticipant), false, 'other participants do not');
});

test('public communication is visible to everyone', () => {
  const post = makePost({ template: 'communication', channel: 'public' });
  assert.equal(lc.canView(post, otherParticipant), true);
});

test('invalid channel for a template is rejected', () => {
  const r = lc.validatePost({ template: 'lost_found', title: 'x', body: 'y', channel: 'organisers' }, participant, NOW);
  assert.equal(r.ok, false);
});

test('timeline defaults to the template value and is bounded', () => {
  const def = lc.validatePost({ template: 'lost_found', title: 'x', body: 'y' }, participant, NOW);
  assert.equal(def.value.expiresAt - NOW, 240 * 60 * 1000);

  const tooShort = lc.validatePost({ template: 'lost_found', title: 'x', body: 'y', ttlMinutes: 1 }, participant, NOW);
  assert.equal(tooShort.ok, false);

  const tooLong = lc.validatePost({ template: 'lost_found', title: 'x', body: 'y', ttlMinutes: 99999 }, participant, NOW);
  assert.equal(tooLong.ok, false);

  const custom = lc.validatePost({ template: 'communication', title: 'x', body: 'y', ttlMinutes: 30 }, participant, NOW);
  assert.equal(custom.value.expiresAt - NOW, 30 * 60 * 1000);
});

test('replies: allowed on lost & found / requirement, not on announcements', () => {
  const lost = makePost({ template: 'lost_found' });
  assert.equal(lc.canReply(lost, otherParticipant, NOW), true);

  const ann = makePost({ template: 'announcement', authorId: organiser.id });
  assert.equal(lc.canReply(ann, otherParticipant, NOW), false);
});

test('only the author can close a post', () => {
  const post = makePost();
  assert.equal(lc.canClose(post, participant), true);
  assert.equal(lc.canClose(post, otherParticipant), false);
  assert.equal(lc.canClose(post, organiser), false);
});

test('expired posts are not live and not replyable', () => {
  const post = makePost({ expiresAt: NOW - 1 });
  assert.equal(lc.isLive(post, NOW), false);
  assert.equal(lc.canReply(post, otherParticipant, NOW), false);
});

test('sweepExpired removes expired and closed posts only', () => {
  const posts = [
    makePost({ id: 'a' }),
    makePost({ id: 'b', expiresAt: NOW - 5 }),
    makePost({ id: 'c', status: 'resolved' }),
  ];
  const { posts: kept, removed } = lc.sweepExpired(posts, NOW);
  assert.deepEqual(kept.map((p) => p.id), ['a']);
  assert.equal(removed, 2);
});

test('feedFor hides other users\' organiser-channel posts and filters by template', () => {
  const posts = [
    makePost({ id: 'pub', template: 'lost_found' }),
    makePost({ id: 'priv', template: 'communication', channel: 'organisers' }),
    makePost({ id: 'req', template: 'requirement' }),
  ];
  const forOther = lc.feedFor(posts, otherParticipant, NOW).map((p) => p.id);
  assert.deepEqual(forOther.sort(), ['pub', 'req']);

  const forOrg = lc.feedFor(posts, organiser, NOW, { template: 'communication' }).map((p) => p.id);
  assert.deepEqual(forOrg, ['priv']);
});

test('validateReply rejects empty text and users who cannot see the post', () => {
  const priv = makePost({ template: 'communication', channel: 'organisers' });
  assert.equal(lc.validateReply({ text: 'hi' }, priv, otherParticipant, NOW).ok, false);
  assert.equal(lc.validateReply({ text: '   ' }, makePost(), otherParticipant, NOW).ok, false);
  assert.equal(lc.validateReply({ text: 'ok' }, makePost(), otherParticipant, NOW).ok, true);
});

test('a message needs only text; the title is derived from it', () => {
  const r = lc.validatePost({ template: 'communication', body: 'Can I get 30 more minutes for my PPT?', channel: 'organisers' }, participant, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.title, 'Can I get 30 more minutes for my PPT?');
  assert.equal(r.value.body, 'Can I get 30 more minutes for my PPT?');

  const long = lc.validatePost({ template: 'communication', body: 'x'.repeat(200) }, participant, NOW);
  assert.ok(long.value.title.length <= 60);

  const empty = lc.validatePost({ template: 'communication', body: '   ' }, participant, NOW);
  assert.equal(empty.ok, false);
});
