# Community Link

**Samartha · PS-05 — Zone-Based Social Media**

A privacy-conscious, location-based network for people who already share a physical space — a hackathon
hall, a college campus, an event, a transit hub, a tech park.

The point of difference is not that posts expire. It is that **every post carries a contract, and the
post is destroyed the moment that contract is fulfilled.** A lost watch disappears when it's back on your
wrist. A "need a Python dev" disappears when the second slot fills. A coffee promo disappears when the
last claim is taken. Nothing accumulates, because nothing outlives its purpose.

---

## The idea in one screen

| Traditional feed | Community Link |
| --- | --- |
| A poll sits in the chat forever | The post deletes itself when the problem is solved |
| Everything is public or nothing is | Broadcast to the zone **or** open a private 1:1 with an organiser |
| Followers, profiles, history | Presence. You're here, you're useful, then you're gone |
| Location = tracking | Location = a one-time proof you're inside the radius, then discarded |

---

## Templates

Every post is created from a template. A template owns its fields, its lifetime presets, and — the
important part — its **resolution contract**: the condition that retires it.

| Template | Who can post | Resolution contract | What triggers the vanish |
| --- | --- | --- | --- |
| **Lost something** | anyone | `claim_confirm` | Finder claims → author confirms the handover |
| **Found something** | anyone | `claim_confirm` | Owner claims → finder confirms the handover |
| **Need a person / skill** | anyone | `fill_slots` | The last of N slots is accepted |
| **Promotion / offer** | anyone | `quota` | The last of N claims is taken |
| **Announcement** | organisers | `deadline` | The deadline passes, or an organiser closes it early |
| **Question / quick poll** | anyone | `manual` | The author marks an answer as the one that solved it |

Plus a hard ceiling on all of them: a **timeline**. Even an unfulfilled post dies when its clock runs out.

Adding a seventh template is a single entry in [`lib/templates.ts`](lib/templates.ts) — nothing else in
the app hardcodes a template name.

### What "vanish" actually means

Resolution is not a status badge. It is a staged deletion:

1. **Fulfilled** — the post leaves the public feed *immediately*. Uninvolved members never see it again.
2. **Receipt** — the author, the people who responded, and moderators keep a dissolving card with a live
   purge countdown (2 min; 5 min for expiry). The author can hit *erase now* to skip it.
3. **Purged** — the row is `DELETE`d. Not archived, not soft-deleted.
4. **Trail** — an append-only `lifecycle_events` record survives, so the zone can always answer *"what
   happened to that post?"* without keeping the post. This is what stops a disappearing network from
   being an unaccountable one.

Threads bound to a post close themselves in step 1. Conversations don't outlive the thing they were about.

---

## Communication, two ways

This was the part worth getting right.

**One-to-many — zone channels.** `#general` for everyone, `#announcements` where organisers broadcast and
members read. Channel messages are ephemeral too (12h).

**One-to-one — private threads.** The motivating scenario: organisers announce that decks are due in 30
minutes, your team hasn't started, and asking for an extension in front of 400 participants is a bad
look. So:

- **Reach an organiser directly** — a one-tap directory of every organiser and moderator in the zone.
- **Message privately** on any post — opens a 1:1 bound to that post, which auto-closes on resolution.
- Responding to a post opens the coordination thread for you automatically, with your message already in it.

A blocked user can't open or continue a thread, in either direction.

---

## Privacy and safety

- **Opt-in location, never stored.** We compare your coordinates to the zone radius and discard them. The
  `zones` table holds a centre and a radius; there is no column anywhere for a user's position.
- **Two ways in**: be inside the radius, or hold the join code. Nothing else.
- **Anonymous posting** — hidden from responders, still visible to moderators.
- **Withheld verification details.** Lost & found posts carry a private "detail I'm not publishing" field
  that is stripped server-side for everyone except the author, so you can tell a real finder from a chancer.
