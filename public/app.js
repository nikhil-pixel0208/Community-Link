'use strict';

(function () {
  const TOKEN_KEY = 'communityLinkToken';
  const POLL_MS = 5000;

  const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    templates: [],
    posts: [],
    pollTimer: null,
    lastNow: Date.now(),
  };

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c) node.append(c);
    return node;
  }

  async function api(method, url, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
      headers['X-Session-Token'] = state.token;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* empty body */
    }
    if (!res.ok) {
      const e = new Error(data.error || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return data;
  }

  function formatLeft(seconds) {
    if (seconds <= 0) return 'clearing…';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d) return `${d}d ${h}h left`;
    if (h) return `${h}h ${m}m left`;
    if (m) return `${m}m ${seconds % 60}s left`;
    return `${seconds}s left`;
  }

  function showLogin() {
    stopPolling();
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
    $('#whoami').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#whoami').classList.remove('hidden');
    $('#whoami-text').textContent = `${state.user.name} · ${state.user.role}`;
  }

  // ---- Login -------------------------------------------------------------

  function syncRoleFields() {
    const role = document.querySelector('input[name="role"]:checked').value;
    $('#organiser-code-row').classList.toggle('hidden', role !== 'organiser');
  }

  document.querySelectorAll('input[name="role"]').forEach((r) => r.addEventListener('change', syncRoleFields));

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    $('#login-error').textContent = '';
    status('Submitting…');
    try {
      const role = document.querySelector('input[name="role"]:checked').value;
      const data = await api('POST', '/api/login', {
        name: f.name.value.trim(),
        role,
        organiserCode: f.organiserCode ? f.organiserCode.value : undefined,
      });
      state.token = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      await boot();
    } catch (err) {
      $('#login-error').textContent = err.message;
    }
  });

  $('#logout').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.user = null;
    showLogin();
  });

  // ---- Compose -----------------------------------------------------------

  function currentTemplate() {
    return state.templates.find((t) => t.id === $('#template-select').value);
  }

  function renderComposeForTemplate() {
    const tpl = currentTemplate();
    if (!tpl) return;
    const isOrg = state.user.role === 'organiser';

    $('#template-description').textContent = tpl.description;
    if (tpl.organiserOnly && !isOrg) {
      $('#template-description').textContent += ' (Organisers only — you can view but not post.)';
    }

    const channelSelect = $('#channel-select');
    channelSelect.innerHTML = '';
    const labels = { public: 'Whole group (public)', organisers: 'Organisers only (private)' };
    for (const c of tpl.channels) channelSelect.append(el('option', { value: c, text: labels[c] }));
    $('#channel-row').classList.toggle('hidden', tpl.channels.length < 2);
    $('#channel-hint').textContent =
      channelSelect.value === 'organisers'
        ? 'Only you and the organisers will see this. Use it for private questions.'
        : '';

    $('#location-row').classList.toggle('hidden', !tpl.usesLocation);

    const ttl = $('#ttl-input');
    ttl.value = tpl.ttlMinutes.default;
    ttl.max = tpl.ttlMinutes.max;
    ttl.title = `Between 5 and ${tpl.ttlMinutes.max} minutes`;
  }

  function renderTemplateOptions() {
    const sel = $('#template-select');
    sel.innerHTML = '';
    for (const t of state.templates) {
      sel.append(el('option', { value: t.id, text: t.label + (t.organiserOnly ? ' (organisers)' : '') }));
    }
    const filter = $('#filter-select');
    filter.innerHTML = '';
    filter.append(el('option', { value: '', text: 'All posts' }));
    for (const t of state.templates) filter.append(el('option', { value: t.id, text: t.label }));
  }

  $('#template-select').addEventListener('change', renderComposeForTemplate);
  $('#channel-select').addEventListener('change', renderComposeForTemplate);

  $('#post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    $('#post-error').textContent = '';
    const tpl = currentTemplate();
    const payload = {
      template: tpl.id,
      title: f.title.value,
      body: f.body.value,
      ttlMinutes: f.ttlMinutes.value,
    };
    if (tpl.channels.length > 1) payload.channel = f.channel.value;
    if (tpl.usesLocation) payload.location = f.location.value;
    try {
      await api('POST', '/api/posts', payload);
      f.title.value = '';
      f.body.value = '';
      f.location.value = '';
      await loadPosts();
    } catch (err) {
      $('#post-error').textContent = err.message;
    }
  });

  // ---- Feed --------------------------------------------------------------

  function renderPost(post) {
    const tags = [
      el('span', { class: 'tag', text: post.templateLabel }),
      post.channel === 'organisers'
        ? el('span', { class: 'tag private', text: 'Organisers only' })
        : null,
      post.author.role === 'organiser' ? el('span', { class: 'tag org', text: 'Organiser' }) : null,
    ];

    const replies = post.responses.map((r) =>
      el('li', {},
        el('strong', { text: r.authorName + ': ' }),
        document.createTextNode(r.text)
      )
    );

    const card = el('article', { class: 'post', 'data-id': post.id },
      el('div', { class: 'post-head' },
        el('div', { class: 'tags' }, ...tags),
        el('span', { class: 'timer', 'data-expires': post.expiresAt, text: formatLeft(post.secondsLeft) })
      ),
      el('h3', { text: post.title }),
      el('p', { class: 'body', text: post.body }),
      post.location ? el('p', { class: 'small', text: `📍 ${post.location}` }) : null,
      el('p', { class: 'muted small', text: `${post.author.name}${post.isMine ? ' (you)' : ''}` }),
      replies.length ? el('ul', { class: 'replies' }, ...replies) : null
    );

    if (post.canReply) {
      const input = el('input', { name: 'reply', maxlength: '2000', placeholder: 'Write a reply…' });
      const form = el('form', { class: 'reply-form' }, input,
        el('button', { type: 'submit', text: post.replyLabel || 'Reply' }));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!input.value.trim()) return;
        try {
          await api('POST', `/api/posts/${post.id}/responses`, { text: input.value });
          await loadPosts();
        } catch (err) {
          alert(err.message);
        }
      });
      card.append(form);
    }

    if (post.canClose) {
      const btn = el('button', { class: 'danger', text: post.closeLabel }, null);
      btn.addEventListener('click', async () => {
        if (!confirm('Close this post? It will be removed for everyone.')) return;
        try {
          await api('DELETE', `/api/posts/${post.id}`);
          await loadPosts();
        } catch (err) {
          alert(err.message);
        }
      });
      card.append(el('div', { class: 'actions' }, btn));
    }

    return card;
  }

  function renderFeed() {
    const feed = $('#feed');
    feed.innerHTML = '';
    const filter = $('#filter-select').value;
    const posts = state.posts.filter((p) => !filter || p.template === filter);
    for (const p of posts) feed.append(renderPost(p));
    $('#feed-empty').classList.toggle('hidden', posts.length > 0);
  }

  async function loadPosts() {
    if (!state.user) return;
    try {
      const data = await api('GET', '/api/posts');
      state.posts = data.posts;
      state.lastNow = data.now;
      renderFeed();
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
        showLogin();
      }
    }
  }

  $('#filter-select').addEventListener('change', renderFeed);

  // Countdown ticks locally between polls; server state is refreshed every POLL_MS.
  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.timer').forEach((node) => {
      const seconds = Math.round((Number(node.dataset.expires) - now) / 1000);
      node.textContent = formatLeft(seconds);
    });
    // Remove posts that have run out, without waiting for the next poll.
    const before = state.posts.length;
    state.posts = state.posts.filter((p) => p.expiresAt > now);
    if (state.posts.length !== before) renderFeed();
  }, 1000);

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(loadPosts, POLL_MS);
  }

  async function boot() {
    if (!state.token) return showLogin();
    try {
      status('Checking your session…');
      const [{ user }, { templates }] = await Promise.all([
        api('GET', '/api/me'),
        api('GET', '/api/templates'),
      ]);
      state.user = user;
      state.templates = templates;
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
      showLogin();
      status('');
      $('#login-error').textContent = 'Could not load your session: ' + err.message;
      return;
    }
    status('Opening feed…');
    showApp();
    renderTemplateOptions();
    renderComposeForTemplate();
    await loadPosts();
    startPolling();
  }

  function status(text) {
    const n = document.getElementById('login-status');
    if (n) n.textContent = text;
  }

  status('Script running — ready.');
  syncRoleFields();
  boot();
})();
