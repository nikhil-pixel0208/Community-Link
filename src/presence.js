'use strict';

// Zone presence: who is currently in which zone, and why a location update was accepted or not.
//
// Data minimisation:
//  - Coordinates are never written to disk, never put in posts, and never sent to other users.
//  - The last accepted fix is kept only long enough to check for impossible jumps (FIX_TTL_MS).
//  - Membership lapses unless the app keeps checking in (MEMBERSHIP_TTL_MS).
//  - Everything here lives in memory, so a server restart clears all presence.

const geo = require('./geo');
const { ZONES, publicZone } = require('./zones');

const MEMBERSHIP_TTL_MS = 10 * 60 * 1000;
const FIX_TTL_MS = 5 * 60 * 1000;
const CONFIRM_FIXES = 2;          // consecutive "inside" fixes needed before entering
const MAX_ACCURACY_M = 150;       // worse than this, the fix cannot be used for decisions

class PresenceError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function validateFix(input) {
  if (!input || typeof input !== 'object') throw new PresenceError('Location update must be an object.');
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new PresenceError('Latitude is invalid.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new PresenceError('Longitude is invalid.');
  const accuracy = input.accuracy === undefined ? 1000 : Number(input.accuracy);
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000) throw new PresenceError('Accuracy is invalid.');
  return { lat, lng, accuracyM: accuracy };
}

function summary(zone) {
  return { id: zone.id, name: zone.name };
}

class Presence {
  constructor({ zones = ZONES } = {}) {
    this.zones = zones;
    this.members = new Map();   // userId -> { zoneId, since, lastCheckIn }
    this.pending = new Map();   // userId -> { zoneId, count }
    this.lastFix = new Map();   // userId -> { lat, lng, accuracyM, at }
  }

  zoneById(id) {
    return this.zones.find((z) => z.id === id) || null;
  }

  zoneList() {
    return this.zones.map(publicZone);
  }

  // Current membership, or null. Lapsed memberships are removed here.
  membership(userId, now) {
    const m = this.members.get(userId);
    if (!m) return null;
    if (now - m.lastCheckIn > MEMBERSHIP_TTL_MS) {
      this.members.delete(userId);
      return null;
    }
    return m;
  }

  membershipView(userId, now) {
    const m = this.membership(userId, now);
    if (!m) return null;
    const zone = this.zoneById(m.zoneId);
    return zone ? { zoneId: zone.id, zoneName: zone.name, since: m.since } : null;
  }

  checkIn(userId, input, now) {
    const fix = validateFix(input);
    const current = this.membership(userId, now);
    const reply = (state, reason, zone, message) => ({
      state,
      reason,
      zone: zone ? summary(zone) : null,
      accuracyM: Math.round(fix.accuracyM),
      membership: this.membershipView(userId, now),
      message,
    });

    if (fix.accuracyM > MAX_ACCURACY_M) {
      return reply(
        current ? 'member' : 'rejected',
        'low_accuracy',
        current && this.zoneById(current.zoneId),
        `GPS accuracy is too low (about ${Math.round(fix.accuracyM)} m). Move to a spot with a clearer sky view.`,
      );
    }

    const point = { lat: fix.lat, lng: fix.lng, at: now };
    const prev = this.lastFix.get(userId);
    if (prev && geo.impliedSpeedMps(prev, point) > geo.MAX_SPEED_MPS) {
      return reply(
        current ? 'member' : 'rejected',
        'implausible_jump',
        current && this.zoneById(current.zoneId),
        'That location jump is not physically possible, so it was ignored. Location may be spoofed or inaccurate.',
      );
    }
    this.lastFix.set(userId, { ...point, accuracyM: fix.accuracyM });

    const verdicts = this.zones.map((zone) => ({
      zone,
      v: geo.verdict(geo.signedDistanceM(point, zone), fix.accuracyM, current?.zoneId === zone.id),
    }));

    if (current) {
      const cur = verdicts.find((x) => x.zone.id === current.zoneId);
      if (cur.v !== 'outside') {
        current.lastCheckIn = now;
        const msg = cur.v === 'uncertain'
          ? `Near the edge of ${cur.zone.name}. You stay in until your location is clearly outside.`
          : `You're in ${cur.zone.name}.`;
        return reply('member', cur.v === 'uncertain' ? 'boundary' : 'ok', cur.zone, msg);
      }
      this.members.delete(userId);
      this.pending.delete(userId);
      return reply('left', 'exited', cur.zone, `You left ${cur.zone.name}. Zone posts are hidden now.`);
    }

    const inside = verdicts.find((x) => x.v === 'inside');
    if (inside) {
      const prevPending = this.pending.get(userId);
      const count = prevPending && prevPending.zoneId === inside.zone.id ? prevPending.count + 1 : 1;
      if (count >= CONFIRM_FIXES) {
        this.members.set(userId, { zoneId: inside.zone.id, since: now, lastCheckIn: now });
        this.pending.delete(userId);
        return reply('entered', 'entry', inside.zone, `Welcome to ${inside.zone.name}. Zone posts are visible now.`);
      }
      this.pending.set(userId, { zoneId: inside.zone.id, count });
      return reply('pending', 'confirming', inside.zone, `Confirming you're in ${inside.zone.name}…`);
    }

    this.pending.delete(userId);
    const unsure = verdicts.find((x) => x.v === 'uncertain');
    if (unsure) {
      return reply('uncertain', 'boundary', unsure.zone, `Too close to the edge of ${unsure.zone.name} to tell where you are.`);
    }
    return reply('outside', 'outside', null, "You're outside every zone.");
  }

  leave(userId) {
    this.members.delete(userId);
    this.pending.delete(userId);
  }

  // Remove everything held about a user's location.
  forget(userId) {
    this.members.delete(userId);
    this.pending.delete(userId);
    this.lastFix.delete(userId);
  }

  sweep(now) {
    for (const [id, m] of this.members) {
      if (now - m.lastCheckIn > MEMBERSHIP_TTL_MS) this.members.delete(id);
    }
    for (const [id, f] of this.lastFix) {
      if (now - f.at > FIX_TTL_MS) this.lastFix.delete(id);
    }
  }
}

module.exports = { Presence, PresenceError, MEMBERSHIP_TTL_MS, FIX_TTL_MS, CONFIRM_FIXES, MAX_ACCURACY_M };
