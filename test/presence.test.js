'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../src/geo');
const { Presence, MEMBERSHIP_TTL_MS, FIX_TTL_MS } = require('../src/presence');
const { ZONES } = require('../src/zones');

const HALL = ZONES[0].center;
const T0 = 1_000_000_000_000;
const SEC = 1000;

// Offset a point by metres north/east (small-distance approximation).
function offset(p, northM, eastM) {
  return {
    lat: p.lat + northM / 111320,
    lng: p.lng + eastM / (111320 * Math.cos((p.lat * Math.PI) / 180)),
  };
}

function fix(p, accuracy = 10) {
  return { lat: p.lat, lng: p.lng, accuracy };
}

test('geo: circle signed distance is negative inside and positive outside', () => {
  const zone = ZONES[0];
  assert.ok(geo.signedDistanceM(HALL, zone) < -140);
  assert.ok(geo.signedDistanceM(offset(HALL, 0, 300), zone) > 140);
});

test('geo: polygon zone detects inside and outside points', () => {
  const quad = ZONES[1];
  assert.ok(geo.signedDistanceM(quad.center, quad) < 0);
  assert.ok(geo.signedDistanceM(offset(quad.center, 500, 0), quad) > 0);
});

test('geo: verdict respects accuracy and exit buffer', () => {
  assert.equal(geo.verdict(-50, 10, false), 'inside');
  assert.equal(geo.verdict(50, 10, false), 'outside');
  assert.equal(geo.verdict(5, 10, false), 'uncertain');
  // Once inside, a point just past the boundary is still "uncertain", not "outside".
  assert.equal(geo.verdict(10, 0, true), 'uncertain');
  assert.equal(geo.verdict(30, 0, true), 'outside');
});

test('geo: impossible speeds are detected', () => {
  const a = { lat: HALL.lat, lng: HALL.lng, at: T0 };
  const far = { lat: HALL.lat + 0.05, lng: HALL.lng, at: T0 + SEC };
  assert.ok(geo.impliedSpeedMps(a, far) > geo.MAX_SPEED_MPS);
  const walk = { ...offset(HALL, 15, 0), at: T0 + 10 * SEC };
  assert.ok(geo.impliedSpeedMps(a, { ...walk }) < geo.MAX_SPEED_MPS);
});

test('entry needs two consecutive inside fixes', () => {
  const p = new Presence();
  const first = p.checkIn('u1', fix(HALL), T0);
  assert.equal(first.state, 'pending');
  const second = p.checkIn('u1', fix(HALL), T0 + 5 * SEC);
  assert.equal(second.state, 'entered');
  assert.equal(second.zone.id, ZONES[0].id);
  assert.equal(p.membershipView('u1', T0 + 5 * SEC).zoneId, ZONES[0].id);
});

test('exit requires clearly leaving the zone', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.checkIn('u1', fix(HALL), T0 + 5 * SEC);

  // Standing right at the boundary keeps membership.
  const edge = offset(HALL, 0, 150 + 5);
  const atEdge = p.checkIn('u1', fix(edge, 10), T0 + 10 * SEC);
  assert.equal(atEdge.state, 'member');
  assert.equal(atEdge.reason, 'boundary');

  // Walking well outside ends it.
  const outside = offset(HALL, 0, 400);
  const left = p.checkIn('u1', fix(outside, 10), T0 + 20 * SEC);
  assert.equal(left.state, 'left');
  assert.equal(p.membershipView('u1', T0 + 20 * SEC), null);
});

test('low accuracy fixes are rejected and do not change membership', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.checkIn('u1', fix(HALL), T0 + 5 * SEC);
  const bad = p.checkIn('u1', fix(offset(HALL, 0, 600), 300), T0 + 10 * SEC);
  assert.equal(bad.reason, 'low_accuracy');
  assert.equal(bad.state, 'member');
  assert.ok(p.membershipView('u1', T0 + 10 * SEC), 'still a member');
});

test('a teleport from one fix to another far away is rejected as spoofed', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.checkIn('u1', fix(HALL), T0 + 5 * SEC);
  const jump = p.checkIn('u1', fix(offset(HALL, 5000, 0)), T0 + 6 * SEC);
  assert.equal(jump.reason, 'implausible_jump');
  assert.equal(jump.state, 'member', 'a spoofed jump does not evict a real member');
});

test('membership lapses if the app stops checking in', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.checkIn('u1', fix(HALL), T0 + 5 * SEC);
  assert.ok(p.membershipView('u1', T0 + 5 * SEC + MEMBERSHIP_TTL_MS - 1000));
  assert.equal(p.membershipView('u1', T0 + 5 * SEC + MEMBERSHIP_TTL_MS + 1000), null);
});

test('forget clears membership and the last fix', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.checkIn('u1', fix(HALL), T0 + 5 * SEC);
  p.forget('u1');
  assert.equal(p.membershipView('u1', T0 + 6 * SEC), null);
  assert.equal(p.lastFix.has('u1'), false);
});

test('sweep drops stale fixes', () => {
  const p = new Presence();
  p.checkIn('u1', fix(HALL), T0);
  p.sweep(T0 + FIX_TTL_MS + 1000);
  assert.equal(p.lastFix.has('u1'), false);
});

test('invalid coordinates are rejected', () => {
  const p = new Presence();
  assert.throws(() => p.checkIn('u1', { lat: 200, lng: 0 }, T0), /Latitude/);
  assert.throws(() => p.checkIn('u1', { lat: 0, lng: 'x' }, T0), /Longitude/);
});

test('outside every zone reports outside, and far from zones is never a member', () => {
  const p = new Presence();
  const r = p.checkIn('u1', fix(offset(HALL, 3000, 3000)), T0);
  assert.equal(r.state, 'outside');
  assert.equal(r.membership, null);
});
