/** Shared by the client report dialog and the server-side moderation queue. */
export const REPORT_REASON_LIST = [
  "Spam or advertising",
  "Harassment or abuse",
  "Scam or fake claim",
  "Off-topic for this zone",
  "Unsafe or threatening",
  "Something else",
] as const;

export type ReportReason = (typeof REPORT_REASON_LIST)[number];
