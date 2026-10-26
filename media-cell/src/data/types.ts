/**
 * Content model — PRD §10.
 * Content is separate from presentation: update `members.ts` / `events.ts`
 * to change the roster and archive without touching components.
 */

export type AcademicYear = '2nd Year' | '3rd Year' | '4th Year';

export type MemberStatus = 'current' | 'alumni';

export interface MemberLinks {
  instagram?: string;
  portfolio?: string;
  linkedin?: string;
  youtube?: string;
}

export interface Member {
  /** Stable ID — never reuse or renumber; events credit members by ID. */
  id: string;
  /** Display name. */
  name: string;
  /** URL segment: /members/<slug> — lowercase, hyphenated, stable. */
  slug: string;
  year: AcademicYear;
  /** e.g. "Batch of 2027" */
  cohort: string;
  roles: string[];
  /** The member's primary craft, shown first on cards. */
  primaryRole: string;
  bio: string;
  /** One-line signature shown on the profile page. */
  frameLine: string;
  /**
   * Portrait path under /public, e.g. "/media/members/aarav.jpg".
   * Leave undefined until an approved portrait exists — the UI renders
   * a designed monogram frame instead (no stock / fake faces).
   */
  portrait?: string;
  portraitAlt?: string;
  links?: MemberLinks;
  /** Featured members appear in the homepage crew strip. */
  featured?: boolean;
  status: MemberStatus;
}

export type MediaType = 'photo' | 'film' | 'both';

export interface GalleryItem {
  /** Optional image path under /public. Omit for a designed frame plate. */
  src?: string;
  alt: string;
  caption?: string;
}

export interface MediaEvent {
  id: string;
  slug: string;
  title: string;
  /** ISO date, e.g. "2026-02-14" */
  date: string;
  /** e.g. "Cultural Fest", "Sports", "Technical Fest" */
  category: string;
  mediaType: MediaType;
  description: string;
  /** Optional cover image under /public. Omit for a typographic cover. */
  cover?: string;
  coverAlt?: string;
  gallery: GalleryItem[];
  /**
   * Optional highlight-film embed URL (YouTube/Vimeo embed link).
   * Loaded only after the visitor presses play (PRD §11 performance).
   */
  videoEmbedUrl?: string;
  videoPoster?: string;
  /** Member IDs credited on this event. */
  memberIds: string[];
  featured?: boolean;
}
