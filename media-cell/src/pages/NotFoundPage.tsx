import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="page notfound">
      <div>
        <p className="meta meta--accent">404 — Out of frame, literally</p>
        <h1 className="display-xl" style={{ margin: '1rem 0' }}>
          LOST
          <br />
          <span className="outline-text">FRAME</span>
        </h1>
        <p className="lede" style={{ margin: '0 auto 2rem' }}>
          This URL never made the final cut. The crew, the archive and everything
          in between are one click back.
        </p>
        <Link className="btn btn--solid" to="/">
          <ArrowLeft aria-hidden="true" /> Back to OUT OF FRAME
        </Link>
      </div>
    </div>
  );
}