- **Report, block, mute, ban.** Three open reports on one post auto-hides it pending review.
- **Rate limits** on posting and responding, as sliding windows in SQL.
- **Trust score** moves only when someone actually helps (accepted response) or gets removed.
- **Zones are mortal.** When a zone ends it is archived, and 24h later every post, message and thread
  inside it is deleted by cascade.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The database creates and seeds itself on first request — no migration step.

```bash
npm run smoke        # 44 end-to-end assertions against a running server
npm run reset        # wipe local data; it reseeds on the next request
npm run build        # production build
```

### The seeded world

Three live zones around Kakinada, nine people, posts deliberately left mid-lifecycle so the app is never
an empty state.

| Zone | Code |
| --- | --- |
| Samartha Hackathon 2026 | `SMRT-2026` |
| JNTU Kakinada Campus | `JNTU-KKD1` |
| Kakinada Port Transit Hub | `KKD-PORT` |

Sign in by claiming any handle, or take a seat as a seeded user. **Switching seats** (avatar → *Switch
seat*) is how you show both ends of a private conversation in a live demo.

### A 90-second demo path

1. Sign in as **Nikhil** → Samartha zone. Note the countdown ring on every card.
2. **Feed** → the lost Casio watch has a pending claim from Kiran. Accept it. The card turns into a
   receipt and starts erasing.
3. Switch seat to **Kiran** → the post is already gone from his feed; he keeps his own receipt.
4. **Direct** → the thread about the watch has closed itself.
5. Switch to **Nikhil** → *Direct* → the organiser thread: "We're 20 minutes behind on the deck." That's
   the 1:1 escape hatch, next to a public `#announcements` channel he cannot post in.
6. **Activity** → the trail: created, responded, accepted, resolved, purged. Content gone, accountability intact.

---

## Architecture

Next.js 16 (App Router) · TypeScript · Tailwind v4 · SQLite (better-sqlite3). One process, no external
services, no accounts to provision.

```
app/
  page.tsx                  zone discovery, identity, zone creation
  z/[slug]/
    page.tsx                the feed — template filters, composer, live countdowns
    chat/                   one-to-many: zone channels
    direct/                 one-to-one: private threads + organiser directory
    people/                 members, roles, blocks, moderation queue
    activity/               the lifecycle trail
  api/                      REST route handlers; all authorisation lives here

lib/
  templates.ts              THE REGISTRY — fields, lifetimes, resolution contracts
  lifecycle.ts              the vanish engine: resolve, expire, purge, sweep
  posts.ts                  post CRUD, responses, accept/decline, rate limits
  chat.ts                   channels and 1:1 threads
  zones.ts                  geofencing, join proofs, membership
  moderation.ts             reports, blocks, roles, audit
  db.ts                     schema + connection
  seed.ts                   the demo world
```

**Why polling, not sockets.** Reads are 1–10 ms against local SQLite. A 2.5–4 s poll on the active view
gives a realtime feel with no socket lifecycle to debug under hackathon-demo conditions. Every response
carries `serverNow`, so countdowns are driven by the server's clock, not the browser's.

**Why the sweeper runs on reads *and* a timer.** `sweep()` is idempotent and cheap, so it runs on every
feed read (your view is never stale) and on a 5 s interval (posts die even when nobody is watching).

### Data model

`users` · `sessions` · `zones` · `memberships` · `posts` · `responses` · `channels` ·
`channel_messages` · `dm_threads` · `dm_messages` · `reports` · `blocks` · `mod_actions` ·
`lifecycle_events` · `rate_events`

Deletion cascades from `zones`, so a zone ending really does take everything with it.

---

## Status

Working end to end: identity, geofenced zones, all six templates, the full resolution → receipt → purge
pipeline, both communication modes, moderation, and the lifecycle trail. `npm run smoke` asserts the
guarantees above against a live server.

Next up: push notifications for critical announcements, a map view of nearby zones, image attachments on
lost & found, and exporting a zone's lifecycle trail as a post-event report.
