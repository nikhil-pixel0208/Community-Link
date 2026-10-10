'use strict';

// Test zones for the prototype. Coordinates are placeholders near Kakinada, Andhra Pradesh;
// replace them with the real venue coordinates before a live event.
//
// kind 'circle':  centre + radiusM
// kind 'polygon': points as [{lat, lng}] (at least 3); centre is used as the projection origin

const ZONES = Object.freeze([
  {
    id: 'hack-hall',
    name: 'Samartha Hackathon · Main Hall',
    kind: 'circle',
    center: { lat: 16.9891, lng: 82.2475 },
    radiusM: 150,
  },
  {
    id: 'campus-quad',
    name: 'Campus Quad',
    kind: 'polygon',
    center: { lat: 16.9960, lng: 82.2500 },
    points: [
      { lat: 16.9950, lng: 82.2490 },
      { lat: 16.9950, lng: 82.2510 },
      { lat: 16.9970, lng: 82.2510 },
      { lat: 16.9970, lng: 82.2490 },
    ],
  },
]);

const DEFAULT_ZONE_ID = ZONES[0].id;

function getZone(id) {
  return ZONES.find((z) => z.id === id) || null;
}

// What clients may see about a zone: its name and geometry, never who is in it.
function publicZone(zone) {
  const base = { id: zone.id, name: zone.name, kind: zone.kind, center: zone.center };
  return zone.kind === 'circle'
    ? { ...base, radiusM: zone.radiusM }
    : { ...base, points: zone.points };
}

module.exports = { ZONES, DEFAULT_ZONE_ID, getZone, publicZone };
