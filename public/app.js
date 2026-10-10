'use strict';

(function () {
  const TOKEN_KEY = 'communityLinkToken';
  const POLL_MS = 4000;

  const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    templates: [],
    posts: [],
    filter: '',
    composer: { template: 'communication', channel: 'public' },
    drafts: {},          // reply drafts, kept across re-renders
    signature: '',       // last rendered post list (ignores countdown values)
    pollTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
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

  // ---- Small helpers ------------------------------------------------------

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0] || '').join('').toUpperCase() || '?';
  }

  function hueFor(name) {
    let h = 0;
    for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  function avatar(name, extraClass = '') {
    return el('span', {
      class: `avatar ${extraClass}`.trim(),
      style: `background:hsl(${hueFor(name)} 55% 45%)`,
      text: initials(name),
      title: name,
    });
  }

  function formatLeft(seconds) {
    if (seconds <= 0) return 'clearing…';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d) return `clears in ${d}d ${h}h`;
    if (h) return `clears in ${h}h ${m}m`;
    if (m) return `clears in ${m}m`;
    return `clears in ${seconds}s`;
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), 3000);
  }

  function status(text) {
    const n = document.getElementById('login-status');
    if (n) n.textContent = text;
  }

  function templateById(id) {
    return state.templates.find((t) => t.id === id);
  }

  function canUseTemplate(tpl) {
    return !tpl.organiserOnly || (state.user && state.user.role === 'organiser');
  }

  // ---- Views --------------------------------------------------------------

  function showLogin() {
    stopPolling();
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#me-avatar').textContent = initials(state.user.name);
    $('#me-avatar').style.background = `hsl(${hueFor(state.user.name)} 55% 45%)`;
    $('#me-text').textContent = `${state.user.name} · ${state.user.role === 'organiser' ? 'Organiser' : 'Participant'}`;
  }

  // ---- Login --------------------------------------------------------------

  function selectedRole() {
    return document.querySelector('input[name="role"]:checked').value;
  }

  function syncRoleFields() {
    $('#organiser-code-row').classList.toggle('hidden', selectedRole() !== 'organiser');
  }

  document.querySelectorAll('input[name="role"]').forEach((r) => r.addEventListener('change', syncRoleFields));

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-error').textContent = '';
    status('Signing in…');
    try {
      const data = await api('POST', '/api/login', {
        name: $('#login-name').value.trim(),
        role: selectedRole(),
        organiserCode: $('#login-code').value,
      });
      state.token = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      await boot();
    } catch (err) {
      status('');
      $('#login-error').textContent = err.message;
    }
  });

  $('#logout').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.user = null;
    state.drafts = {};
    state.signature = '';
    showLogin();
  });

  // ---- Composer -----------------------------------------------------------

  function renderChips() {
    const wrap = $('#template-chips');
    wrap.innerHTML = '';
    for (const tpl of state.templates) {
      const allowed = canUseTemplate(tpl);
      const chip = el('button', {
        type: 'button',
        class: 'chip',
        role: 'radio',
        'aria-checked': String(state.composer.template === tpl.id),
        disabled: !allowed,
        title: allowed ? tpl.description : 'Only organisers can post this',
        text: tpl.label + (tpl.organiserOnly ? ' · organisers' : ''),
        onclick: () => selectTemplate(tpl.id),
      });
      if (state.composer.template === tpl.id) chip.classList.add('on');
      wrap.append(chip);
    }
  }

  function renderChannels() {
    const tpl = templateById(state.composer.template);
    const seg = $('#channel-seg');
    seg.innerHTML = '';
    const labels = { public: 'Whole group', organisers: 'Organisers only' };
    if (!tpl) return;
    if (tpl.channels.length < 2) {
      state.composer.channel = 'public';
      $('#channel-row').classList.add('hidden');
    } else {
      $('#channel-row').classList.remove('hidden');
      for (const c of tpl.channels) {
        const on = state.composer.channel === c;
        seg.append(el('button', {
          type: 'button',
          class: `seg-btn${on ? ' on' : ''}`,
          role: 'radio',
          'aria-checked': String(on),
          text: labels[c],
          onclick: () => {
            state.composer.channel = c;
            renderChannels();
          },
        }));
      }
    }
    $('#channel-hint').textContent =
      state.composer.channel === 'organisers' ? 'Only you and the organisers will see this.' : '';
  }

  function renderComposerMeta() {
    const tpl = templateById(state.composer.template);
    if (!tpl) return;
    $('#template-desc').textContent = tpl.description;
    $('#location-row').classList.toggle('hidden', !tpl.usesLocation);
    const ttl = $('#msg-ttl');
    ttl.placeholder = `${tpl.ttlMinutes.default} (default)`;
    ttl.max = tpl.ttlMinutes.max;
  }

  function selectTemplate(id) {
    const tpl = templateById(id);
    if (!tpl || !canUseTemplate(tpl)) return;
    state.composer.template = id;
    if (!tpl.channels.includes(state.composer.channel)) state.composer.channel = tpl.channels[0];
    renderChips();
    renderChannels();
    renderComposerMeta();
  }

  $('#composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#composer-error').textContent = '';
    const input = $('#msg-input');
    const tpl = templateById(state.composer.template);
    if (!tpl) return;
    const payload = {
      template: tpl.id,
      body: input.value,
      channel: state.composer.channel,
    };
    if (tpl.usesLocation && $('#msg-location').value.trim()) payload.location = $('#msg-location').value;
    if ($('#msg-ttl').value) payload.ttlMinutes = $('#msg-ttl').value;
    try {
      await api('POST', '/api/posts', payload);
      input.value = '';
      input.style.height = '';
      $('#msg-location').value = '';
      $('#msg-ttl').value = '';
      toast('Sent');
      await loadPosts();
    } catch (err) {
      $('#composer-error').textContent = err.message;
    }
  });

  // Grow the message box with its content.
  $('#msg-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  });
  // Enter sends, Shift+Enter adds a new line.
  $('#msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#composer').requestSubmit();
    }
  });

  // ---- Feed ---------------------------------------------------------------

  function renderRail() {
    const rail = $('#rail');
    rail.innerHTML = '';
    const count = (id) => (id ? state.posts.filter((p) => p.template === id).length : state.posts.length);
    const items = [{ id: '', label: 'Everything' }, ...state.templates.map((t) => ({ id: t.id, label: t.label }))];
    for (const it of items) {
      rail.append(el('button', {
        type: 'button',
        class: `rail-item${state.filter === it.id ? ' on' : ''}`,
        onclick: () => {
          state.filter = it.id;
          renderFeed();
        },
      }, el('span', { text: it.label }), el('span', { class: 'count', text: String(count(it.id)) })));
    }
  }

  function renderReplies(post) {
    if (!post.responses.length) return null;
    return el('div', { class: 'thread' },
      ...post.responses.map((r) => el('div', { class: `reply${r.authorName === state.user.name ? ' mine' : ''}` },
        avatar(r.authorName, 'tiny'),
        el('div', { class: 'reply-body' },
          el('div', { class: 'reply-meta' },
            el('strong', { text: r.authorName }),
            el('span', { class: 'muted', text: ` · ${timeAgo(r.createdAt)}` })),
          el('div', { class: 'reply-text', text: r.text })))));
  }

  function renderPost(post) {
    const tags = [
      el('span', { class: 'tag', text: post.templateLabel }),
      post.channel === 'organisers' ? el('span', { class: 'tag private', text: 'Organisers only' }) : null,
      post.author.role === 'organiser' ? el('span', { class: 'tag org', text: 'Organiser' }) : null,
    ];

    const card = el('article', { class: 'msg', 'data-id': post.id },
      avatar(post.author.name),
      el('div', { class: 'msg-main' },
        el('div', { class: 'msg-meta' },
          el('strong', { text: post.isMine ? `${post.author.name} (you)` : post.author.name }),
          el('span', { class: 'muted', text: ` · ${timeAgo(post.createdAt)}` }),
          el('span', { class: 'timer', 'data-expires': post.expiresAt, text: formatLeft(post.secondsLeft) })),
        el('div', { class: 'tags' }, ...tags),
        el('p', { class: 'msg-text', text: post.body }),
        post.location ? el('p', { class: 'loc', text: `📍 ${post.location}` }) : null,
        renderReplies(post),
      ),
    );

    const main = card.querySelector('.msg-main');

    if (post.canReply) {
      const input = el('input', { class: 'reply-input', maxlength: '2000', placeholder: post.replyLabel || 'Reply' });
      input.value = state.drafts[post.id] || '';
      input.addEventListener('input', () => { state.drafts[post.id] = input.value; });
      const form = el('form', { class: 'reply-form' }, input,
        el('button', { type: 'submit', class: 'btn small', text: post.replyLabel || 'Reply' }));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!input.value.trim()) return;
        try {
          await api('POST', `/api/posts/${post.id}/responses`, { text: input.value });
          delete state.drafts[post.id];
          await loadPosts();
        } catch (err) {
          toast(err.message);
        }
      });
      main.append(form);
    }

    if (post.canClose) {
      const btn = el('button', { type: 'button', class: 'btn ghost small', text: post.closeLabel });
      btn.addEventListener('click', async () => {
        if (!confirm('Close this? It will be removed for everyone.')) return;
        try {
          await api('DELETE', `/api/posts/${post.id}`);
          delete state.drafts[post.id];
          await loadPosts();
        } catch (err) {
          toast(err.message);
        }
      });
      main.append(el('div', { class: 'actions' }, btn));
    }

    return card;
  }

  function renderFeed() {
    renderRail();
    const feed = $('#feed');
    feed.innerHTML = '';
    const posts = state.posts.filter((p) => !state.filter || p.template === state.filter);
    for (const p of posts) feed.append(renderPost(p));
    $('#feed-empty').classList.toggle('hidden', posts.length > 0);
  }

  function signatureOf(posts) {
    return JSON.stringify(posts.map((p) => ({ ...p, secondsLeft: undefined })));
  }

  async function loadPosts() {
    if (!state.user) return;
    try {
      const data = await api('GET', '/api/posts');
      const sig = signatureOf(data.posts);
      state.posts = data.posts;
      if (sig !== state.signature) {
        state.signature = sig;
        renderFeed();
      }
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
        showLogin();
      }
    }
  }

  // Countdown ticks locally; posts whose time runs out are removed straight away.
  setInterval(() => {
    if (!state.user) return;
    const now = Date.now();
    document.querySelectorAll('.timer').forEach((node) => {
      node.textContent = formatLeft(Math.round((Number(node.dataset.expires) - now) / 1000));
    });
    const before = state.posts.length;
    state.posts = state.posts.filter((p) => p.expiresAt > now);
    if (state.posts.length !== before) {
      state.signature = signatureOf(state.posts);
      renderFeed();
    }
  }, 1000);

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(loadPosts, POLL_MS);
  }

  // ---- Boot ---------------------------------------------------------------

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
    renderChips();
    selectTemplate(state.composer.template);
    await loadPosts();
    startPolling();
  }

  syncRoleFields();
  boot();
})();
