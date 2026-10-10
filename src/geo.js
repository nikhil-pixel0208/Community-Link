'use strict';

// Geometry and zone-membership maths. Pure functions, no I/O.
//
// Positions are treated as estimates: every verdict takes the reported GPS accuracy
// into account, so a fix that could plausibly be on either side of a boundary is
// reported as "uncertain" rather than as inside or outside.

const EARTH_RADIUS_M = 6371000;

// Once inside, the user must be this far outside the (accuracy-adjusted) boundary to be
// considered to have left. This stops flicker when someone stands right at the edge.
const EXIT_BUFFER_M = 15;

// A fix implying faster movement than this is treated as a spoofed or bad reading.
// 50 m/s is 180 km/h, well above walking, cycling, or a car on campus roads.
const MAX_SPEED_MPS = 50;

const toRad = (deg) => (deg * Math.PI) / 180;

function haversineM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Local flat projection in metres around a reference point. Accurate for zones of a few km.
function project(p, ref) {
  return {
    x: toRad(p.lng - ref.lng) * Math.cos(toRad(ref.lat)) * EARTH_RADIUS_M,
    y: toRad(p.lat - ref.lat) * EARTH_RADIUS_M,
  };
}

function pointInPolygonXY(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses = (a.y > pt.y) !== (b.y > pt.y);
    if (crosses && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegmentXY(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}

// Signed distance from a point to a zone boundary: negative inside, positive outside (metres).
function signedDistanceM(point, zone) {
  if (zone.kind === 'circle') {
    return haversineM(point, zone.center) - zone.radiusM;
  }
  const ref = zone.center;
  const poly = zone.points.map((pt) => project(pt, ref));
  const p = project(point, ref);
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    min = Math.min(min, distToSegmentXY(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return pointInPolygonXY(p, poly) ? -min : min;
}

// Decide inside / outside / uncertain for one fix, given its accuracy (metres).
// `wasInside` applies the exit buffer so a user has to clearly leave to be marked outside.
function verdict(signedM, accuracyM, wasInside) {
  const acc = Math.max(0, accuracyM);
  const outsideThreshold = acc + (wasInside ? EXIT_BUFFER_M : 0);
  if (signedM < -acc) return 'inside';
  if (signedM > outsideThreshold) return 'outside';
  return 'uncertain';
}

// Speed between two fixes in metres per second. Same-instant fixes that disagree are infinitely fast.
function impliedSpeedMps(prev, next) {
  const dist = haversineM(prev, next);
  const dtSec = (next.at - prev.at) / 1000;
  if (dtSec <= 0) return dist > 1 ? Infinity : 0;
  return dist / dtSec;
}

module.exports = {
  EXIT_BUFFER_M,
  MAX_SPEED_MPS,
  haversineM,
  signedDistanceM,
  verdict,
  impliedSpeedMps,
};
