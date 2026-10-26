import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { SkipForward } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

gsap.registerPlugin(useGSAP);

const SESSION_KEY = 'oof-intro-seen';

/**
 * Cinematic intro (FR-02):
 * - Controlled GSAP timeline, audio-free.
 * - Immediately accessible Skip control (also dismisses on Escape).
 * - Plays once per session; never blocks repeat navigation.
 * - Skipped instantly for reduced-motion visitors (FR-03).
 */
export function IntroSequence({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    onDone();
  }, [onDone]);

  // Reduced motion: no sequence at all.
  useEffect(() => {
    if (reduced) finish();
  }, [reduced, finish]);

  // Lock scroll + allow Escape to skip while the intro is up.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [finish]);

  useGSAP(
    () => {
      if (reduced) return;
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: finish,
      });
      tl.fromTo('.intro__presents', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6 })
        .fromTo(
          '.intro__title .line > span',
          { yPercent: 110 },
          { yPercent: 0, duration: 0.9, stagger: 0.14, ease: 'power4.out' },
          '-=0.25',
        )
        .fromTo('.intro__tag', { autoAlpha: 0, letterSpacing: '0.6em' }, { autoAlpha: 1, duration: 0.7 }, '-=0.35')
        .to({}, { duration: 0.55 }) // hold the frame
        .to(rootRef.current, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' });
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  if (reduced) return null;

  return (
    <div className="intro" ref={rootRef} role="dialog" aria-label="Introduction — OUT OF FRAME">
      <div>
        <p className="intro__presents">The VIIT Media Cell presents</p>
        <h1 className="intro__title" aria-label="Out of Frame">
          <span className="line">
            <span>OUT OF</span>
          </span>
          <span className="line">
            <span className="accent-text">FRAME</span>
          </span>
        </h1>
        <p className="intro__tag">We see · We frame · We remember</p>
      </div>
      <p className="intro__meta meta">
        <span className="rec-dot" aria-hidden="true" />
        REC — VIIT Media Cell
      </p>
      <button ref={skipRef} type="button" className="intro__skip" onClick={finish}>
        Skip intro <SkipForward size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function shouldPlayIntro(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}
