import { Link } from 'react-router-dom';
import { Instagram, Youtube, Mail, ArrowUp } from 'lucide-react';

/**
 * Footer (PRD §5.1). Social/contact links are placeholders ("#") until
 * the cell publishes its official handles — update them here.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="page">
        <div className="footer-big">
          <p className="meta meta--accent" style={{ marginBottom: '1rem' }}>
            The roster evolves · The archive grows · The identity endures
          </p>
          <h2>
            WE SEE. WE FRAME.
            <br />
            <span className="outline-text">WE REMEMBER.</span>
          </h2>
        </div>

        <div className="footer-grid">
          <div>
            <h3>Explore</h3>
            <ul>
              <li><Link to="/members">The Crew — all 15</Link></li>
              <li><Link to="/archive">Event Archive</Link></li>
              <li><Link to="/#behind-the-frame">Behind the Frame</Link></li>
              <li><Link to="/#legacy">Legacy</Link></li>
            </ul>
          </div>
          <div>
            <h3>The Cell</h3>
            <ul>
              <li><Link to="/#manifesto">What we do</Link></li>
              <li><Link to="/#featured-film">Featured film</Link></li>
              <li><Link to="/members">Current roster</Link></li>
            </ul>
          </div>
          <div>
            <h3>Follow the frames</h3>
            <div className="social-row">
              <a href="#" aria-label="Media Cell on Instagram (link to be published)">
                <Instagram size={19} />
              </a>
              <a href="#" aria-label="Media Cell on YouTube (link to be published)">
                <Youtube size={19} />
              </a>
              <a href="#" aria-label="Email the Media Cell (address to be published)">
                <Mail size={19} />
              </a>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Official handles will be linked here at launch.
            </p>
          </div>
          <div>
            <h3>Colophon</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Shot, cut and archived by the students of the VIIT Media Cell.
              Portraits and footage appear with the consent of the people in frame.
            </p>
          </div>
        </div>

        <div className="footer-base">
          <p className="meta">© {new Date().getFullYear()} VIIT Media Cell — OUT OF FRAME</p>
          <p className="meta">An independent student collective showcase</p>
          <a className="back-link" href="#top">
            Back to top <ArrowUp size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
