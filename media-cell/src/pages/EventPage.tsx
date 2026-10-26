import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Camera, Clapperboard, Expand } from 'lucide-react';
import { events, formatDate, getEventBySlug } from '../data/events';
import { getMemberById, initials } from '../data/members';
import { FeaturedFilm } from '../components/FeaturedFilm';
import { SmartImage } from '../components/SmartImage';
import { Lightbox } from '../components/Lightbox';
import { EventCard } from '../components/EventCard';
import { useScrollReveal } from '../hooks/useScrollReveal';

export function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = slug ? getEventBySlug(slug) : undefined;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const ref = useScrollReveal<HTMLDivElement>([slug]);

  if (!event) {
    return (
      <div className="page" style={{ paddingTop: 'calc(var(--header-h) + 4rem)' }}>
        <div className="empty-state">
          <p className="meta meta--accent">Reel not found</p>
          <h1 className="display-md">No event at this URL</h1>
          <p>This event may not be archived yet, or the link is incomplete.</p>
          <Link className="btn btn--solid" to="/archive">
            Browse the archive
          </Link>
        </div>
      </div>
    );
  }

  const credits = event.memberIds
    .map(getMemberById)
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const more = events.filter((e) => e.id !== event.id).slice(0, 3);
  const hasFilm = event.mediaType !== 'photo';

  return (
    <div ref={ref}>
      <div className="page" style={{ paddingTop: 'calc(var(--header-h) + 2.5rem)' }}>
        <Link className="back-link" to="/archive">
          <ArrowLeft size={15} aria-hidden="true" /> Event archive
        </Link>

        <header style={{ marginTop: '1.75rem' }}>
          <p className="meta meta--accent" data-reveal>
            {event.category} — {formatDate(event.date)}
          </p>
          <h1 className="display-lg" style={{ marginTop: '0.6rem' }} data-reveal>
            {event.title}
          </h1>
          <div className="event-hero-meta" data-reveal>
            <span className="chip chip--accent">
              <CalendarDays size={13} aria-hidden="true" /> {formatDate(event.date)}
            </span>
            {event.mediaType !== 'film' && (
              <span className="chip">
                <Camera size={13} aria-hidden="true" /> Photography
              </span>
            )}
            {event.mediaType !== 'photo' && (
              <span className="chip">
                <Clapperboard size={13} aria-hidden="true" /> Film
              </span>
            )}
            <span className="chip">{credits.length} crew credited</span>
          </div>
          <p className="lede" data-reveal>
            {event.description}
          </p>
        </header>

        <div style={{ marginTop: '2.25rem' }} data-reveal>
          <SmartImage
            src={event.cover}
            alt={event.coverAlt ?? `Cover frame for ${event.title}`}
            ratio="wide"
            fallbackTitle={event.title}
            eager
            corners
          >
            <span className="plate__scrim" aria-hidden="true" />
            <span className="hero__hud">
              <span className="meta">Cover frame — {event.title}</span>
              <span className="meta">{eventYearLabel(event.date)}</span>
            </span>
          </SmartImage>
        </div>

        {hasFilm && (
          <section aria-labelledby="film-sec" style={{ marginTop: '3.5rem' }}>
            <div className="section-head">
              <div className="section-head__title">
                <p className="meta meta--accent">Highlight film</p>
                <h2 className="display-md" id="film-sec">
                  The cut
                </h2>
              </div>
            </div>
            <FeaturedFilm event={event} />
          </section>
        )}

        <section aria-labelledby="gallery-sec" style={{ marginTop: '3.5rem' }}>
          <div className="section-head">
            <div className="section-head__title">
              <p className="meta meta--accent">Selected frames</p>
              <h2 className="display-md" id="gallery-sec">
                Gallery
              </h2>
            </div>
            <p className="meta">Select a frame to enlarge</p>
          </div>

          {event.gallery.length > 0 ? (
            <div className="gallery-grid">
              {event.gallery.map((g, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="gallery-item"
                    onClick={() => setLightbox(i)}
                    aria-label={`Enlarge frame: ${g.caption ?? g.alt}`}
                  >
                    <SmartImage src={g.src} alt={g.alt} ratio="event" fallbackTitle={g.caption}>
                      <span
                        className="meta"
                        style={{
                          position: 'absolute',
                          top: '0.7rem',
                          right: '0.8rem',
                          zIndex: 2,
                          color: 'var(--ink)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Expand size={13} aria-hidden="true" />
                      </span>
                    </SmartImage>
                    {g.caption && <figcaption>{g.caption}</figcaption>}
                  </button>
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Frames in the edit bay</h3>
              <p>Selects from this event are being curated. The gallery opens with the final set — quality over volume, always.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="credits-sec" style={{ marginTop: '3.5rem' }}>
          <div className="section-head">
            <div className="section-head__title">
              <p className="meta meta--accent">Roll credits</p>
              <h2 className="display-md" id="credits-sec">
                Crew on this event
              </h2>
            </div>
          </div>
          {credits.length > 0 ? (
            <div className="credits-list">
              {credits.map((m) => (
                <Link className="credit" key={m.id} to={`/members/${m.slug}`} data-reveal>
                  {m.portrait ? (
                    <img src={m.portrait} alt="" loading="lazy" />
                  ) : (
                    <span className="credit__mono" aria-hidden="true">
                      {initials(m.name)}
                    </span>
                  )}
                  <span>
                    <span className="credit__name">{m.name}</span>
                    <br />
                    <span className="meta">{m.primaryRole}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="lede">Credits for this event are being compiled for the archive.</p>
          )}
        </section>

        {more.length > 0 && (
          <section aria-labelledby="more-sec" style={{ marginTop: '4rem' }}>
            <div className="section-head">
              <div className="section-head__title">
                <p className="meta meta--accent">Keep watching</p>
                <h2 className="display-md" id="more-sec">
                  More from the archive
                </h2>
              </div>
              <Link className="btn" to="/archive">
                Full archive
              </Link>
            </div>
            <div className="event-grid">
              {more.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox
          items={event.gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}
    </div>
  );
}

function eventYearLabel(iso: string): string {
  return `AY ${iso.slice(0, 4)}`;
}
