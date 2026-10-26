import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Youtube,
} from 'lucide-react';
import { currentMembers, frameNumber, getMemberBySlug, members } from '../data/members';
import { eventsForMember } from '../data/events';
import { PortraitFrame } from '../components/PortraitFrame';
import { EventCard } from '../components/EventCard';
import { useScrollReveal } from '../hooks/useScrollReveal';

export function MemberPage() {
  const { slug } = useParams<{ slug: string }>();
  const member = slug ? getMemberBySlug(slug) : undefined;
  const [copied, setCopied] = useState(false);
  const ref = useScrollReveal<HTMLDivElement>([slug]);

  if (!member) {
    return (
      <div className="page" style={{ paddingTop: 'calc(var(--header-h) + 4rem)' }}>
        <div className="empty-state">
          <p className="meta meta--accent">Frame not found</p>
          <h1 className="display-md">No member at this URL</h1>
          <p>
            The profile may have moved into the legacy archive, or the link is incomplete.
            The full crew is listed on the roster page.
          </p>
          <Link className="btn btn--solid" to="/members">
            View the full crew
          </Link>
        </div>
      </div>
    );
  }

  const work = eventsForMember(member.id);
  const roster = member.status === 'current' ? currentMembers : members;
  const idx = roster.indexOf(member);
  const prev = roster[(idx - 1 + roster.length) % roster.length];
  const next = roster[(idx + 1) % roster.length];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${member.name} — OUT OF FRAME`, url });
        return;
      }
      throw new Error('no native share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        /* clipboard unavailable — the address bar URL is the share link */
      }
    }
  };

  const socials = [
    { href: member.links?.instagram, label: `${member.name} on Instagram`, Icon: Instagram },
    { href: member.links?.portfolio, label: `${member.name}'s portfolio`, Icon: Globe },
    { href: member.links?.linkedin, label: `${member.name} on LinkedIn`, Icon: Linkedin },
    { href: member.links?.youtube, label: `${member.name} on YouTube`, Icon: Youtube },
  ].filter((s) => s.href);

  return (
    <div ref={ref}>
      <div className="page" style={{ paddingTop: 'calc(var(--header-h) + 2.5rem)' }}>
        <Link className="back-link" to="/members">
          <ArrowLeft size={15} aria-hidden="true" /> All members
        </Link>

        <div className="profile-hero" style={{ marginTop: '1.75rem' }}>
          <div data-reveal>
            <PortraitFrame member={member} eager corners />
            <p className="meta" style={{ marginTop: '0.9rem' }}>
              {frameNumber(member)} — {member.cohort}
              {member.status === 'alumni' ? ' · Legacy member' : ''}
            </p>
          </div>

          <div>
            <p className="meta meta--accent" data-reveal>
              {member.primaryRole} — {member.year}
            </p>
            <h1 className="profile-name" data-reveal>
              {member.name}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} data-reveal>
              {member.roles.map((r) => (
                <span className="chip" key={r}>
                  {r}
                </span>
              ))}
            </div>

            <blockquote className="profile-frameline" data-reveal>
              “{member.frameLine}”
            </blockquote>
            <p className="lede" data-reveal>
              {member.bio}
            </p>

            <dl className="profile-facts" data-reveal>
              <div className="profile-fact">
                <dt>Academic year</dt>
                <dd>{member.year}</dd>
              </div>
              <div className="profile-fact">
                <dt>Cohort</dt>
                <dd>{member.cohort}</dd>
              </div>
              <div className="profile-fact">
                <dt>Primary craft</dt>
                <dd>{member.primaryRole}</dd>
              </div>
              <div className="profile-fact">
                <dt>Events credited</dt>
                <dd>{work.length}</dd>
              </div>
            </dl>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }} data-reveal>
              <button type="button" className="btn btn--solid" onClick={share}>
                {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                {copied ? 'Link copied' : 'Share profile'}
              </button>
              {socials.length > 0 && (
                <span className="social-row">
                  {socials.map(({ href, label, Icon }) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                      <Icon size={18} />
                    </a>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>

        <section aria-labelledby="work-title" style={{ marginTop: '4rem' }}>
          <div className="section-head">
            <div className="section-head__title">
              <p className="meta meta--accent">Selected work</p>
              <h2 className="display-md" id="work-title">
                In the credits
              </h2>
            </div>
          </div>
          {work.length > 0 ? (
            <div className="event-grid">
              {work.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>First credits in production</h3>
              <p>
                {member.name.split(' ')[0]}&apos;s event work is being shot and archived now.
                Check the archive after the next event — this page updates itself from the credits.
              </p>
              <Link className="btn" to="/archive">
                Browse the archive
              </Link>
            </div>
          )}
        </section>

        <nav className="profile-nav" aria-label="More members">
          <Link to={`/members/${prev.slug}`}>
            <span className="next-label">← Previous frame</span>
            <span className="next-name">{prev.name}</span>
          </Link>
          <Link to={`/members/${next.slug}`} style={{ textAlign: 'right' }}>
            <span className="next-label">Next frame →</span>
            <span className="next-name">{next.name}</span>
          </Link>
        </nav>
        <p className="meta" style={{ marginTop: '1rem' }}>
          <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Direct
          link: /members/{member.slug} — works on paste, refresh and share.
        </p>
      </div>
    </div>
  );
}
