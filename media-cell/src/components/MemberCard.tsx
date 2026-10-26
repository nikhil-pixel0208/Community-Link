import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Member } from '../data/types';
import { PortraitFrame } from './PortraitFrame';

/** Name and key info are always visible — never hover-only (PRD §9). */
export function MemberCard({ member }: { member: Member }) {
  return (
    <Link className="member-card" to={`/members/${member.slug}`} data-reveal>
      <PortraitFrame member={member} />
      <div className="member-card__body">
        <h3 className="member-card__name">{member.name}</h3>
        <p className="member-card__roles">{member.roles.join(' · ')}</p>
        <div className="member-card__foot">
          <span className="chip">{member.year}</span>
          <span className="member-card__arrow">
            Profile <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
