import type { Member } from './types';

/**
 * ⚠️ SAMPLE ROSTER — replace with the real 15 members before launch.
 *
 * Names, bios and cohorts below are placeholders that demonstrate the
 * full experience. To publish the real crew, edit ONLY this file:
 *  1. Set `name`, a stable `slug`, `year`, `cohort`, `roles`, `bio`.
 *  2. Drop an approved portrait into `public/media/members/` and set
 *     `portrait: "/media/members/<file>.jpg"` (+ `portraitAlt`).
 *  3. Keep `id` stable forever — event credits reference it.
 *  4. When a member graduates, set `status: "alumni"` (PRD Journey D)
 *     instead of deleting the record.
 *
 * Consent: only publish portraits/links a member has approved (PRD §11).
 */
export const members: Member[] = [
  {
    id: 'm01',
    name: 'Aarav Reddy',
    slug: 'aarav-reddy',
    year: '4th Year',
    cohort: 'Batch of 2026',
    primaryRole: 'Cinematography',
    roles: ['Cinematography', 'Direction', 'Gimbal Operation'],
    bio: 'Leads the camera crew on flagship events. Believes a shot is only finished when it can hold a room silent for three seconds longer than expected.',
    frameLine: 'If the frame breathes, the story lives.',
    featured: true,
    status: 'current',
  },
  {
    id: 'm02',
    name: 'Sana Fatima',
    slug: 'sana-fatima',
    year: '4th Year',
    cohort: 'Batch of 2026',
    primaryRole: 'Direction',
    roles: ['Direction', 'Production', 'Scripting'],
    bio: 'Plans coverage like a film set — shot lists, call times, contingencies. Keeps fifteen creatives pointed at the same story on the loudest nights of the year.',
    frameLine: 'Chaos is just footage that has not been directed yet.',
    featured: true,
    status: 'current',
  },
  {
    id: 'm03',
    name: 'Karthik Varma',
    slug: 'karthik-varma',
    year: '4th Year',
    cohort: 'Batch of 2026',
    primaryRole: 'Photography',
    roles: ['Photography', 'Photo Editing'],
    bio: 'The stills eye of the cell. Hunts the half-second before the cheer, the breath before the performance — the frames nobody posed for.',
    frameLine: 'The best frame is the one nobody noticed being taken.',
    status: 'current',
  },
  {
    id: 'm04',
    name: 'Priya Nair',
    slug: 'priya-nair',
    year: '4th Year',
    cohort: 'Batch of 2026',
    primaryRole: 'Colour Grading',
    roles: ['Colour Grading', 'Editing'],
    bio: 'Owns the cell\u2019s burnt-orange signature look. Turns flat log footage into the warm, grainy frames the archive is known for.',
    frameLine: 'Colour is memory with the saturation turned honest.',
    featured: true,
    status: 'current',
  },
  {
    id: 'm05',
    name: 'Rohan Mehta',
    slug: 'rohan-mehta',
    year: '3rd Year',
    cohort: 'Batch of 2027',
    primaryRole: 'Editing',
    roles: ['Editing', 'Sound Design', 'Reels'],
    bio: 'Cuts highlight films that feel like trailers. If an aftermovie made you wish you were there, Rohan Mehta probably held the timeline.',
    frameLine: 'Every cut is a promise about the next shot.',
    featured: true,
    status: 'current',
  },
  {
    id: 'm06',
    name: 'Ananya Iyer',
    slug: 'ananya-iyer',
    year: '3rd Year',
    cohort: 'Batch of 2027',
    primaryRole: 'Photography',
    roles: ['Photography', 'Portraits'],
    bio: 'Portrait specialist for crew and performer features. Known for making first-years look like they have headlined for years.',
    frameLine: 'A portrait is a biography in one frame.',
    status: 'current',
  },
  {
    id: 'm07',
    name: 'Vikram Singh',
    slug: 'vikram-singh',
    year: '3rd Year',
    cohort: 'Batch of 2027',
    primaryRole: 'Cinematography',
    roles: ['Cinematography', 'Drone Operation'],
    bio: 'Second camera and aerials. Covers sports days at full sprint and still somehow returns with the steadiest tracking shots in the archive.',
    frameLine: 'Move with the moment, never against it.',
    status: 'current',
  },
  {
    id: 'm08',
    name: 'Divya Menon',
    slug: 'divya-menon',
    year: '3rd Year',
    cohort: 'Batch of 2027',
    primaryRole: 'Design',
    roles: ['Design', 'Social Media', 'Posters'],
    bio: 'Designs the posters, thumbnails and carousels that carry the cell\u2019s identity beyond campus. Anton type and burnt orange are her mother tongue.',
    frameLine: 'Design is the trailer for the film.',
    status: 'current',
  },
  {
    id: 'm09',
    name: 'Aditya Desai',
    slug: 'aditya-desai',
    year: '3rd Year',
    cohort: 'Batch of 2027',
    primaryRole: 'Sound',
    roles: ['Sound', 'Editing', 'Live Mixing'],
    bio: 'Records what cameras miss — the roar before the lights, the silence after the last note. Mixes every highlight film the cell publishes.',
    frameLine: 'You remember what you heard longer than what you saw.',
    status: 'current',
  },
  {
    id: 'm10',
    name: 'Kavya Sharma',
    slug: 'kavya-sharma',
    year: '2nd Year',
    cohort: 'Batch of 2028',
    primaryRole: 'Photography',
    roles: ['Photography', 'Behind the Scenes'],
    bio: 'Shoots the shooters. Her behind-the-scenes stills are why this website can show the process, not just the polish.',
    frameLine: 'Every frame has a frame behind it.',
    featured: true,
    status: 'current',
  },
  {
    id: 'm11',
    name: 'Arjun Patel',
    slug: 'arjun-patel',
    year: '2nd Year',
    cohort: 'Batch of 2028',
    primaryRole: 'Cinematography',
    roles: ['Cinematography', 'Lighting'],
    bio: 'Newest hands on the gimbal, already trusted with stage-left on concert nights. Obsessed with practical light and long takes.',
    frameLine: 'Light first. Everything else follows.',
    status: 'current',
  },
  {
    id: 'm12',
    name: 'Isha Kapoor',
    slug: 'isha-kapoor',
    year: '2nd Year',
    cohort: 'Batch of 2028',
    primaryRole: 'Editing',
    roles: ['Editing', 'Reels', 'Subtitles'],
    bio: 'Fastest turnaround in the cell — same-night reels that are on feeds before the stage lights cool down. Captions everything, always.',
    frameLine: 'Fast is good. Finished is better.',
    status: 'current',
  },
  {
    id: 'm13',
    name: 'Nikhil Rao',
    slug: 'nikhil-rao',
    year: '2nd Year',
    cohort: 'Batch of 2028',
    primaryRole: 'Production',
    roles: ['Production', 'Coordination', 'Archive'],
    bio: 'Keeps the archive honest — every card backed up, every credit logged, every drive labelled. The reason future batches will find this work.',
    frameLine: 'An archive is a promise to the future.',
    status: 'current',
  },
  {
    id: 'm14',
    name: 'Meera Pillai',
    slug: 'meera-pillai',
    year: '4th Year',
    cohort: 'Batch of 2026',
    primaryRole: 'Photography',
    roles: ['Photography', 'Documentation'],
    bio: 'Documents the quiet events with the same care as the loud ones — seminars, graduations, farewells. The archive\u2019s conscience.',
    frameLine: 'Not every important moment is on a stage.',
    status: 'current',
  },
  {
    id: 'm15',
    name: 'Dev Malhotra',
    slug: 'dev-malhotra',
    year: '2nd Year',
    cohort: 'Batch of 2028',
    primaryRole: 'Design',
    roles: ['Design', 'Motion Graphics', 'Titles'],
    bio: 'Animates the title cards and lower-thirds that open every Media Cell film. Believes typography should earn its screen time.',
    frameLine: 'Type is just acting for letters.',
    status: 'current',
  },
];

export const currentMembers = members.filter((m) => m.status === 'current');
export const alumniMembers = members.filter((m) => m.status === 'alumni');
export const featuredMembers = currentMembers.filter((m) => m.featured);

export function getMemberBySlug(slug: string): Member | undefined {
  return members.find((m) => m.slug === slug);
}

export function getMemberById(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

/** "FR.01" style frame number, stable by roster order. */
export function frameNumber(member: Member): string {
  const n = members.indexOf(member) + 1;
  return `FR.${String(n).padStart(2, '0')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
