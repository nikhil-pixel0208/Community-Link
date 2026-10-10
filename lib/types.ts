import type { ResolveMode, TemplateId, Urgency } from "./templates";

export type ZoneKind = "campus" | "hackathon" | "event" | "transit" | "techpark" | "neighbourhood";
export type MemberRole = "member" | "organizer" | "moderator";
export type PostStatus = "open" | "resolved" | "expired" | "removed";

export interface PublicUser {
  id: string;
  handle: string;
  displayName: string;
  avatarHue: number;
  bio: string;
  skills: string[];
  trustScore: number;
}

export interface ZoneSummary {
  id: string;
  slug: string;
  name: string;
  kind: ZoneKind;
  description: string;
  lat: number;
  lng: number;
  radiusM: number;
  startsAt: number;
  endsAt: number;
  archivedAt: number | null;
  memberCount: number;
  openPostCount: number;
  /** Metres from the viewer, when they shared a coarse position. */
  distanceM: number | null;
  inRange: boolean;
  isMember: boolean;
  role: MemberRole | null;
  joinCode: string | null;
}

export interface ResponseDTO {
  id: string;
  user: PublicUser;
  kind: string;
  body: string;
  meta: Record<string, unknown>;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  createdAt: number;
  isMine: boolean;
}

export interface PostDTO {
  id: string;
  zoneId: string;
  template: TemplateId;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  resolveMode: ResolveMode;
  slotsNeeded: number;
  slotsFilled: number;
  status: PostStatus;
  resolvedAt: number | null;
  resolutionNote: string | null;
  purgeAt: number | null;
  urgency: Urgency;
  isAnonymous: boolean;
  pinned: boolean;
  author: PublicUser | null;
  isAuthor: boolean;
  canModerate: boolean;
  responseCount: number;
  responses: ResponseDTO[];
  myResponse: ResponseDTO | null;
  /** Server clock at serialisation time, so clients can render honest countdowns. */
  serverNow: number;
}

export interface ChannelDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: "public" | "announce";
  messageCount: number;
  lastMessageAt: number | null;
}

export interface ChannelMessageDTO {
  id: string;
  user: PublicUser;
  body: string;
  createdAt: number;
  expiresAt: number | null;
  isMine: boolean;
  postId: string | null;
}

export interface ThreadDTO {
  id: string;
  zoneId: string;
  partner: PublicUser;
  partnerRole: MemberRole;
  topic: string;
  postId: string | null;
  postTitle: string | null;
  createdAt: number;
  closedAt: number | null;
  closeReason: string | null;
  lastMessageAt: number | null;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface ThreadMessageDTO {
  id: string;
  userId: string;
  body: string;
  createdAt: number;
  isMine: boolean;
  readAt: number | null;
}

export interface MemberDTO {
  user: PublicUser;
  role: MemberRole;
  joinedAt: number;
  lastSeenAt: number;
  isBanned: boolean;
  mutedUntil: number | null;
  isBlockedByMe: boolean;
}

export interface LifecycleEventDTO {
  id: string;
  subjectType: string;
  subjectId: string;
  type: string;
  detail: Record<string, unknown>;
  createdAt: number;
  actor: PublicUser | null;
}

export interface ReportDTO {
  id: string;
  reporter: PublicUser;
  targetType: string;
  targetId: string;
  reason: string;
  note: string;
  status: string;
  createdAt: number;
  snippet: string;
}

export interface ApiError {
  error: string;
}
