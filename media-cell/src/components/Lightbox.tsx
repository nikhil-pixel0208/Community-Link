import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryItem } from '../data/types';

interface LightboxProps {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/** Keyboard-accessible gallery lightbox: Esc closes, arrows navigate. */
export function Lightbox({ items, index, onClose, onNavigate }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const item = items[index];

  const step = useCallback(
    (dir: 1 | -1) => onNavigate((index + dir + items.length) % items.length),
    [index, items.length, onNavigate],
  );

  useEffect(() => {
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, step]);

  if (!item) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Gallery viewer" onClick={onClose}>
      <button ref={closeRef} type="button" className="lightbox__close" onClick={onClose} aria-label="Close gallery viewer">
        <X size={22} />
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        {item.src ? (
          <img src={item.src} alt={item.alt} />
        ) : (
          <div className="plate plate--wide" role="img" aria-label={item.alt}>
            <div className="plate__fallback">
              <div className="plate-title">{item.caption ?? 'Frame to be filled'}</div>
            </div>
          </div>
        )}
        <figcaption>
          <span>
            {item.caption ?? item.alt} — {index + 1} / {items.length}
          </span>
          <span className="lightbox__nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous frame">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next frame">
              <ChevronRight size={20} />
            </button>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
