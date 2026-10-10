'use strict';

// Events held inside a zone. Each event says how people get in, so the dashboard can separate
// open events (no sign-in) from events that need registration, an ID, or a ticket.
// Note: the app does not verify IDs or tickets; it only shows the entry requirement.

const { getZone } = require('./zones');

const MAX_TITLE = 120;
const MAX_VENUE = 120;
const MAX_NOTE = 200;

const ENTRY_LABELS = Object.freeze({
  open: 'Open entry · no sign-in',
  registration: 'Registration required',
  id_required: 'College or photo ID required',
  ticket: 'Ticket required',
});
const ENTRY_TYPES = Object.freeze(Object.keys(ENTRY_LABELS));

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function requiresAuth(event) {
  return event.entry !== 'open';
}

// Sample events, generated relative to "now" so the dashboard always has something current to show.
// They are marked demo and are never written to the database.
function demoEventsFor(zone, now) {
  const venue = zone.name;
  const base = [
    { title: 'Free open-air acoustic concert', entry: 'open', free: true, price: null,
      startsAt: now + HOUR, endsAt: now + 3 * HOUR, entryNote: 'No sign-in. Just walk in.' },
    { title: 'Samartha hackathon · kickoff', entry: 'registration', free: true, price: null,
      startsAt: now + 30 * MIN, endsAt: now + 8 * HOUR, entryNote: 'Register on the hackathon portal to get a badge.' },
    { title: 'Open coding jam (bring your laptop)', entry: 'open', free: true, price: null,
      startsAt: now + 2 * HOUR, endsAt: now + 5 * HOUR, entryNote: 'Anyone can join.' },
    { title: 'Robotics basics workshop', entry: 'ticket', free: false, price: 299,
      startsAt: now + 4 * HOUR, endsAt: now + 6 * HOUR, entryNote: 'Ticket needed at the door.' },
    { title: 'Campus sports day trials', entry: 'id_required', free: true, price: null,
      startsAt: now + 5 * HOUR, endsAt: now + 7 * HOUR, entryNote: 'Bring your college ID.' },
  ];
  return base.map((e, i) => ({
    id: `demo_${zone.id}_${i}`,
    zoneId: zone.id,
    venue,
    createdByName: 'Demo data',
    demo: true,
    ...e,
  }));
}

function eventsInZone(stored, zoneId, now) {
  const zone = getZone(zoneId);
  if (!zone) return [];
  const all = [...stored.filter((e) => e.zoneId === zoneId), ...demoEventsFor(zone, now)];
  return all
    .filter((e) => e.endsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt);
}

function present(e) {
  return {
    id: e.id,
    zoneId: e.zoneId,
    title: e.title,
    venue: e.venue,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    free: e.free,
    price: e.price,
    entry: e.entry,
    entryLabel: ENTRY_LABELS[e.entry],
    requiresAuth: requiresAuth(e),
    entryNote: e.entryNote || '',
    demo: !!e.demo,
    createdByName: e.createdByName,
  };
}

function text(value, max, label) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s.length > max) return { error: `${label} must be ${max} characters or fewer.` };
  return { value: s };
}

// Organiser input. Returns { ok, value } or { ok: false, status, error }.
function validateEvent(input, user, now) {
  if (!user || user.role !== 'organiser') return { ok: false, status: 403, error: 'Only organisers can add events.' };
  if (!input || typeof input !== 'object') return { ok: false, status: 400, error: 'Invalid event.' };

  const title = text(input.title, MAX_TITLE, 'Title');
  if (title.error) return { ok: false, status: 400, error: title.error };
  if (!title.value) return { ok: false, status: 400, error: 'Title is required.' };

  const venue = text(input.venue, MAX_VENUE, 'Venue');
  if (venue.error) return { ok: false, status: 400, error: venue.error };

  const note = text(input.entryNote, MAX_NOTE, 'Entry note');
  if (note.error) return { ok: false, status: 400, error: note.error };

  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { ok: false, status: 400, error: 'Start and end times are required.' };
  }
  if (endsAt <= startsAt) return { ok: false, status: 400, error: 'End time must be after the start time.' };
  if (endsAt <= now) return { ok: false, status: 400, error: 'That event has already ended.' };

  if (!ENTRY_TYPES.includes(input.entry)) return { ok: false, status: 400, error: 'Choose an entry type.' };

  const free = input.free === true;
  let price = null;
  if (!free) {
    price = Number(input.price);
    if (!Number.isFinite(price) || price < 0 || price > 1000000) {
      return { ok: false, status: 400, error: 'Enter a valid price, or mark the event as free.' };
    }
  }

  return {
    ok: true,
    value: {
      title: title.value,
      venue: venue.value || null,
      startsAt,
      endsAt,
      free,
      price,
      entry: input.entry,
      entryNote: note.value,
      createdBy: user.id,
      createdByName: user.name,
      demo: false,
    },
  };
}

module.exports = {
  ENTRY_LABELS,
  ENTRY_TYPES,
  MAX_TITLE,
  requiresAuth,
  demoEventsFor,
  eventsInZone,
  present,
  validateEvent,
};
