'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ev = require('../src/events');

const NOW = Date.parse('2026-10-10T10:00:00Z');
const org = { id: 'o1', name: 'Priya', role: 'organiser' };
const student = { id: 's1', name: 'Asha', role: 'participant' };
const future = (h) => new Date(NOW + h * 3600000).toISOString();

function input(overrides = {}) {
  return { title: 'Open mic', venue: 'Hall B', startsAt: future(1), endsAt: future(3),
    entry: 'open', free: true, entryNote: '', ...overrides };
}

test('open events do not require sign-in; registration, ID and ticket events do', () => {
  assert.equal(ev.requiresAuth({ entry: 'open' }), false);
  assert.equal(ev.requiresAuth({ entry: 'registration' }), true);
  assert.equal(ev.requiresAuth({ entry: 'id_required' }), true);
  assert.equal(ev.requiresAuth({ entry: 'ticket' }), true);
});

test('demo events for a zone include both open and sign-in events', () => {
  const list = ev.eventsInZone([], 'hack-hall', NOW).map(ev.present);
  assert.ok(list.some((e) => !e.requiresAuth), 'has an open event');
  assert.ok(list.some((e) => e.requiresAuth), 'has a sign-in event');
  assert.ok(list.every((e) => e.demo));
});

test('events are only listed for their own zone and hide once they have ended', () => {
  const stored = [{ id: 'x', zoneId: 'campus-quad', title: 'Quad talk', entry: 'open', free: true,
    startsAt: NOW + 3600000, endsAt: NOW + 7200000, createdBy: 'o1' }];
  const hall = ev.eventsInZone(stored, 'hack-hall', NOW);
  assert.equal(hall.some((e) => e.id === 'x'), false);
  const quad = ev.eventsInZone(stored, 'campus-quad', NOW);
  assert.equal(quad.some((e) => e.id === 'x'), true);
  const later = ev.eventsInZone(stored, 'campus-quad', NOW + 8 * 3600000);
  assert.equal(later.some((e) => e.id === 'x'), false, 'ended events are hidden');
});

test('only organisers can add events', () => {
  const r = ev.validateEvent(input(), student, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(ev.validateEvent(input(), org, NOW).ok, true);
});

test('a paid event needs a price; a free event ignores it', () => {
  assert.equal(ev.validateEvent(input({ free: false }), org, NOW).ok, false);
  const paid = ev.validateEvent(input({ free: false, price: 299, entry: 'ticket' }), org, NOW);
  assert.equal(paid.ok, true);
  assert.equal(paid.value.price, 299);
  assert.equal(ev.validateEvent(input({ free: true, price: 999 }), org, NOW).value.price, null);
});

test('end must be after start, and events must have an entry type', () => {
  assert.equal(ev.validateEvent(input({ endsAt: future(0.5), startsAt: future(1) }), org, NOW).ok, false);
  assert.equal(ev.validateEvent(input({ entry: 'nonsense' }), org, NOW).ok, false);
  assert.equal(ev.validateEvent(input({ title: '' }), org, NOW).ok, false);
});
