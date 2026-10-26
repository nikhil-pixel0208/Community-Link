import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Clapperboard,
  Palette,
  Scissors,
  Aperture,
} from 'lucide-react';
import { alumniMembers, currentMembers, featuredMembers } from '../data/members';
import { events, featuredEvents } from '../data/events';
import { MemberCard } from '../components/MemberCard';
import { EventCard } from '../components/EventCard';
import { FeaturedFilm } from '../components/FeaturedFilm';
import { SectionHeading } from '../components/SectionHeading';
import { SmartImage } from '../components/SmartImage';
import { useScrollReveal } from '../hooks/useScrollReveal';

const crafts = [
  {
    no: '01',
    title: 'Photography',
    text: 'Stills that carry the day after the lights go out — performances, portraits, and the unposed seconds in between.',
  },
  {
    no: '02',
    title: 'Cinematography',
    text: 'Camera and gimbal crews covering stages, tracks and halls with a shot list and a point of view.',
  },
  {
    no: '03',
    title: 'Editing & Colour',
    text: 'Highlight films cut like trailers and graded into the cell\u2019s burnt-orange signature.',
  },
  {
    no: '04',
    title: 'Design & Story',
    text: 'Posters, titles and social frames that give every event an identity before the first shutter clicks.',
  },
];

const processSteps = [
  {
    icon: Aperture,
    title: 'Before the frame',
    text: 'Shot lists, recce walks and call sheets. Every event is planned like a production, not a photo walk.',
  },
  {
    icon: Camera,
    title: 'In the frame',
    text: 'Two-camera coverage, gimbal work and a stills lead — so no moment depends on a single pair of eyes.',
  },
  {
    icon: Scissors,
    title: 'After the frame',
    text: 'Same-night selects, a considered edit, and captions on everything we publish.',
  },
  {
    icon: Palette,
    title: 'The signature grade',
    text: 'Warm highlights, deep shadows, honest skin tones. One look, recognisable across years of archive.',
  },
];

const legacyRows = [
  {
    year: '2024',
    title: 'The first frame',
    text: 'A borrowed camera, one cultural fest, and the decision that the people behind it deserved a name.',
  },
  {
    year: '2025',
    title: 'The archive begins',
    text: 'Coverage expands to sports, technical fests and graduation — every event logged, credited and kept.',
  },
  {
    year: '2026',
    title: 'OUT OF FRAME',
    text: 'Fifteen members across three years, one public home. This website is the current frame of a longer film.',
  },
];

function useTimecode() {
  const [tc, setTc] = useState('00:00:00:00');
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const s = Math.floor((performance.now() - start) / 1000);
      const f = Math.floor(((performance.now() - start) % 1000) / 40);
      const pad = (n: number) => String(n).padStart(2, '0');
      setTc(`00:${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f)}`);
    }, 80);
    return () => window.clearInterval(id);
  }, []);
  return tc;
}

