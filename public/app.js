'use strict';

(function () {
  const TOKEN_KEY = 'communityLinkToken';
  const LOCATION_KEY = 'communityLinkLocation';
  const POLL_MS = 4000;
  const CHECK_IN_MS = 30000;

  const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    templates: [],
    posts: [],
    zone: null,                 // { zoneId, zoneName, since } when inside a zone
    filter: '',
    composer: { template: 'communication', channel: 'public' },
    drafts: {},
    signature: '',
    pollTimer: null,
    loc: {
      // 'off' | 'granted' | 'denied' | 'unsupported'
      permission: localStorage.getItem(LOCATION_KEY) === 'on' ? 'granted' : 'off',
      checkTimer: null,
      message: '',
      tone: '',                 // '', 'good', 'warn'
      busy: false,
    },
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
    stopLocationChecks();
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

  $('#logout').addEventListener('click', async () => {
    try {
      await api('POST', '/api/location/forget');
    } catch (_) { /* logging out regardless */ }
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.user = null;
    state.drafts = {};
    state.signature = '';
    state.zone = null;
    showLogin();
  });

  // ---- Location: permission flow ------------------------------------------

  function openConsent() {
    $('#consent').classList.remove('hidden');
  }

  function closeConsent() {
    $('#consent').classList.add('hidden');
  }

  $('#consent-allow').addEventListener('click', () => {
    closeConsent();
    startRealLocation();
  });
  $('#consent-deny').addEventListener('click', closeConsent);
  $('#consent').addEventListener('click', (e) => {
    if (e.target.id === 'consent') closeConsent();
  });

  function setLocationMessage(text, tone = '') {
    state.loc.message = text;
    state.loc.tone = tone;
    renderLocation();
  }

  function startRealLocation() {
    if (!('geolocation' in navigator)) {
      state.loc.permission = 'unsupported';
      setLocationMessage('This browser cannot provide location.', 'warn');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.loc.permission = 'granted';
        localStorage.setItem(LOCATION_KEY, 'on');
        startLocationChecks();
        checkInFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      (err) => {
        if (err.code === 1) {
          state.loc.permission = 'denied';
          setLocationMessage('Location was blocked. Allow it in your browser settings to use zones.', 'warn');
        } else {
          setLocationMessage('Could not get a location fix. Try again somewhere with a clearer view.', 'warn');
        }
        localStorage.removeItem(LOCATION_KEY);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function startLocationChecks() {
    stopLocationChecks();
    state.loc.checkTimer = setInterval(() => {
      if (state.loc.permission !== 'granted') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => checkInFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => setLocationMessage('Lost the location fix. Zone posts stay hidden until it returns.', 'warn'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    }, CHECK_IN_MS);
  }

  function stopLocationChecks() {
    if (state.loc.checkTimer) clearInterval(state.loc.checkTimer);
    state.loc.checkTimer = null;
  }

  // Sends one fix to the server, which decides membership and then forgets the coordinates.
  async function checkInFix(fix) {
    try {
      const result = await api('POST', '/api/location/check-in', fix);
      applyCheckIn(result);
      return result;
    } catch (err) {
      setLocationMessage(err.message, 'warn');
      return null;
    }
  }

  function applyCheckIn(result) {
    state.zone = result.membership;
    const tone = result.state === 'entered' || result.state === 'member' ? 'good'
      : result.state === 'rejected' || result.state === 'uncertain' || result.state === 'pending' ? 'warn' : '';
    setLocationMessage(result.message, tone);
    refreshComposerAccess();
    loadPosts(true);
  }

  $('#loc-on').addEventListener('click', openConsent);

  $('#loc-off').addEventListener('click', async () => {
    stopLocationChecks();
    localStorage.removeItem(LOCATION_KEY);
    state.loc.permission = 'off';
    try {
      await api('POST', '/api/location/forget');
    } catch (_) { /* nothing to forget */ }
    state.zone = null;
    setLocationMessage('Location is off. Everything about your location has been deleted.');
    refreshComposerAccess();
    loadPosts(true);
  });

  $('#loc-leave').addEventListener('click', async () => {
    try {
      await api('POST', '/api/location/leave');
    } catch (_) { /* ignore */ }
    state.zone = null;
    setLocationMessage('You left the zone. Zone posts are hidden.');
    refreshComposerAccess();
    loadPosts(true);
  });

  function renderLocation() {
    const loc = state.loc;
    const dot = $('#loc-dot');
    let title;
    let text = loc.message;
    let dotClass = 'dot';

    if (state.zone) {
      // Membership is what matters to the user, whichever way the check-in was made.
      title = `In ${state.zone.zoneName}`;
      dotClass += ' good';
    } else if (loc.permission === 'off') {
      title = 'Location off';
      text = text || 'Turn on location to see and post in your zone.';
    } else if (loc.permission === 'denied') {
      title = 'Location blocked';
      text = text || 'Allow location in your browser settings to use zones.';
      dotClass += ' bad';
    } else if (loc.permission === 'unsupported') {
      title = 'Location unavailable';
      dotClass += ' bad';
    } else {
      title = 'Not in a zone';
      dotClass += ' idle';
    }
    if (loc.tone === 'warn') dotClass += ' warn';
    dot.className = dotClass;
    $('#loc-title').textContent = title;
    $('#loc-text').textContent = text;

    const on = loc.permission === 'granted';
    $('#loc-on').classList.toggle('hidden', on || loc.permission === 'unsupported');
    $('#loc-off').classList.toggle('hidden', !on && loc.permission !== 'denied' && !state.zone);
    $('#loc-leave').classList.toggle('hidden', !state.zone);
  }

  // ---- Demo scenarios -----------------------------------------------------
  // The team's demonstration: enter/exit, inaccurate GPS, spoofing and denied permission.
  // Scenarios send real check-ins to the server, so the server's rules are what gets exercised.

  const HALL = { lat: 16.9891, lng: 82.2475 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function offsetPoint(p, northM, eastM) {
    return {
      lat: p.lat + northM / 111320,
      lng: p.lng + eastM / (111320 * Math.cos((p.lat * Math.PI) / 180)),
    };
  }

  async function demoStep(label, fix) {
    $('#demo-status').textContent = `${label}…`;
    const result = await checkInFix(fix);
    if (result) {
      $('#demo-status').textContent = `${label}: ${result.state} (${result.reason})`;
    }
    return result;
  }

  const SCENARIOS = {
    enter: {
      label: 'Walk into Main Hall',
      run: async () => {
        for (const [i, n] of [300, 200, 100, 0].entries()) {
          await demoStep(`Step ${i + 1}/4`, { ...offsetPoint(HALL, n, 0), accuracy: 10 });
          if (i < 3) await sleep(5000);
        }
      },
    },
    walkOut: {
      label: 'Walk out of Main Hall',
      run: async () => {
        for (const [i, n] of [0, 100, 200, 300].entries()) {
          await demoStep(`Step ${i + 1}/4`, { ...offsetPoint(HALL, n, 0), accuracy: 10 });
          if (i < 3) await sleep(5000);
        }
      },
    },
    poorGps: {
      label: 'Poor GPS (300 m accuracy)',
      run: async () => {
        await demoStep('Inaccurate fix', { ...HALL, accuracy: 300 });
      },
    },
    spoof: {
      label: 'Spoofed jump (5 km in 1 s)',
      run: async () => {
        await demoStep('Genuine fix', { ...HALL, accuracy: 10 });
        await sleep(1000);
        await demoStep('Jump to 5 km away', { ...offsetPoint(HALL, 5000, 0), accuracy: 10 });
      },
    },
    edge: {
      label: 'Standing at the zone edge',
      run: async () => {
        await demoStep('Edge fix', { ...offsetPoint(HALL, 160, 0), accuracy: 40 });
      },
    },
    denied: {
      label: 'Location denied',
      run: async () => {
        stopLocationChecks();
        localStorage.removeItem(LOCATION_KEY);
        state.loc.permission = 'denied';
        try { await api('POST', '/api/location/forget'); } catch (_) { /* ignore */ }
        state.zone = null;
        setLocationMessage('Location denied. Zone posts are hidden; the rest of the app still works.', 'warn');
        refreshComposerAccess();
        loadPosts(true);
        $('#demo-status').textContent = 'Location denied: no zone access';
      },
    },
  };

  document.querySelectorAll('[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const scenario = SCENARIOS[btn.dataset.scenario];
      if (!scenario || demoBusy) return;
      demoBusy = true;
      document.querySelectorAll('[data-scenario]').forEach((b) => { b.disabled = true; });
      try {
        await scenario.run();
      } catch (err) {
        $('#demo-status').textContent = `Scenario failed: ${err.message}`;
      } finally {
        demoBusy = false;
        document.querySelectorAll('[data-scenario]').forEach((b) => { b.disabled = false; });
      }
    });
  });
  let demoBusy = false;

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

  // Posting needs a zone: when outside one, the composer is disabled and explains why.
  function refreshComposerAccess() {
    const inZone = !!state.zone;
    $('#msg-input').disabled = !inZone;
    $('#msg-input').placeholder = inZone
      ? `Message ${state.zone.zoneName}…`
      : 'Enter a zone to post. Turn on location in the left panel.';
    $('#composer-submit').disabled = !inZone;
    $('#composer-zone').textContent = inZone ? `Posting in ${state.zone.zoneName}` : 'Not in a zone';
    $('#composer-zone').classList.toggle('on', inZone);
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
    if (!tpl || !state.zone) return;
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
      await loadPosts(true);
    } catch (err) {
      $('#composer-error').textContent = err.message;
      if (err.status === 403) await refreshStatus();
    }
  });

  $('#msg-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  });
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
          await loadPosts(true);
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
          await loadPosts(true);
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
    const empty = $('#feed-empty');
    empty.classList.toggle('hidden', posts.length > 0);
    if (!state.zone) {
      empty.innerHTML = '';
      empty.append(
        el('strong', { text: 'Enter a zone to see its posts.' }),
        el('br'),
        document.createTextNode('Turn on location in the left panel, or try a demo scenario.'),
      );
    } else {
      empty.innerHTML = '';
      empty.append(
        el('strong', { text: 'Nothing here yet.' }),
        el('br'),
        document.createTextNode(`Say something to ${state.zone.zoneName}.`),
      );
    }
  }

  function signatureOf(posts, zone) {
    return JSON.stringify({ zone: zone ? zone.zoneId : null, posts: posts.map((p) => ({ ...p, secondsLeft: undefined })) });
  }

  async function loadPosts(force = false) {
    if (!state.user) return;
    try {
      const data = await api('GET', '/api/posts');
      state.zone = data.zone;
      const sig = signatureOf(data.posts, data.zone);
      state.posts = data.posts;
      refreshComposerAccess();
      if (force || sig !== state.signature) {
        state.signature = sig;
        renderFeed();
      }
      renderLocation();
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
        showLogin();
      }
    }
  }

  async function refreshStatus() {
    try {
      const data = await api('GET', '/api/location/status');
      state.zone = data.membership;
      refreshComposerAccess();
      renderLocation();
    } catch (_) { /* keep current view */ }
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
      state.signature = signatureOf(state.posts, state.zone);
      renderFeed();
    }
  }, 1000);

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => loadPosts(false), POLL_MS);
  }

  // ---- Boot ---------------------------------------------------------------

  async function boot() {
    if (!state.token) return showLogin();
    try {
      status('Checking your session…');
      const [{ user }, { templates }, status2] = await Promise.all([
        api('GET', '/api/me'),
        api('GET', '/api/templates'),
        api('GET', '/api/location/status'),
      ]);
      state.user = user;
      state.templates = templates;
      state.zone = status2.membership;
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
    if (state.loc.permission === 'granted') {
      // Resume where the user left off: ask the browser for a fresh fix straight away.
      startRealLocation();
    }
    renderLocation();
    await loadPosts(true);
    startPolling();
  }

  syncRoleFields();
  boot();
})();
