import { Link } from 'react-router-dom';
import { ArrowUpRight, Camera, Clapperboard } from 'lucide-react';
import type { MediaEvent } from '../data/types';
import { formatDate } from '../data/events';
import { SmartImage } from './SmartImage';

export function EventCard({ event }: { event: MediaEvent }) {
  return (
    <Link className="event-card" to={`/archive/${event.slug}`} data-reveal>
      <SmartImage
        src={event.cover}
        alt={event.coverAlt ?? `Cover frame for ${event.title}`}
        ratio="event"
        fallbackTitle={event.title}
      >
        <span className="plate__scrim" aria-hidden="true" />
        <span className="event-card__overlay">
          <span className="meta" style={{ color: 'var(--ink)' }}>
            {event.category}
          </span>
          <span className="meta" style={{ color: 'var(--ink)', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            {event.mediaType !== 'film' && <Camera size={14} aria-hidden="true" />}
            {event.mediaType !== 'photo' && <Clapperboard size={14} aria-hidden="true" />}
            {event.mediaType === 'both' ? 'Photo + Film' : event.mediaType === 'film' ? 'Film' : 'Photo'}
          </span>
        </span>
      </SmartImage>
      <div className="event-card__body">
        <p className="meta meta--accent">{formatDate(event.date)}</p>
        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__desc">{event.description}</p>
        <span className="member-card__arrow">
          Open event <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
