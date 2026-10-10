'use strict';

// Template definitions for Community Link posts.
//
// Each template describes how a post behaves:
//  - organiserOnly: only organisers may create posts from this template (Announcement only)
//  - allowsReplies: whether other users can reply (e.g. "I found it", "I can help")
//  - closeLabel:    wording shown to the author when the post is closed
//  - channels:      communication only. 'public' = whole group, 'organisers' = 1:1 with organisers
//  - ttl:           default (24 h) / maximum lifetime of a post, in minutes

const MINUTE = 60 * 1000;

const TEMPLATES = Object.freeze({
  lost_found: {
    id: 'lost_found',
    label: 'Lost & Found',
    description: 'Report a lost or found item. Close the post once the item is handed back.',
    organiserOnly: false,
    allowsReplies: true,
    replyLabel: 'I found it',
    closeLabel: 'Item returned – resolve',
    channels: ['public'],
    ttlMinutes: { default: 1440, max: 1440 },
    usesLocation: true,
  },
  requirement: {
    id: 'requirement',
    label: 'Requirement',
    description: 'Ask for help or a skill (e.g. a Python developer). Close once someone fulfils it.',
    organiserOnly: false,
    allowsReplies: true,
    replyLabel: 'I can help',
    closeLabel: 'Requirement met – resolve',
    channels: ['public'],
    ttlMinutes: { default: 1440, max: 10080 },
    usesLocation: false,
  },
  promotion: {
    id: 'promotion',
    label: 'Promotion',
    description: 'Promotions from the group or organisers. They expire automatically after 24 hours by default.',
    organiserOnly: false,
    allowsReplies: false,
    replyLabel: null,
    closeLabel: 'Withdraw',
    channels: ['public'],
    ttlMinutes: { default: 1440, max: 10080 },
    usesLocation: false,
  },
  announcement: {
    id: 'announcement',
    label: 'Announcement',
    description: 'Organiser-only announcements. They expire automatically.',
    organiserOnly: true,
    allowsReplies: false,
    replyLabel: null,
    closeLabel: 'Withdraw',
    channels: ['public'],
    ttlMinutes: { default: 1440, max: 10080 },
    usesLocation: false,
  },
  communication: {
    id: 'communication',
    label: 'Communication',
    description:
      'Message the whole group, or only the organisers. Clears once the matter is handled.',
    organiserOnly: false,
    allowsReplies: true,
    replyLabel: 'Reply',
    closeLabel: 'Done – clear message',
    channels: ['public', 'organisers'],
    ttlMinutes: { default: 1440, max: 1440 },
    usesLocation: false,
  },
});

const TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
const CHANNELS = Object.freeze(['public', 'organisers']);

function getTemplate(id) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, id) ? TEMPLATES[id] : null;
}

function ttlBoundsMs(template) {
  return {
    defaultMs: template.ttlMinutes.default * MINUTE,
    maxMs: template.ttlMinutes.max * MINUTE,
    minMs: 5 * MINUTE,
  };
}

module.exports = {
  MINUTE,
  TEMPLATES,
  TEMPLATE_IDS,
  CHANNELS,
  getTemplate,
  ttlBoundsMs,
};
