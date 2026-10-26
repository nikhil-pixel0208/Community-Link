import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { currentMembers, alumniMembers } from '../data/members';
import type { AcademicYear } from '../data/types';
import { MemberCard } from '../components/MemberCard';
import { useScrollReveal } from '../hooks/useScrollReveal';

const years: Array<'All' | AcademicYear> = ['All', '4th Year', '3rd Year', '2nd Year'];

export function MembersPage() {
  const [year, setYear] = useState<'All' | AcademicYear>('All');
  const ref = useScrollReveal<HTMLDivElement>([year]);

  const visible = useMemo(
    () => currentMembers.filter((m) => year === 'All' || m.year === year),
    [year],
  );

  return (
    <div ref={ref}>
      <header className="page-head page">
        <p className="meta meta--accent">The crew — Roll call</p>
        <div className="page-head__row">
          <h1 className="display-lg">
            The people
            <br />
            <span className="outline-text">behind the camera</span>
          </h1>
          <p className="lede" style={{ maxWidth: '42ch' }}>
            Fifteen members. Three academic years. One crew. Every profile below is a
            permanent, shareable page — open one and send it to anyone.
          </p>
        </div>
      </header>

      <div className="page">
        <div className="toolbar">
          <div className="toolbar__group" role="group" aria-label="Filter members by academic year">
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
          <p className="meta" aria-live="polite">
            Showing {visible.length} of {currentMembers.length} members
          </p>
        </div>

        {visible.length > 0 ? (
          <div className="member-grid">
            {visible.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchX size={36} aria-hidden="true" />
            <h3>No one in this frame</h3>
            <p>No current members match that year yet. Try another filter — the full crew is one tap away.</p>
            <button type="button" className="btn" onClick={() => setYear('All')}>
              Show everyone
            </button>
          </div>
        )}

        {alumniMembers.length > 0 && (
          <section aria-labelledby="alumni-title" style={{ marginTop: '4rem' }}>
            <h2 className="display-md" id="alumni-title" style={{ marginBottom: '1.5rem' }}>
              Legacy members
            </h2>
            <div className="member-grid">
              {alumniMembers.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
