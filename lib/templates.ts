/**
 * Template registry.
 *
 * Every post in Community Link is created from a template. A template declares
 * its own fields, its own lifetime presets, and — critically — its own
 * *resolution contract*: what it means for the post's purpose to be fulfilled,
 * and therefore when the post should stop existing.
 *
 * Adding a new template = adding one entry here. Nothing else in the app
 * hardcodes a template name.
 */

export type TemplateId =
  | "lost_found"
  | "found_item"
  | "requirement"
  | "promotion"
  | "announcement"
  | "question";

export type ResolveMode =
  | "claim_confirm" // someone claims, the author confirms -> resolved
  | "fill_slots" // N people needed; filled -> resolved
  | "quota" // N claims available; exhausted -> resolved
  | "deadline" // purely time-bound; the deadline *is* the resolution
  | "manual"; // author closes it when satisfied

export type FieldType = "text" | "textarea" | "select" | "tags" | "number" | "datetime" | "options";

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  choices?: string[];
  max?: number;
  min?: number;
}

export interface TtlPreset {
  label: string;
  ms: number;
}

export interface TemplateDef {
  id: TemplateId;
  label: string;
  /** One-line pitch shown in the composer picker. */
  tagline: string;
  icon: string;
  /** Tailwind-ish accent tokens used by the UI. */
  accent: string;
  resolveMode: ResolveMode;
  /** Does this template collect a headcount (slots / claim quota)? */
  countLabel?: string;
  defaultCount?: number;
  fields: TemplateField[];
  ttlPresets: TtlPreset[];
  defaultTtlMs: number;
  /** Button a non-author taps to engage with the post. */
  respondCta: string;
  respondPlaceholder: string;
  /** Button the author taps to accept a response. */
  acceptLabel: string;
  /** Shown on the tombstone once it is fulfilled. */
  resolvedLabel: string;
  /** Plain-English statement of when this post self-destructs. */
  vanishRule: string;
  /** Can non-members of the zone see it? (always false today, reserved) */
  organizersOnly?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  lost_found: {
    id: "lost_found",
    label: "Lost something",
    tagline: "Describe what you lost. It disappears the moment you get it back.",
    icon: "search",
    accent: "amber",
    resolveMode: "claim_confirm",
    fields: [
      { name: "item", label: "What did you lose?", type: "text", required: true, placeholder: "Black Casio watch" },
      {
        name: "identifiers",
        label: "Identifying details",
        type: "textarea",
        required: true,
        placeholder: "Scratched buckle, brown leather strap, engraved 'NK' on the back",
        help: "Keep one detail out of the post so you can verify the real finder.",
      },
      { name: "last_seen", label: "Last seen where?", type: "text", placeholder: "Near the food court, Block C" },
      {
        name: "secret_check",
        label: "Private verification question",
        type: "text",
        placeholder: "What colour is the strap?",
        help: "Only you see this. Ask it before you confirm a handover.",
      },
    ],
    ttlPresets: [
      { label: "6 hours", ms: 6 * HOUR },
      { label: "1 day", ms: DAY },
      { label: "3 days", ms: 3 * DAY },
    ],
    defaultTtlMs: DAY,
    respondCta: "I found this",
    respondPlaceholder: "Where you found it, and how you can hand it over",
    acceptLabel: "Confirm I got it back",
    resolvedLabel: "Reunited",
    vanishRule: "Vanishes the second you confirm the item is back in your hands.",
  },

  found_item: {
    id: "found_item",
    label: "Found something",
    tagline: "You picked something up. The post clears when it reaches its owner.",
    icon: "hand",
    accent: "emerald",
    resolveMode: "claim_confirm",
    fields: [
      { name: "item", label: "What did you find?", type: "text", required: true, placeholder: "A set of keys" },
      {
        name: "where",
        label: "Where did you find it?",
        type: "text",
        required: true,
        placeholder: "Auditorium, row 4",
      },
      {
        name: "held_at",
        label: "Where is it now?",
        type: "text",
        placeholder: "With me / handed to the help desk",
      },
      {
        name: "withheld",
        label: "Detail you are withholding",
        type: "text",
        placeholder: "Keychain has a blue dolphin",
        help: "Private to you. Make the claimant describe this before you hand it over.",
      },
    ],
    ttlPresets: [
      { label: "12 hours", ms: 12 * HOUR },
      { label: "1 day", ms: DAY },
      { label: "3 days", ms: 3 * DAY },
    ],
    defaultTtlMs: DAY,
    respondCta: "That's mine",
    respondPlaceholder: "Describe the detail only the owner would know",
    acceptLabel: "Confirm handover",
    resolvedLabel: "Returned to owner",
    vanishRule: "Vanishes once you confirm you handed it to the rightful owner.",
  },

