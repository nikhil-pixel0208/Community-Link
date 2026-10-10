# Community-Link
Community Link is a privacy-conscious, location-based social networking platform designed to connect people who share the same physical space, such as college campuses, hackathons, events, transit hubs, and technology parks.
Unlike traditional social media platforms that rely on permanent followers and broad public feeds, Community Link creates temporary, zone-based communities where users can interact, exchange useful information, collaborate with nearby participants, and solve real-world problems.
The platform enables users to discover local announcements, report lost and found items, ask questions, and coordinate activities within designated zones. Its privacy-first approach incorporates opt-in location access, time-limited posts, user reporting, blocking, spam prevention, and moderator controls to promote safer interactions.

## Running locally

```bash
npm start          # http://localhost:3000 (set PORT / HOST / DATA_FILE to override)
npm test           # unit + API tests (Node built-in test runner, no dependencies)
```

Set `ORGANISER_CODE` to choose the code organisers enter at login (default for local dev: `organiser-demo`).
Data is kept in `data/db.json`, which is git-ignored.

## Templates

| Template | Who can post | Replies | How it clears |
| --- | --- | --- | --- |
| Lost & Found | Anyone | "I found it" | Author resolves it, or the timeline ends |
| Requirement | Anyone | "I can help" | Author marks it met, or the timeline ends |
| Promotion | Anyone | – | Timeline ends (default 24 h), or the author withdraws it |
| Announcement | Organisers | – | Timeline ends (default 24 h), or the organiser withdraws it |
| Communication | Anyone | Yes | Author marks it done, or the timeline ends |

Every template's default timeline is 24 hours (`1440` minutes). Authors can set a shorter time, up to each template's maximum.

## Communication channels

- **Organisers only** (one-to-one with organisers): visible only to the sender and organisers. Participants cannot see it.
- **Whole group** (one-to-many): visible to everyone in the zone.

## Lifecycle

Every post has a timeline (`expiresAt`). A post is **removed entirely** (not archived) when:

1. its author closes it (resolved / requirement met / done / withdrawn), or
2. its timeline ends. Expired posts are purged on every read and by a background sweep every 30 seconds.

## Layout

```
index.js            entry point
src/templates.js    template definitions (rules per template)
src/lifecycle.js    pure rules: validation, visibility, replies, closing, expiry
src/store.js        JSON-file persistence
src/server.js       HTTP API + static file server
public/             single-page frontend (vanilla JS, no build step)
test/               unit tests (lifecycle) and API tests
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/login` | `{ name, role, organiserCode? }` → `{ token, user }` |
| GET | `/api/templates` | Template catalogue |
| GET | `/api/posts?template=&channel=` | Live posts visible to the caller |
| POST | `/api/posts` | `{ template, body, channel?, location?, ttlMinutes?, title? }` — only `body` is required; `title` defaults to the start of the message |
| POST | `/api/posts/:id/responses` | `{ text }` — replies where the template allows them |
| DELETE | `/api/posts/:id` | Author closes the post; it is removed |

Send the token as `Authorization: Bearer <token>`.

## Current limitations

- Login is name-based with a shared organiser code. There is no real account verification yet.
- Zones are not implemented yet; all posts share one zone.
- Storage is a single JSON file, suitable for a demo, not for production scale.

## Zones and location (GPS)

Based on the DropZone problem statement (section 5).

**Zones** (`src/zones.js`) are circles or polygons. The two demo zones use placeholder coordinates near Kakinada; replace them with the real venue coordinates before an event.

**Entry and exit** (`src/presence.js`, `src/geo.js`):
- Entering needs two consecutive fixes inside the zone, so a single noisy reading doesn't count.
- Exiting needs a fix clearly outside (the boundary, plus the GPS accuracy, plus a 15 m buffer), so standing at the edge doesn't flicker.
- A fix with accuracy worse than 150 m is rejected and never changes membership.
- A fix that implies more than 50 m/s (180 km/h) since the last accepted fix is treated as spoofed and rejected.
- Membership lapses after 10 minutes without a check-in.

**Location permission** is opt-in. The app explains what location is used for before the browser asks, and each user can leave a zone or turn location off, which deletes what the server holds.

**Data minimisation:** coordinates are evaluated and discarded. They are not stored, not put in posts, and not shown to other users. Presence lives only in memory, so a restart clears it. Posts store only the zone they belong to.

**Posting and reading** need current membership. Posts from other zones behave as if they don't exist.

**Demo scenarios** (the "Demo scenarios" panel) send real check-ins through the server rules: walk into the hall, walk out, zone edge, poor GPS, spoofed jump, and location denied.

**Privacy notice:** `/privacy.html`.

**Not yet built:** reporting, blocking, a moderator queue, and rate limits. The PDF requires these as well; they are the next items.

New endpoints: `GET /api/zones`, `GET /api/location/status`, `POST /api/location/check-in` with `{ lat, lng, accuracy }`, `POST /api/location/leave`, `POST /api/location/forget`.

## Zone dashboard, events and map

**Dashboard:** inside a zone, the dashboard lists that zone's events only. Each event is marked **Open entry · no sign-in** or **Sign-in required** (registration, college or photo ID, or ticket). Filters switch between them. Free and paid events are shown with their price.

On first run the app adds two real events: **Samartha Hackathon** in the Main Hall (sign-in required) and **Vignan Grand Prix** in the Campus Quad (open to all). Their times are relative to the first run, and organisers can remove them.

Organisers can add events to their current zone from the dashboard, and remove them. Sample events are generated for demo purposes and are marked "Demo". They are never saved to the database. The app doesn't check IDs or tickets; it only shows what the organiser set.

**Map:** uses OpenStreetMap tiles through Leaflet, so no API key or billing account is needed. Leaflet is vendored in `public/vendor/leaflet`. The map shows the zone outlines and **only your own position**. Other people's positions are never shown. Note that the browser loads map tiles from OpenStreetMap, which receives the viewer's IP address and the area shown; the privacy notice says so.

**Live tracking:** the browser reports each new position, so the map follows you. The server gets a check-in at most every 15 seconds, which keeps the entry and exit rules working. Stopping location (or leaving a zone) stops the tracking.

**Events API:** `GET /api/events`, `POST /api/events` (organisers), `DELETE /api/events/:id` (organisers). `GET /api/config` still returns `mapsApiKey` from `GOOGLE_MAPS_API_KEY`, but the front end no longer uses it.
