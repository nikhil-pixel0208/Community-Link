import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { MembersPage } from '../pages/MembersPage';
import { MemberPage } from '../pages/MemberPage';
import { ArchivePage } from '../pages/ArchivePage';
import { EventPage } from '../pages/EventPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { getMemberBySlug } from '../data/members';
import { getEventBySlug } from '../data/events';

const BASE_TITLE = 'OUT OF FRAME — VIIT Media Cell';

function titleForPath(pathname: string): string {
  if (pathname === '/') return BASE_TITLE;
  if (pathname === '/members') return `The Crew — ${BASE_TITLE}`;
  if (pathname === '/archive') return `Event Archive — ${BASE_TITLE}`;
  const memberMatch = pathname.match(/^\/members\/(.+)$/);
  if (memberMatch) {
    const m = getMemberBySlug(memberMatch[1]);
    return m ? `${m.name} — ${BASE_TITLE}` : BASE_TITLE;
  }
  const eventMatch = pathname.match(/^\/archive\/(.+)$/);
  if (eventMatch) {
    const e = getEventBySlug(eventMatch[1]);
    return e ? `${e.title} — ${BASE_TITLE}` : BASE_TITLE;
  }
  return `Lost Frame — ${BASE_TITLE}`;
}

/** Handles scroll restoration, hash targets and per-route document titles. */
function RouteEffects() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (hash) {
      // Wait a frame so the target section exists after navigation.
      const id = hash.replace('#', '');
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname, hash]);

  return null;
}

export function AppRoutes() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:slug" element={<MemberPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/archive/:slug" element={<EventPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