  requirement: {
    id: "requirement",
    label: "Need a person / skill",
    tagline: "Ask for help for a fixed window. Clears itself once the slots fill.",
    icon: "users",
    accent: "violet",
    resolveMode: "fill_slots",
    countLabel: "People needed",
    defaultCount: 1,
    fields: [
      {
        name: "role",
        label: "What do you need?",
        type: "text",
        required: true,
        placeholder: "A Python developer for our ML pipeline",
      },
      { name: "skills", label: "Skills", type: "tags", placeholder: "python, pandas, fastapi" },
      {
        name: "commitment",
        label: "How long do you need them?",
        type: "text",
        required: true,
        placeholder: "Until Sunday 6pm — rest of the hackathon",
      },
      { name: "where", label: "Where to find you", type: "text", placeholder: "Table 14, main hall" },
      { name: "perks", label: "What's in it for them?", type: "text", placeholder: "Equal credit + the prize split" },
    ],
    ttlPresets: [
      { label: "2 hours", ms: 2 * HOUR },
      { label: "8 hours", ms: 8 * HOUR },
      { label: "1 day", ms: DAY },
      { label: "3 days", ms: 3 * DAY },
    ],
    defaultTtlMs: 8 * HOUR,
    respondCta: "I can help",
    respondPlaceholder: "What you bring, and when you're free",
    acceptLabel: "Accept — fills a slot",
    resolvedLabel: "Team filled",
    vanishRule: "Vanishes the moment every slot is filled, or when the window closes.",
  },

  promotion: {
    id: "promotion",
    label: "Promotion / offer",
    tagline: "A limited offer for this zone. Dies when the stock or the clock runs out.",
    icon: "tag",
    accent: "rose",
    resolveMode: "quota",
    countLabel: "Claims available",
    defaultCount: 25,
    fields: [
      { name: "offer", label: "The offer", type: "text", required: true, placeholder: "₹60 filter coffee, flat ₹30" },
      { name: "vendor", label: "Who's offering", type: "text", required: true, placeholder: "Brew Corner, Gate 2" },
      {
        name: "terms",
        label: "Conditions",
        type: "textarea",
        placeholder: "Show this screen at the counter. One per person.",
      },
      { name: "code", label: "Redeem code", type: "text", placeholder: "SAMARTHA30" },
    ],
    ttlPresets: [
      { label: "1 hour", ms: HOUR },
      { label: "4 hours", ms: 4 * HOUR },
      { label: "Today", ms: 12 * HOUR },
    ],
    defaultTtlMs: 4 * HOUR,
    respondCta: "Claim this",
    respondPlaceholder: "",
    acceptLabel: "Mark fulfilled",
    resolvedLabel: "Fully claimed",
    vanishRule: "Vanishes when the last claim is taken, or when the offer expires.",
  },

  announcement: {
    id: "announcement",
    label: "Announcement",
    tagline: "Tell the zone something. It clears itself once the moment has passed.",
    icon: "megaphone",
    accent: "sky",
    resolveMode: "deadline",
    fields: [
      {
        name: "headline",
        label: "Headline",
        type: "text",
        required: true,
        placeholder: "Pitch decks due in 30 minutes",
      },
      { name: "details", label: "Details", type: "textarea", placeholder: "Upload to the portal before 4:30pm sharp." },
      { name: "where", label: "Where", type: "text", placeholder: "Main stage" },
      {
        name: "ack",
        label: "Ask people to acknowledge?",
        type: "select",
        choices: ["No", "Yes — track who has seen it"],
      },
    ],
    ttlPresets: [
      { label: "30 minutes", ms: 30 * MIN },
      { label: "2 hours", ms: 2 * HOUR },
      { label: "8 hours", ms: 8 * HOUR },
      { label: "1 day", ms: DAY },
    ],
    defaultTtlMs: 2 * HOUR,
    respondCta: "Acknowledge",
    respondPlaceholder: "",
    acceptLabel: "Close early",
    resolvedLabel: "Delivered",
    vanishRule: "Vanishes at its deadline — or the moment the organiser closes it.",
  },

  question: {
    id: "question",
    label: "Question / quick poll",
    tagline: "Ask the room. Clears as soon as you mark an answer.",
    icon: "help",
    accent: "cyan",
    resolveMode: "manual",
    fields: [
      {
        name: "question",
        label: "Your question",
        type: "text",
        required: true,
        placeholder: "Is there a working printer in this building?",
      },
      {
        name: "options",
        label: "Poll options",
        type: "options",
        help: "Leave empty for an open question.",
        max: 5,
      },
      { name: "context", label: "Context", type: "textarea", placeholder: "Need to print the consent form by 5pm." },
    ],
    ttlPresets: [
      { label: "1 hour", ms: HOUR },
      { label: "4 hours", ms: 4 * HOUR },
      { label: "1 day", ms: DAY },
    ],
    defaultTtlMs: 4 * HOUR,
    respondCta: "Answer",
    respondPlaceholder: "Your answer",
    acceptLabel: "This answered it",
    resolvedLabel: "Answered",
    vanishRule: "Vanishes when you mark an answer as the one that solved it.",
  },
};

export const TEMPLATE_ORDER: TemplateId[] = [
  "lost_found",
  "found_item",
  "requirement",
  "promotion",
  "announcement",
  "question",
];

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && value in TEMPLATES;
}

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES[id];
}

/** Grace period a fulfilled post stays visible (as a receipt) before hard deletion. */
export const RESOLUTION_GRACE_MS = 2 * MIN;
/** Grace period an expired (unfulfilled) post lingers before hard deletion. */
export const EXPIRY_GRACE_MS = 5 * MIN;

export const URGENCIES = ["normal", "high", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];
