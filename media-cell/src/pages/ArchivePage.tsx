import { useMemo, useState } from 'react';
import { ArchiveX } from 'lucide-react';
import { events, eventYear } from '../data/events';
import type { MediaType } from '../data/types';
import { EventCard } from '../components/EventCard';
import { useScrollReveal } from '../hooks/useScrollReveal';

type MediaFilter = 'all' | MediaType;

const mediaOptions: Array<{ value: MediaFilter; label: string }> = [
  { value: 'all', label: 'All media' },
  { value: 'photo', label: 'Photography' },
  { value: 'film', label: 'Film' },
];

function matchesMedia(eventType: MediaType, filter: MediaFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'both') return eventType === 'both';
  return eventType === filter || eventType === 'both';
}

export function ArchivePage() {
  const years = useMemo(
    () => ['All years', ...Array.from(new Set(events.map(eventYear))).sort().reverse()],
    [],
  );
  const [year, setYear] = useState('All years');
  const [media, setMedia] = useState<MediaFilter>('all');
  const ref = useScrollReveal<HTMLDivElement>([year, media]);

  const visible = useMemo(
    () =>
      [...events]
        .sort((a, b) => b.date.localeCompare(a.date))
        .filter((e) => (year === 'All years' || eventYear(e) === year) && matchesMedia(e.mediaType, media)),
    [year, media],
  );

  const reset = () => {
    setYear('All years');
    setMedia('all');
  };

  return (
    <div ref={ref}>
      <header className="page-head page">
        <p className="meta meta--accent">Event archive</p>
        <div className="page-head__row">
          <h1 className="display-lg">
            Every event
            <br />
            <span className="outline-text">has a story</span>
          </h1>
          <p className="lede" style={{ maxWidth: '42ch' }}>
            Curated coverage across academic years — not every file we shot, only the frames
            worth keeping. Open an event for its gallery and full crew credits.
          </p>
        </div>
      </header>

      <div className="page">
        <div className="toolbar">
          <div className="toolbar__group" role="group" aria-label="Filter events by year">
            <span className="meta">Year</span>
            <div className="filters">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  className="filter-btn"
                  aria-pressed={year === y}
                  onClick={() => setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar__group" role="group" aria-label="Filter events by media type">
            <span className="meta">Media</span>
            <div className="filters">
              {mediaOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="filter-btn"
                  aria-pressed={media === o.value}
                  onClick={() => setMedia(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="meta" aria-live="polite" style={{ marginBottom: '1.5rem' }}>
          Showing {visible.length} of {events.length} events
        </p>

        {visible.length > 0 ? (
          <div className="event-grid">
            {visible.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <ArchiveX size={36} aria-hidden="true" />
            <h3>Nothing in this reel</h3>
            <p>No archived events match that combination yet. The archive grows every semester — clear the filters to see everything so far.</p>
            <button type="button" className="btn" onClick={reset}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
