import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Play } from 'lucide-react';
import type { MediaEvent } from '../data/types';
import { SmartImage } from './SmartImage';

/**
 * Featured film presentation (PRD §5.1 / §9):
 * - Poster + explicit play control; nothing auto-downloads (§11).
 * - If an embed URL exists it loads only after play is pressed.
 * - If not, a clear "film in post-production" state is shown (FR-11).
 */
export function FeaturedFilm({ event }: { event: MediaEvent }) {
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState(false);

  const onPlay = () => {
    if (event.videoEmbedUrl) setPlaying(true);
    else setNotice(true);
  };

  return (
    <figure className="film" data-reveal style={{ margin: 0 }}>
      <SmartImage
        src={event.videoPoster ?? event.cover}
        alt={event.coverAlt ?? `Poster frame for the ${event.title} film`}
        ratio="wide"
        fallbackTitle={event.title}
        corners
      >
        <span className="plate__scrim" aria-hidden="true" />
        {playing && event.videoEmbedUrl ? (
          <iframe
            className="film__embed"
            src={event.videoEmbedUrl}
            title={`${event.title} — highlight film`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <figcaption className="film__caption">
              <p className="meta meta--accent">Featured film</p>
              <h3 className="display-md" style={{ marginTop: '0.4rem' }}>
                {event.title}
              </h3>
            </figcaption>
            <div className="film__overlay">
              <button
                type="button"
                className="film__play"
                onClick={onPlay}
                aria-label={`Play the ${event.title} highlight film`}
              >
                <Play size={30} aria-hidden="true" />
              </button>
            </div>
            {notice && (
              <div className="film__note" role="status">
                <p>
                  <strong>This highlight film is in post-production.</strong>{' '}
                  <span style={{ color: 'var(--muted)' }}>
                    The frame is held here until the final cut is published.
                  </span>
                </p>
                <Link className="btn" to={`/archive/${event.slug}`}>
                  View the stills <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
      </SmartImage>
    </figure>
  );
}
