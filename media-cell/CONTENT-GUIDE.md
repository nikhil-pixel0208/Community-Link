# Content & Handover Guide — OUT OF FRAME

How future Media Cell generations update this website **without touching
components** (PRD Journey C & D). Everything content lives in two files:

- `src/data/members.ts` — the roster
- `src/data/events.ts` — the archive

After any edit: `npm run build` must pass, then deploy.

---

## Add / update a member

1. Copy an existing record in `members.ts`.
2. Set a **new stable `id`** (`m16`, `m17`, …). Never renumber or reuse —
   event credits point at IDs forever.
3. `slug`: lowercase, hyphenated, no spaces — e.g. `priya-nair`.
   This becomes the shareable URL: `/members/priya-nair`. Never change a
   published slug (old shared links would break).
4. Fill `name`, `year`, `cohort`, `primaryRole`, `roles`, `bio`, `frameLine`.
5. Portrait (only with the member's consent):
   - Export ~900×1200 px JPG/WebP, ideally < 250 KB.
   - Save to `public/media/members/<slug>.jpg`.
   - Set `portrait: "/media/members/<slug>.jpg"` and a descriptive
     `portraitAlt`.
   - No portrait yet? Leave it out — the site renders a designed monogram
     frame instead. **Never** substitute a stock/generated face.
6. `links`: only handles the member has approved for publication.
7. `featured: true` puts the member in the homepage crew strip (keep ~5).

## Graduate a member (Journey D — legacy)

Change `status: 'current'` → `status: 'alumni'`. That's all. The profile
URL keeps working, all event credits stay linked, and the member moves to
the Legacy presentation. **Never delete a record** — deleting breaks
credits and shared links.

## Add an event

1. Copy a record in `events.ts`; new stable `id`, hyphenated `slug`.
2. `date` as `YYYY-MM-DD`; `category`; `mediaType` (`photo` | `film` | `both`).
3. Media goes in `public/media/events/` (optimise first: covers ~1600 px
   wide, gallery ~1200 px, JPG/WebP). Set `cover` + `coverAlt`; add
   `gallery` frames with `alt` + optional `caption`. A gallery frame
   without `src` renders as a labelled plate — useful while selects are
   being curated, but publish real frames for launch.
4. Highlight film: paste the **embed** URL (YouTube/Vimeo) into
   `videoEmbedUrl`. It loads only when a visitor presses play. Add
   captions on the video platform (PRD §11).
5. `memberIds`: credit every member who worked the event — this powers
   both the event's credit roll and each member's "In the credits" list.
6. Quality over volume (PRD §5.4): curate the best frames; don't dump
   whole memory cards.

## Rules that keep the site trustworthy

- **Consent first.** Identifiable portraits/footage need the person's
  OK before publishing. No private contact info or student IDs, ever.
- **Licensed media only** — original Media Cell work; check music rights
  on films.
- **Alt text** on every image: describe the frame, not "image1".
- **No secrets in the repo.** v1 needs none — keep it that way.
- Test on a phone and with keyboard-only navigation before announcing.

## Annual handover (15 minutes)

1. Graduate the outgoing batch (`status: 'alumni'`).
2. Add the incoming members; adjust `featured` flags.
3. Archive the year's flagship events with full credits.
4. `npm run build`, deploy, open the public URL on mobile, done.
5. Hand the new maintainers this file + repo/hosting access.
