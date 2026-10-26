import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { IntroSequence, shouldPlayIntro } from '../components/IntroSequence';
import { AppRoutes } from './router';

export function App() {
  const location = useLocation();
  // The intro plays once per session, and only for visitors who land on
  // the homepage — a shared member/event link should open instantly
  // on its content (PRD Journey A + shareable URLs, FR-05/FR-08).
  const [showIntro, setShowIntro] = useState<boolean>(
    () => location.pathname === '/' && shouldPlayIntro(),
  );

  return (
    <div id="top">
      {showIntro && <IntroSequence onDone={() => setShowIntro(false)} />}
      <Navigation />
      <main id="main" className="page-enter" key={location.pathname}>
        <AppRoutes />
      </main>
      <Footer />
    </div>
  );
}
