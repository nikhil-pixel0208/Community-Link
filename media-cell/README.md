# OUT OF FRAME — VIIT Media Cell Website

**WE SEE. WE FRAME. WE REMEMBER.**

The public, cinematic home of the VIIT Media Cell: meet the 15-member crew,
explore the curated event archive, and see how each frame gets made.
Built to outlive every roster — when members graduate, their profiles and
credits stay in the archive.

Implements **PRD v1.0** (VIIT Media Cell Website — OUT OF FRAME).
Stack: React · TypeScript · Vite · React Router · GSAP (`@gsap/react`) · Lucide.

> ⚠️ **Current content status:** the roster and events ship as clearly-marked
> **sample data** so the full experience can be reviewed today. Before public
> launch, replace them with the real, consent-approved crew and coverage —
> it's a data-only edit, no component changes. See [CONTENT-GUIDE.md](./CONTENT-GUIDE.md).

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally
```

## Deploy (free static hosting — PRD §12)

Works as-is on Vercel or Netlify:

| Setting          | Value           |
| ---------------- | --------------- |
| Root directory   | `media-cell`    |
| Install command  | `npm install`   |
| Build command    | `npm run build` |
| Output directory | `dist`          |

Client-side routing is pre-configured so `/members/<slug>` and
`/archive/<slug>` work when opened or refreshed directly:

- `vercel.json` (rewrites) for Vercel
- `public/_redirects` for Netlify

No backend, database, API keys, or custom domain required for v1.
The repo can stay private while the site is public.

## Project structure (PRD §10)

```text
src/
├── app/          App shell + router (routes, titles, scroll/hash handling)
├── components/   Navigation, IntroSequence, MemberCard, EventCard,
│                 FeaturedFilm, PortraitFrame, SmartImage, Lightbox, Footer
├── pages/        Home, Members, Member profile, Archive, Event detail, 404
├── data/         members.ts · events.ts · types.ts   ← edit content here
├── hooks/        reduced-motion + GSAP scroll-reveal
└── styles/       tokens.css (PRD §8 palette/type) · global · animations
                  · components · pages
public/media/     site photography (portraits go in media/members/)
```

## PRD traceability

| PRD item | Where it lives |
| --- | --- |
| FR-01 Responsive homepage | `pages/HomePage.tsx` |
| FR-02 Cinematic intro + skip | `components/IntroSequence.tsx` (GSAP timeline, Skip/Esc, once per session, homepage landings only so shared links open instantly) |
| FR-03 Reduced motion | `hooks/usePrefersReducedMotion.ts`, `styles/animations.css` — intro & reveals fully disabled, content never hidden |
| FR-04 All 15 profiles | `data/members.ts` → `pages/MembersPage.tsx` |
| FR-05 Shareable member URLs | `/members/:slug`, `pages/MemberPage.tsx` (share/copy-link button, per-member page title) |
| FR-06 Featured photo/film | `components/FeaturedFilm.tsx`, home archive preview |
| FR-07 Archive + event pages | `pages/ArchivePage.tsx`, `pages/EventPage.tsx` (gallery + lightbox + credits) |
| FR-08 Direct/refresh on nested routes | `vercel.json`, `public/_redirects` |
| FR-09 Data-driven growth | `data/` only — see CONTENT-GUIDE |
| FR-10 Responsive navigation | `components/Navigation.tsx` (desktop + mobile menu, Esc to close) |
| FR-11 Loading/empty/error states | `SmartImage` fallback plates, empty filter states, film "in post-production" state, 404 page |
| FR-12 Archive filters | Year + media-type filters on `/archive`; year filter on `/members` |
| FR-13 Legacy section | Home `#legacy` + `status: 'alumni'` support in the data model |
| §8 Design system | `styles/tokens.css` — `#151515 / #202020 / #F1EFE8 / #AAA9A2 / #C65B3B / #74746A`, Anton + Inter (self-hosted via Fontsource) |
| §11 Accessibility | Skip link, visible focus, semantic landmarks, alt text, keyboard lightbox/menus, no hover-only info |
| §11 Performance | Lazy images, reserved aspect ratios (no CLS), click-to-load video embeds, local fonts/media only |
| §14 No SAC content | None — SAC is out of scope and absent by design |

## Launch checklist (PRD §14 acceptance criteria)

- [x] Production build passes (`npm run build`)
- [x] Intro skippable; never blocks content; reduced-motion respected
- [x] 15 profiles with working shareable URLs (sample data)
- [x] Archive entries open event pages; credits link back to members
- [x] Direct route access + refresh verified
- [ ] **Replace sample roster/events with real, approved content** (CONTENT-GUIDE)
- [ ] Add official social/contact links in `components/Footer.tsx`
- [ ] Add highlight-film embed URLs in `data/events.ts` as cuts are published
- [ ] Deploy `media-cell/` to Vercel/Netlify and test the public URL on a phone

*The roster will evolve. The archive will grow. The identity will endure.*
