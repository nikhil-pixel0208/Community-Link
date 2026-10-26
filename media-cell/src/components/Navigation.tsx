import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/members', label: 'The Crew', end: false },
  { to: '/archive', label: 'Archive', end: false },
  { to: '/#behind-the-frame', label: 'Behind the Frame', end: false, hash: true },
  { to: '/#legacy', label: 'Legacy', end: false, hash: true },
];

export function Navigation() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu on any navigation (FR-10).
  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="page site-header__inner">
          <Link to="/" className="brand" aria-label="OUT OF FRAME — VIIT Media Cell, home">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__text">
              <strong>OUT OF FRAME</strong>
              <span>VIIT Media Cell</span>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Primary">
            {links.map((l) =>
              l.hash ? (
                <Link key={l.to} to={l.to}>
                  {l.label}
                </Link>
              ) : (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {l.label}
                </NavLink>
              ),
            )}
          </nav>

          <button
            className="nav-toggle"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          {links.map((l) =>
            l.hash ? (
              <Link key={l.to} to={l.to}>
                {l.label} <ArrowUpRight size={22} aria-hidden="true" />
              </Link>
            ) : (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {l.label} <ArrowUpRight size={22} aria-hidden="true" />
              </NavLink>
            ),
          )}
          <p className="meta" style={{ marginTop: '1.25rem' }}>
            We see. We frame. We remember.
          </p>
        </nav>
      )}
    </>
  );
}
