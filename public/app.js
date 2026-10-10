'use strict';

(function () {
  const TOKEN_KEY = 'communityLinkToken';
  const LOCATION_KEY = 'communityLinkLocation';
  const POLL_MS = 4000;
  const CHECK_IN_MS = 15000;     // server check-ins at most this often; the map itself updates live
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    templates: [],
    zones: [],                   // public zone geometry, for the map
    posts: [],
    events: [],
    zone: null,                  // { zoneId, zoneName, since } when inside a zone
    filter: '',
    eventFilter: 'all',
    composer: { template: 'communication', channel: 'public' },
    drafts: {},
    signature: '',
    pollTimer: null,
    me: null,                    // this user's own live position (kept in the browser only)
    forceScroll: true,
    loc: {
      // 'off' | 'granted' | 'denied' | 'unsupported'
      permission: localStorage.getItem(LOCATION_KEY) === 'on' ? 'granted' : 'off',
      watchId: null,
      lastSent: 0,
      message: '',
      tone: '',
    },
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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
      style: `background:hsl(${hueFor(name)} 50% 42%)`,
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

  const CLOCK = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
  const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const DAY_LABEL = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' });
  const WHEN = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
  const TIME_ONLY = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

  function formatRange(startsAt, endsAt) {
    return `${WHEN.format(startsAt)} – ${TIME_ONLY.format(endsAt)}`;
  }

  function dayLabel(ts) {
    const key = DAY_KEY.format(ts);
    const today = DAY_KEY.format(Date.now());
    const yesterday = DAY_KEY.format(Date.now() - 86400000);
    if (key === today) return 'Today';
    if (key === yesterday) return 'Yesterday';
    return DAY_LABEL.format(ts);
  }

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), 3000);
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
    stopLocation();
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const av = $('#me-avatar');
    av.textContent = initials(state.user.name);
    av.style.background = `hsl(${hueFor(state.user.name)} 50% 42%)`;
    $('#me-name').textContent = state.user.name;
    $('#me-role').textContent = state.user.role === 'organiser' ? 'Organiser' : 'Participant';
    $('#event-admin').classList.toggle('hidden', state.user.role !== 'organiser');
  }

  // ---- Login --------------------------------------------------------------

  function selectedRole() {
    return document.querySelector('input[name="role"]:checked').value;
  }

  function syncRoleFields() {
    $('#organiser-code-row').classList.toggle('hidden', selectedRole() !== 'organiser');
  }

  $$('input[name="role"]').forEach((r) => r.addEventListener('change', syncRoleFields));

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-error').textContent = '';
    setLoginStatus('Signing in…');
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
      setLoginStatus('');
      $('#login-error').textContent = err.message;
    }
  });

  function setLoginStatus(text) {
    const n = document.getElementById('login-status');
    if (n) n.textContent = text;
  }

  $('#logout').addEventListener('click', async () => {
    try {
      await api('POST', '/api/location/forget');
    } catch (_) { /* logging out regardless */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOCATION_KEY);
    state.token = null;
    state.user = null;
    state.drafts = {};
    state.signature = '';
    state.zone = null;
    state.me = null;
    state.posts = [];
    state.events = [];
    state.forceScroll = true;
    showLogin();
  });

  // ---- Location: permission flow and live position -----------------------

  function openConsent() {
    $('#consent').classList.remove('hidden');
  }

  function closeConsent() {
    $('#consent').classList.add('hidden');
  }

  $('#consent-allow').addEventListener('click', () => {
    closeConsent();
    startLocation();
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

  // Live tracking: the browser reports each new position. The map moves immediately, but the
  // server only receives a check-in every CHECK_IN_MS, which keeps the zone rules meaningful.
  function startLocation() {
    if (!('geolocation' in navigator)) {
      state.loc.permission = 'unsupported';
      setLocationMessage('This browser cannot provide location.', 'warn');
      return;
    }
    stopLocation();
    state.loc.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        state.loc.permission = 'granted';
        localStorage.setItem(LOCATION_KEY, 'on');
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        state.me = { ...fix, at: Date.now() };
        updateMap();
        if (Date.now() - state.loc.lastSent >= CHECK_IN_MS) {
          state.loc.lastSent = Date.now();
          checkInFix(fix);
        }
      },
      (err) => {
        if (err.code === 1) {
          state.loc.permission = 'denied';
          localStorage.removeItem(LOCATION_KEY);
          setLocationMessage('Your browser blocked location. Allow it in the site settings, then reload. Until then, use the demo scenarios.', 'warn');
          stopLocation();
        } else {
          setLocationMessage('Waiting for a clear GPS fix. Try again somewhere with a clearer view.', 'warn');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  }

  function stopLocation() {
    if (state.loc.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(state.loc.watchId);
    }
    state.loc.watchId = null;
    state.me = null;
    updateMap();
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
    zoneChanged();
  }

  // Called whenever membership may have changed.
  function zoneChanged() {
    state.forceScroll = true;
    refreshComposerAccess();
    renderLocation();
    loadPosts(true);
    loadEvents();
    updateMap();
  }

  $('#loc-on').addEventListener('click', openConsent);

  $('#loc-off').addEventListener('click', async () => {
    stopLocation();
    localStorage.removeItem(LOCATION_KEY);
    state.loc.permission = 'off';
    try {
      await api('POST', '/api/location/forget');
    } catch (_) { /* nothing to forget */ }
    state.zone = null;
    setLocationMessage('Location is off. Everything about your location has been deleted.');
    zoneChanged();
  });

  $('#loc-leave').addEventListener('click', async () => {
    try {
      await api('POST', '/api/location/leave');
    } catch (_) { /* ignore */ }
    state.zone = null;
    setLocationMessage('You left the zone. Zone messages are hidden.');
    zoneChanged();
  });

  function renderLocation() {
    const loc = state.loc;
    let title;
    let text = loc.message;
    let dotClass = 'dot';

    if (state.zone) {
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
    $('#loc-dot').className = dotClass;
    $('#loc-title').textContent = title;
    $('#loc-text').textContent = text;

    const on = loc.permission === 'granted';
    // Once the browser has blocked location, asking again does nothing: explain how to unblock it instead.
    $('#loc-on').classList.toggle('hidden', on || loc.permission === 'unsupported' || loc.permission === 'denied');
    $('#loc-off').classList.toggle('hidden', !on && loc.permission !== 'denied' && !state.zone);
    $('#loc-leave').classList.toggle('hidden', !state.zone);
  }

  // ---- Map (OpenStreetMap via Leaflet; no API key) ------------------------

  const mapState = { map: null, zoneLayers: [], me: null, meAccuracy: null, lastZoneKey: '', fitted: false };

  function zoneStyle(isMine) {
    return {
      color: isMine ? '#0f766e' : '#4f46e5',
      weight: isMine ? 3 : 2,
      opacity: 0.9,
      fillColor: isMine ? '#0f766e' : '#4f46e5',
      fillOpacity: isMine ? 0.16 : 0.06,
      interactive: false,
    };
  }

  function ensureMap() {
    if (mapState.map) return true;
    if ($('#app-view').classList.contains('hidden')) return false;
    if (!window.L) {
      $('#map-note').textContent = 'The map could not load. The rest of the app still works.';
      return false;
    }
    const start = state.zones.length ? state.zones[0].center : { lat: 16.9891, lng: 82.2475 };
    mapState.map = L.map('map', { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], 16);
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapState.map);
    setTimeout(() => mapState.map && mapState.map.invalidateSize(), 0);
    return true;
  }

  function drawZones() {
    for (const layer of mapState.zoneLayers) layer.remove();
    mapState.zoneLayers = [];
    const mine = state.zone ? state.zone.zoneId : null;
    let bounds = null;
    for (const z of state.zones) {
      const style = zoneStyle(z.id === mine);
      const layer = z.kind === 'circle'
        ? L.circle([z.center.lat, z.center.lng], { ...style, radius: z.radiusM })
        : L.polygon(z.points.map((p) => [p.lat, p.lng]), style);
      layer.addTo(mapState.map);
      mapState.zoneLayers.push(layer);
      const b = layer.getBounds();
      bounds = bounds ? bounds.extend(b) : b;
    }
    return bounds;
  }

  function updateMap() {
    if (!ensureMap()) return;
    // Redraw zone outlines only when the zone set or membership changes.
    const key = `${state.zones.map((z) => z.id).join(',')}|${state.zone ? state.zone.zoneId : ''}`;
    if (key !== mapState.lastZoneKey) {
      mapState.lastZoneKey = key;
      const bounds = drawZones();
      if (bounds && !state.me && !mapState.fitted) {
        mapState.map.fitBounds(bounds.pad(0.3));
        mapState.fitted = true;
      }
    }
    // Only this user's own position is drawn. Other people's positions are never shown.
    if (state.me) {
      const ll = [state.me.lat, state.me.lng];
      if (!mapState.me) {
        mapState.me = L.circleMarker(ll, {
          radius: 8, color: '#ffffff', weight: 3, fillColor: '#4f46e5', fillOpacity: 1, interactive: false,
        }).addTo(mapState.map);
        mapState.meAccuracy = L.circle(ll, {
          radius: Math.max(5, state.me.accuracy || 10), color: '#4f46e5', weight: 1, fillOpacity: 0.08, interactive: false,
        }).addTo(mapState.map);
        mapState.map.setView(ll, 17);
        mapState.fitted = true;
      }
      mapState.me.setLatLng(ll);
      mapState.meAccuracy.setLatLng(ll);
      mapState.meAccuracy.setRadius(Math.max(5, state.me.accuracy || 10));
      if (!mapState.map.getBounds().contains(ll)) mapState.map.panTo(ll);
      $('#map-note').textContent = `Only you can see your position (blue dot). Accuracy about ${Math.round(state.me.accuracy)} m.`;
    } else {
      if (mapState.me) {
        mapState.me.remove();
        mapState.meAccuracy.remove();
        mapState.me = null;
        mapState.meAccuracy = null;
      }
      $('#map-note').textContent = state.zone
        ? 'Your zone is outlined in green. Only you can see your position.'
        : 'Zones are outlined in purple. Turn on location to see where you are.';
    }
  }

  async function loadZones() {
    try {
      const data = await api('GET', '/api/zones');
      state.zones = data.zones;
    } catch (_) { /* map simply stays empty */ }
  }

  // ---- Zone events --------------------------------------------------------

  function eventMatchesFilter(e) {
    if (state.eventFilter === 'open') return !e.requiresAuth;
    if (state.eventFilter === 'auth') return e.requiresAuth;
    return true;
  }

  function renderEvents() {
    const list = $('#event-list');
    list.innerHTML = '';
    const all = state.events;
    const openCount = all.filter((e) => !e.requiresAuth).length;
    const authCount = all.length - openCount;

    $('#dash-count').textContent = state.zone
      ? `${openCount} open · ${authCount} sign-in`
      : 'Not in a zone';

    $$('[data-ef]').forEach((b) => {
      b.classList.toggle('on', b.dataset.ef === state.eventFilter);
    });

    const shown = all.filter(eventMatchesFilter);
    for (const e of shown) list.append(renderEvent(e));

    const empty = $('#event-empty');
    empty.classList.toggle('hidden', shown.length > 0);
    empty.textContent = !state.zone
      ? 'Enter a zone to see the events happening there.'
      : (state.eventFilter === 'open' ? 'No open events right now.' : 'No events match this filter.');
  }

  function renderEvent(e) {
    const open = !e.requiresAuth;
    const price = e.free ? 'Free' : `₹${e.price}`;
    const card = el('article', { class: `event ${open ? 'open' : 'auth'}` },
      el('div', { class: 'event-top' },
        el('span', { class: `badge ${open ? 'open' : 'auth'}`, text: open ? 'Open entry' : 'Sign-in required' }),
        el('span', { class: `price${e.free ? ' free' : ''}`, text: price }),
        e.demo ? el('span', { class: 'demo-tag', text: 'Demo' }) : null,
      ),
      el('h3', { text: e.title }),
      el('p', { class: 'muted small', text: `${formatRange(e.startsAt, e.endsAt)}${e.venue ? ` · ${e.venue}` : ''}` }),
      el('p', { class: 'small', text: `${e.entryLabel}${e.entryNote ? ` — ${e.entryNote}` : ''}` }),
    );
    if (state.user && state.user.role === 'organiser' && !e.demo) {
      const btn = el('button', { type: 'button', class: 'btn ghost small danger', text: 'Remove' });
      btn.addEventListener('click', async () => {
        if (!confirm(`Remove "${e.title}"?`)) return;
        try {
          await api('DELETE', `/api/events/${e.id}`);
          await loadEvents();
        } catch (err) {
          toast(err.message);
        }
      });
      card.append(el('div', { class: 'actions' }, btn));
    }
    return card;
  }

  async function loadEvents() {
    if (!state.user) return;
    try {
      const data = await api('GET', '/api/events');
      state.events = data.events;
      state.zone = data.zone;
      renderEvents();
      refreshComposerAccess();
      $('#dash-sub').textContent = state.zone
        ? `Happening in ${state.zone.zoneName}. Only events in your zone are shown.`
        : 'Turn on location and enter a zone to see its events.';
    } catch (_) { /* keep the last list */ }
  }

  $$('[data-ef]').forEach((b) => {
    b.addEventListener('click', () => {
      state.eventFilter = b.dataset.ef;
      renderEvents();
    });
  });

  $('#event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    $('#event-error').textContent = '';
    const payload = {
      title: f.evTitle.value,
      venue: f.evVenue.value,
      startsAt: f.evStarts.value ? new Date(f.evStarts.value).toISOString() : '',
      endsAt: f.evEnds.value ? new Date(f.evEnds.value).toISOString() : '',
      entry: f.evEntry.value,
      free: f.evFree.checked,
      price: f.evPrice.value,
      entryNote: f.evNote.value,
    };
    try {
      await api('POST', '/api/events', payload);
      e.target.reset();
      $('#ev-price-row').classList.add('hidden');
      toast('Event added');
      await loadEvents();
    } catch (err) {
      $('#event-error').textContent = err.message;
    }
  });

  $('#ev-free').addEventListener('change', (e) => {
    $('#ev-price-row').classList.toggle('hidden', e.target.checked);
  });

  // ---- Composer -----------------------------------------------------------

  function renderChips() {
    const wrap = $('#template-chips');
    wrap.innerHTML = '';
    for (const tpl of state.templates) {
      const allowed = canUseTemplate(tpl);
      const on = state.composer.template === tpl.id;
      wrap.append(el('button', {
        type: 'button',
        class: `chip${on ? ' on' : ''}`,
        role: 'radio',
        'aria-checked': String(on),
        disabled: !allowed,
        title: allowed ? tpl.description : 'Only organisers can post this',
        text: tpl.label + (tpl.organiserOnly ? ' · organisers' : ''),
        onclick: () => selectTemplate(tpl.id),
      }));
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
    const input = $('#msg-input');
    input.disabled = !inZone;
    $('#msg-title').disabled = !inZone;
    input.placeholder = inZone ? `Message ${state.zone.zoneName}…` : 'Enter a zone to start a conversation';
    $('#composer-submit').disabled = !inZone;

    $('#zone-title').textContent = inZone ? state.zone.zoneName : 'No zone yet';
    $('#zone-sub').textContent = inZone
      ? 'Messages here are seen by people in this zone. They clear when closed or when their timeline ends.'
      : 'Turn on location to join your zone\u2019s conversation.';
    const pill = $('#status-pill');
    pill.textContent = inZone ? 'Inside zone' : 'Outside zone';
    pill.classList.toggle('on', inZone);
    $('#composer-zone').textContent = inZone
      ? `Posting in ${state.zone.zoneName}`
      : 'Only people inside a zone can post. Turn on location to join.';
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
    if (!tpl || !state.zone || !input.value.trim()) return;
    const payload = {
      template: tpl.id,
      body: input.value,
      channel: state.composer.channel,
    };
    if ($('#msg-title').value.trim()) payload.title = $('#msg-title').value.trim();
    if (tpl.usesLocation && $('#msg-location').value.trim()) payload.location = $('#msg-location').value;
    if ($('#msg-ttl').value) payload.ttlMinutes = $('#msg-ttl').value;
    try {
      await api('POST', '/api/posts', payload);
      input.value = '';
      input.style.height = '';
      $('#msg-title').value = '';
      $('#msg-location').value = '';
      $('#msg-ttl').value = '';
      state.forceScroll = true;
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
  $('#msg-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#msg-input').focus();
    }
  });

  // ---- Feed ---------------------------------------------------------------

  function renderRooms() {
    const rooms = $('#rooms');
    rooms.innerHTML = '';
    const count = (id) => (id ? state.posts.filter((p) => p.template === id).length : state.posts.length);
    const items = [{ id: '', label: 'All messages' }, ...state.templates.map((t) => ({ id: t.id, label: t.label }))];
    for (const it of items) {
      const on = state.filter === it.id;
      rooms.append(el('button', {
        type: 'button',
        class: `room${on ? ' on' : ''}`,
        'aria-pressed': String(on),
        onclick: () => {
          state.filter = it.id;
          state.forceScroll = true;
          renderFeed();
        },
      }, el('span', { text: it.label }), el('span', { class: 'count', text: String(count(it.id)) })));
    }
  }

  function renderReplies(post) {
    if (!post.responses.length) return null;
    return el('div', { class: 'replies' },
      ...post.responses.map((r) => el('div', { class: 'reply' },
        avatar(r.authorName, 'tiny'),
        el('div', { class: 'reply-body' },
          el('div', { class: 'reply-meta' },
            el('strong', { text: r.authorName }),
            el('span', { text: ` · ${timeAgo(r.createdAt)}` })),
          el('div', { class: 'reply-text', text: r.text })))));
  }

  // The server fills in a title from the first line when none is given. Only show a title that
  // adds something, so the first line isn't repeated inside the bubble.
  function shownTitle(post) {
    const firstLine = String(post.body || '').split('\n')[0].trim();
    const t = String(post.title || '').trim();
    return t && t !== firstLine && t !== (firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine) ? t : '';
  }

  function renderPost(post) {
    const mine = !!post.isMine;
    const isPrivate = post.channel === 'organisers';
    const tags = el('div', { class: 'tags' },
      el('span', { class: 'tag type', text: post.templateLabel }),
      isPrivate ? el('span', { class: 'tag private', text: 'Organisers only' }) : null,
      post.author.role === 'organiser' ? el('span', { class: 'tag org', text: 'Organiser' }) : null,
    );

    const bubble = el('div', { class: 'bubble' },
      shownTitle(post) ? el('div', { class: 'bubble-title', text: shownTitle(post) }) : null,
      el('div', { class: 'bubble-text', text: post.body }),
      post.location ? el('div', { class: 'where', text: `📍 ${post.location}` }) : null,
      el('div', { class: 'bubble-foot' },
        tags,
        el('span', { class: 'timer', 'data-expires': post.expiresAt, text: formatLeft(post.secondsLeft) })),
    );

    const body = el('div', { class: 'msg-body' },
      el('div', { class: 'msg-meta' },
        el('strong', { text: mine ? 'You' : post.author.name }),
        el('span', { text: `· ${timeAgo(post.createdAt)}` })),
      bubble,
      renderReplies(post),
    );

    if (post.canReply) {
      const input = el('input', { maxlength: '2000', placeholder: post.replyLabel || 'Reply', 'aria-label': 'Reply' });
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
      body.append(form);
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
      body.append(el('div', { class: 'msg-actions' }, btn));
    }

    return el('article', { class: `msg${mine ? ' mine' : ''}${isPrivate ? ' private' : ''}`, 'data-id': post.id },
      avatar(mine ? state.user.name : post.author.name),
      body);
  }

  function renderFeed() {
    renderRooms();
    const feed = $('#feed');
    const wasNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 140;
    feed.innerHTML = '';

    const posts = state.posts
      .filter((p) => !state.filter || p.template === state.filter)
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);

    let lastDay = '';
    for (const p of posts) {
      const key = DAY_KEY.format(p.createdAt);
      if (key !== lastDay) {
        lastDay = key;
        feed.append(el('div', { class: 'day', text: dayLabel(p.createdAt) }));
      }
      feed.append(renderPost(p));
    }

    const empty = $('#feed-empty');
    empty.classList.toggle('hidden', posts.length > 0);
    if (!state.zone) {
      $('#feed-empty-title').textContent = 'Enter a zone to see its messages';
      $('#feed-empty-text').textContent = 'Turn on location in the left panel, or try a demo scenario.';
    } else {
      $('#feed-empty-title').textContent = 'Nothing here yet';
      $('#feed-empty-text').textContent = `Start the conversation in ${state.zone.zoneName}.`;
    }

    if (state.forceScroll || wasNearBottom) {
      feed.scrollTop = feed.scrollHeight;
      state.forceScroll = false;
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
    $$('.timer').forEach((node) => {
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
    state.pollTimer = setInterval(() => {
      loadPosts(false);
      loadEvents();
    }, POLL_MS);
  }

  // ---- Demo scenarios -----------------------------------------------------
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
      run: async () => {
        for (const [i, n] of [300, 200, 100, 0].entries()) {
          await demoStep(`Step ${i + 1}/4`, { ...offsetPoint(HALL, n, 0), accuracy: 10 });
          if (i < 3) await sleep(5000);
        }
      },
    },
    walkOut: {
      run: async () => {
        for (const [i, n] of [0, 100, 200, 300].entries()) {
          await demoStep(`Step ${i + 1}/4`, { ...offsetPoint(HALL, n, 0), accuracy: 10 });
          if (i < 3) await sleep(5000);
        }
      },
    },
    poorGps: {
      run: async () => {
        await demoStep('Inaccurate fix', { ...HALL, accuracy: 300 });
      },
    },
    spoof: {
      run: async () => {
        await demoStep('Genuine fix', { ...HALL, accuracy: 10 });
        await sleep(1000);
        await demoStep('Jump to 5 km away', { ...offsetPoint(HALL, 5000, 0), accuracy: 10 });
      },
    },
    edge: {
      run: async () => {
        await demoStep('Edge fix', { ...offsetPoint(HALL, 160, 0), accuracy: 40 });
      },
    },
    denied: {
      run: async () => {
        stopLocation();
        localStorage.removeItem(LOCATION_KEY);
        state.loc.permission = 'denied';
        try { await api('POST', '/api/location/forget'); } catch (_) { /* ignore */ }
        state.zone = null;
        setLocationMessage('Location denied. Zone messages are hidden; the rest of the app still works.', 'warn');
        zoneChanged();
        $('#demo-status').textContent = 'Location denied: no zone access';
      },
    },
  };

  let demoBusy = false;
  $$('[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const scenario = SCENARIOS[btn.dataset.scenario];
      if (!scenario || demoBusy) return;
      demoBusy = true;
      $$('[data-scenario]').forEach((b) => { b.disabled = true; });
      try {
        await scenario.run();
      } catch (err) {
        $('#demo-status').textContent = `Scenario failed: ${err.message}`;
      } finally {
        demoBusy = false;
        $$('[data-scenario]').forEach((b) => { b.disabled = false; });
      }
    });
  });

  // ---- Boot ---------------------------------------------------------------

  async function boot() {
    if (!state.token) return showLogin();
    try {
      setLoginStatus('Checking your session…');
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
      setLoginStatus('');
      $('#login-error').textContent = 'Could not load your session: ' + err.message;
      return;
    }
    setLoginStatus('');
    showApp();
    renderChips();
    selectTemplate(state.composer.template);
    await loadZones();
    if (state.loc.permission === 'granted') {
      // Resume where the user left off: start live tracking again.
      startLocation();
    }
    renderLocation();
    refreshComposerAccess();
    await Promise.all([loadPosts(true), loadEvents()]);
    updateMap();
    startPolling();
  }

  syncRoleFields();
  boot();
})();
