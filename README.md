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
| Promotion | Organisers | – | Timeline ends (or organiser withdraws) |
| Announcement | Organisers | – | Timeline ends (or organiser withdraws) |
| Communication | Anyone | Yes | Author marks it done, or the timeline ends |

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
| POST | `/api/posts` | `{ template, title, body, channel?, location?, ttlMinutes? }` |
| POST | `/api/posts/:id/responses` | `{ text }` — replies where the template allows them |
| DELETE | `/api/posts/:id` | Author closes the post; it is removed |

Send the token as `Authorization: Bearer <token>`.

## Current limitations

- Login is name-based with a shared organiser code. There is no real account verification yet.
- Zones are not implemented yet; all posts share one zone.
- Storage is a single JSON file, suitable for a demo, not for production scale.