export function HomePage() {
  const ref = useScrollReveal<HTMLDivElement>();
  const tc = useTimecode();
  const film = featuredEvents[0];

  return (
    <div ref={ref}>
      {/* ---------------- HERO ---------------- */}
      <section className="hero page" aria-label="Introduction">
        <div className="hero__top">
          <p className="meta">
            <span className="rec-dot" aria-hidden="true" />
            REC · TC {tc}
          </p>
          <p className="meta">VIIT Media Cell — Est. for every batch that follows</p>
        </div>

        <h1 className="hero__title display-xl">
          <span className="line">OUT OF</span>
          <span className="line outline-text">FRAME</span>
        </h1>

        <div className="hero__grid">
          <div className="hero__media">
            <SmartImage
              src="/media/hero-camera.jpg"
              alt="A Media Cell camera operator filming a live college event from the crowd line"
              ratio="wide"
              eager
              corners
            >
              <span className="plate__scrim" aria-hidden="true" />
              <span className="hero__hud">
                <span className="meta">CAM A — Crowd line</span>
                <span className="meta">The people behind the camera</span>
              </span>
            </SmartImage>
          </div>

          <div className="hero__side">
            <p className="lede">
              Every fest photo you have saved, every aftermovie you have replayed — someone
              was standing in the dark making sure you could. <strong>This is their frame.</strong>{' '}
              Meet the VIIT Media Cell: fifteen photographers, filmmakers, editors and designers
              across three years of BTech.
            </p>
            <div className="hero__stats" aria-label="Media Cell at a glance">
              <div className="hero__stat">
                <strong>{currentMembers.length}</strong>
                <span className="meta">Members</span>
              </div>
              <div className="hero__stat">
                <strong>{events.length}+</strong>
                <span className="meta">Events archived</span>
              </div>
              <div className="hero__stat">
                <strong>03</strong>
                <span className="meta">Cohorts, one crew</span>
              </div>
            </div>
            <div className="hero__cta-row">
              <Link className="btn btn--solid" to="/members">
                Meet the crew <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="btn" to="/archive">
                Open the archive <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- MARQUEE ---------------- */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[0, 1].map((n) => (
            <span key={n}>
              WE SEE <i className="dot" /> WE FRAME <i className="dot" /> WE REMEMBER <i className="dot" /> OUT
              OF FRAME <i className="dot" /> VIIT MEDIA CELL <i className="dot" />
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- MANIFESTO / CRAFT ---------------- */}
      <section className="section page" id="manifesto" aria-labelledby="manifesto-title">
        <div className="manifesto">
          <div data-reveal>
            <p className="meta meta--accent" style={{ marginBottom: '1rem' }}>
              01 — What we do
            </p>
            <p className="manifesto__big" id="manifesto-title">
              A club intro is a poster. <em>A media cell is a body of work.</em> We would rather
              show you the frames than tell you about them.
            </p>
          </div>
          <p className="lede" data-reveal>
            The Media Cell is the college&apos;s student-run production collective. We document
            cultural fests, technical fests, sports meets, ceremonies and the hundred small
            moments in between — then we keep them, credited and archived, so no batch&apos;s
            story disappears when it graduates.
          </p>
        </div>

        <div className="craft-list" style={{ marginTop: '3.5rem' }}>
          {crafts.map((c) => (
            <div className="craft-row" key={c.no} data-reveal>
              <span className="meta meta--accent">{c.no}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <Clapperboard size={20} aria-hidden="true" style={{ color: 'var(--olive)' }} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- FEATURED CREW ---------------- */}
      <section className="section page" aria-labelledby="crew-title" style={{ paddingTop: 0 }}>
        <SectionHeading kicker="02 — The crew" title={<>Faces behind<br />the frames</>} id="crew-title">
          <Link className="btn" to="/members">
            All {currentMembers.length} members <ArrowRight aria-hidden="true" />
          </Link>
        </SectionHeading>
        <div className="member-grid">
          {featuredMembers.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      </section>

      {/* ---------------- FEATURED FILM ---------------- */}
      {film && (
        <section className="section page" id="featured-film" aria-labelledby="film-title" style={{ paddingTop: 0 }}>
          <SectionHeading kicker="03 — Featured film" title="Latest from the timeline" id="film-title">
            <p className="lede" style={{ maxWidth: '38ch' }}>
              One event, one film. Press play when the final cut lands — until then, the
              stills carry the story.
            </p>
          </SectionHeading>
          <FeaturedFilm event={film} />
        </section>
      )}

      {/* ---------------- ARCHIVE PREVIEW ---------------- */}
      <section className="section page" aria-labelledby="archive-title" style={{ paddingTop: 0 }}>
        <SectionHeading kicker="04 — Event archive" title="Selected coverage" id="archive-title">
          <Link className="btn" to="/archive">
            Full archive <ArrowRight aria-hidden="true" />
          </Link>
        </SectionHeading>
        <div className="event-grid">
          {featuredEvents.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      {/* ---------------- BEHIND THE FRAME ---------------- */}
      <section className="section page" id="behind-the-frame" aria-labelledby="behind-title" style={{ paddingTop: 0 }}>
        <SectionHeading kicker="05 — Behind the Frame" title={<>How a frame<br />gets made</>} id="behind-title" />
        <div className="behind-grid">
          <div data-reveal>
            <SmartImage
              src="/media/behind-edit.jpg"
              alt="An editor colour-grading event footage late at night"
              ratio="event"
              corners
            >
              <span className="plate__scrim" aria-hidden="true" />
              <span className="hero__hud">
                <span className="meta">Post — 01:40 AM, fest night two</span>
              </span>
            </SmartImage>
          </div>
          <div>
            <p className="lede" data-reveal>
              Final frames are the last 10% of the work. The rest is planning, carrying,
              waiting, backing up, cutting, grading — and doing it again next weekend.
            </p>
            <div className="process-steps">
              {processSteps.map((s) => (
                <div className="process-step" key={s.title} data-reveal>
                  <span className="process-step__icon">
                    <s.icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- LEGACY ---------------- */}
      <section className="section page" id="legacy" aria-labelledby="legacy-title" style={{ paddingTop: 0 }}>
        <SectionHeading kicker="06 — Legacy" title={<>Built to outlast<br />every roster</>} id="legacy-title">
          <p className="lede" style={{ maxWidth: '40ch' }}>
            Members graduate. The work stays. Each cohort inherits the archive — and adds
            its own chapter to it.
          </p>
        </SectionHeading>

        <div className="legacy-timeline">
          {legacyRows.map((r) => (
            <div className="legacy-row" key={r.year} data-reveal>
              <span className="legacy-row__year">{r.year}</span>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>

        <div data-reveal style={{ marginTop: '2.5rem' }}>
          {alumniMembers.length > 0 ? (
            <p className="lede">
              {alumniMembers.length} graduated members remain in the archive with their
              credited work.
            </p>
          ) : (
            <div className="empty-state">
              <p className="meta meta--accent">Alumni archive</p>
              <h3>The first farewell is still in frame</h3>
              <p>
                When current members graduate, their profiles move here — same URL, same
                credited work, status changed from crew to legacy. Nobody gets deleted
                from the story.
              </p>
              <Link className="btn" to="/members">
                Meet the current 15 <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
