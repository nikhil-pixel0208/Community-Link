import type { ReactNode } from 'react';

interface SectionHeadingProps {
  kicker: string;
  title: ReactNode;
  children?: ReactNode; // right-aligned slot (links, copy)
  id?: string;
}

export function SectionHeading({ kicker, title, children, id }: SectionHeadingProps) {
  return (
    <div className="section-head" data-reveal>
      <div className="section-head__title">
        <p className="meta meta--accent">{kicker}</p>
        <h2 className="display-lg" id={id}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
