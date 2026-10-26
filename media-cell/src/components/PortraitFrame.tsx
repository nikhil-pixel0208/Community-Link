import type { Member } from '../data/types';
import { frameNumber, initials } from '../data/members';
import { SmartImage } from './SmartImage';

interface PortraitFrameProps {
  member: Member;
  eager?: boolean;
  corners?: boolean;
}

/**
 * Member portrait. Until an approved portrait is added to the data,
 * this renders a designed monogram frame — the site never implies a
 * stock/generated face is a real member (PRD §8.5, §11 consent).
 */
export function PortraitFrame({ member, eager = false, corners = false }: PortraitFrameProps) {
  return (
    <SmartImage
      src={member.portrait}
      alt={member.portraitAlt ?? `Portrait of ${member.name}`}
      ratio="portrait"
      fallbackMonogram={initials(member.name)}
      eager={eager}
      corners={corners}
    >
      <span className="member-card__frame-no meta" aria-hidden="true">
        {frameNumber(member)}
      </span>
      <span className="plate__scrim" aria-hidden="true" />
    </SmartImage>
  );
}
