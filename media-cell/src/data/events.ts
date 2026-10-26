import type { MediaEvent } from './types';

/**
 * ⚠️ SAMPLE ARCHIVE — replace with real, curated event coverage.
 *
 * PRD §5.4: prioritise curated, high-quality work over volume.
 * To add an event: append a record here, drop optimised images into
 * `public/media/events/`, and credit members by their stable `id`.
 * `videoEmbedUrl` accepts a YouTube/Vimeo *embed* URL and is only
 * loaded after a visitor presses play.
 */
export const events: MediaEvent[] = [
  {
    id: 'e01',
    slug: 'annual-cultural-fest-2026',
    title: 'Annual Cultural Fest',
    date: '2026-02-14',
    category: 'Cultural Fest',
    mediaType: 'both',
    description:
      'Three nights, one stage, and the loudest crowd the campus produces all year. Full photo documentation and the official highlight film, shot across the main stage, proscenium and crowd lines.',
    cover: '/media/event-stage.jpg',
    coverAlt: 'Performer silhouetted against orange stage lights as the crowd raises its hands',
    gallery: [
      { src: '/media/event-stage.jpg', alt: 'Main stage headliner under orange beams', caption: 'Main stage — closing night' },
      { src: '/media/hero-camera.jpg', alt: 'Camera operator filming from the crowd line', caption: 'Crowd line, camera two' },
      { alt: 'Frame reserved for the flash-mob sequence stills', caption: 'Flash mob — stills plate' },
      { alt: 'Frame reserved for the battle-of-bands stills', caption: 'Battle of bands — stills plate' },
    ],
    memberIds: ['m01', 'm02', 'm05', 'm10', 'm12'],
    featured: true,
  },
  {
    id: 'e02',
    slug: 'aarambh-freshers-2025',
    title: 'Aarambh — Freshers\u2019 Day',
    date: '2025-08-23',
    category: 'Cultural Fest',
    mediaType: 'photo',
    description:
      'The first stage most students ever step on. Traditional dance, first performances, and a hall full of people seeing the campus come alive for the first time.',
    cover: '/media/event-cultural.jpg',
    coverAlt: 'Traditional dancer mid-performance under a warm spotlight',
    gallery: [
      { src: '/media/event-cultural.jpg', alt: 'Traditional dance performance', caption: 'Opening traditional act' },
      { alt: 'Frame reserved for freshers ramp-walk stills', caption: 'Ramp walk — stills plate' },
      { alt: 'Frame reserved for group choreography stills', caption: 'Group choreography — stills plate' },
    ],
    memberIds: ['m03', 'm06', 'm10', 'm14'],
    featured: true,
  },
  {
    id: 'e03',
    slug: 'annual-sports-meet-2026',
    title: 'Annual Sports Meet',
    date: '2026-01-17',
    category: 'Sports',
    mediaType: 'both',
    description:
      'Two days at track speed. Sprints at golden hour, finals under floodlights, and a same-day film cut before the closing ceremony ended.',
    cover: '/media/event-sports.jpg',
    coverAlt: 'Athletes sprinting on the track backlit by dusk light',
    gallery: [
      { src: '/media/event-sports.jpg', alt: 'Sprint final at dusk', caption: '100m final — golden hour' },
      { alt: 'Frame reserved for relay exchange stills', caption: 'Relay exchange — stills plate' },
      { alt: 'Frame reserved for medal ceremony stills', caption: 'Medal ceremony — stills plate' },
    ],
    memberIds: ['m07', 'm11', 'm05', 'm13'],
    featured: true,
  },
  {
    id: 'e04',
    slug: 'technical-fest-2025',
    title: 'Technical Fest & Hackathon',
    date: '2025-10-11',
    category: 'Technical Fest',
    mediaType: 'film',
    description:
      'Thirty-six hours of builds, demos and 3 a.m. breakthroughs — condensed into a four-minute film and a set of portraits of teams at work.',
    cover: '/media/behind-edit.jpg',
    coverAlt: 'Editor working at glowing monitors in a dark room at night',
    gallery: [
      { src: '/media/behind-edit.jpg', alt: 'Night edit session during the hackathon film', caption: 'The 3 a.m. edit' },
      { alt: 'Frame reserved for hackathon floor stills', caption: 'Hackathon floor — stills plate' },
      { alt: 'Frame reserved for demo-day stills', caption: 'Demo day — stills plate' },
    ],
    memberIds: ['m02', 'm04', 'm09', 'm15'],
  },
  {
    id: 'e05',
    slug: 'graduation-day-2025',
    title: 'Graduation Day',
    date: '2025-05-10',
    category: 'Ceremony',
    mediaType: 'photo',
    description:
      'The quiet counterpart to fest season. Portraits, processions, and the last walk across the stage — shot for the archive so every batch can find its farewell.',
    gallery: [
      { alt: 'Frame reserved for the academic procession stills', caption: 'Procession — stills plate' },
      { alt: 'Frame reserved for degree-award stills', caption: 'Degree awards — stills plate' },
      { alt: 'Frame reserved for the cap-toss stills', caption: 'The cap toss — stills plate' },
    ],
    memberIds: ['m14', 'm03', 'm13'],
  },
  {
    id: 'e06',
    slug: 'founders-film-2024',
    title: 'Where It Started — Founders\u2019 Film',
    date: '2024-11-02',
    category: 'Legacy',
    mediaType: 'film',
    description:
      'The first film the cell ever published, preserved as the opening frame of the legacy archive. Every generation adds a chapter; this is page one.',
    gallery: [
      { alt: 'Frame reserved for the founders\u2019 film poster still', caption: 'Poster frame — 2024' },
      { alt: 'Frame reserved for the first crew photo', caption: 'The first crew — 2024' },
    ],
    memberIds: ['m01', 'm02', 'm04'],
  },
];

export const featuredEvents = events.filter((e) => e.featured);

export function getEventBySlug(slug: string): MediaEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function eventsForMember(memberId: string): MediaEvent[] {
  return events.filter((e) => e.memberIds.includes(memberId));
}

export function eventYear(event: MediaEvent): string {
  return event.date.slice(0, 4);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
