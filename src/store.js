'use strict';

// Minimal JSON-file persistence. Good enough for a hackathon demo; swap for a real DB later.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_ZONE_ID: DEFAULT_ZONE } = require('./zones');

function emptyDb() {
  return { users: {}, posts: [] };
}

class Store {
  constructor(file) {
    this.file = file;
    this.db = emptyDb();
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const posts = (parsed.posts || []).map((p) => ({ zoneId: DEFAULT_ZONE, ...p }));
      this.db = { users: parsed.users || {}, posts };
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      this.db = emptyDb();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }

  newId(prefix) {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  createUser({ name, role }) {
    const user = { id: this.newId('usr'), name, role };
    const token = crypto.randomBytes(24).toString('hex');
    this.db.users[token] = user;
    this.save();
    return { token, user };
  }

  userByToken(token) {
    if (!token) return null;
    return Object.prototype.hasOwnProperty.call(this.db.users, token) ? this.db.users[token] : null;
  }

  posts() {
    return this.db.posts;
  }

  findPost(id) {
    return this.db.posts.find((p) => p.id === id) || null;
  }

  addPost(post) {
    const withId = { id: this.newId('post'), responses: [], ...post };
    this.db.posts.push(withId);
    this.save();
    return withId;
  }

  addResponse(postId, response) {
    const post = this.findPost(postId);
    if (!post) return null;
    const entry = { id: this.newId('rsp'), ...response };
    post.responses.push(entry);
    this.save();
    return entry;
  }

  // Closing a post (resolved / withdrawn / done) removes it entirely from the store.
  removePost(id) {
    const before = this.db.posts.length;
    this.db.posts = this.db.posts.filter((p) => p.id !== id);
    const changed = this.db.posts.length !== before;
    if (changed) this.save();
    return changed;
  }

  replacePosts(posts) {
    if (posts.length === this.db.posts.length) return 0;
    const removed = this.db.posts.length - posts.length;
    this.db.posts = posts;
    this.save();
    return removed;
  }
}

module.exports = { Store };
