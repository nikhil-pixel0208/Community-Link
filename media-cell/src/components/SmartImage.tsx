import { useState } from 'react';
import { ImageOff } from 'lucide-react';

type Ratio = 'portrait' | 'wide' | 'event' | 'none';

interface SmartImageProps {
  src?: string;
  alt: string;
  ratio?: Ratio;
  /** Shown when there is no image (designed plate, PRD §8.5 — no stock). */
  fallbackTitle?: string;
  fallbackMonogram?: string;
  eager?: boolean;
  corners?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Image with reserved dimensions (CLS), lazy loading and a designed
 * fallback plate if the media is missing or fails to load (FR-11).
 */
export function SmartImage({
  src,
  alt,
  ratio = 'event',
  fallbackTitle,
  fallbackMonogram,
  eager = false,
  corners = false,
  className = '',
  children,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={`plate plate--${ratio} ${corners ? 'frame-corners' : ''} ${className}`}>
      {corners && (
        <>
          <span className="corner-bl" aria-hidden="true" />
          <span className="corner-br" aria-hidden="true" />
        </>
      )}
      {showImage ? (
        <img
          className="media"
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="plate__fallback" role="img" aria-label={alt}>
          <div>
            {fallbackMonogram ? (
              <div className="monogram" aria-hidden="true">
                {fallbackMonogram}
              </div>
            ) : fallbackTitle ? (
              <div className="plate-title">{fallbackTitle}</div>
            ) : (
              <ImageOff size={34} aria-hidden="true" />
            )}
            <p className="meta" style={{ marginTop: '0.9rem' }}>
              {failed ? 'Media unavailable' : 'Frame to be filled'}
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
