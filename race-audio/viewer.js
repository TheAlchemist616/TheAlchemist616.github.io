// Overlay: click a runner's feed to hear them, or open the mixer to blend runners + commentary.
(function () {
  'use strict';

  const RA = window.RaceAudio;
  const ext = window.Twitch.ext;
  const TRACK_IDS = ['commentary'].concat(RA.RUNNER_IDS);
  const FALLBACK_TWITCH_LATENCY = 4;
  const NUDGE_STEP = 0.1;
  const NUDGE_KEY = 'raceAudio.nudge';

  const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z"/></svg>';
  const ICON_HEADPHONES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h3v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/></svg>';

  const $ = (id) => document.getElementById(id);
  const ui = { app: $('app'), zones: $('zones'), toggle: $('mixer-toggle'), panel: $('panel'), hint: $('hint') };

  let config = RA.normalizeConfig(null);
  const volumes = {};
  TRACK_IDS.forEach((id) => { volumes[id] = 0; });
  let commentaryLevel = 1;
  let nudge = readNudge();
  let twitchLatency = null;
  const player = { muted: false, paused: false, controls: true };
  let mixer = null;
  let panelOpen = false;

  function readNudge() {
    try {
      const v = parseFloat(localStorage.getItem(NUDGE_KEY));
      return Number.isFinite(v) ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveNudge() {
    try { localStorage.setItem(NUDGE_KEY, String(nudge)); } catch (e) { /* storage blocked */ }
  }

  function trackName(id) {
    if (id === 'commentary') return 'Commentary';
    const r = config.runners.find((x) => x.id === id);
    return r ? r.name : id;
  }

  function visibleTracks() {
    return ['commentary'].concat(config.runners.map((r) => r.id));
  }

  function isActive() {
    return TRACK_IDS.some((id) => volumes[id] > 0);
  }

  // ---- audio ----

  function ensureMixer() {
    if (!mixer) {
      mixer = new RA.Mixer(TRACK_IDS);
      mixer.setServer(config.server);
      mixer.onChange(syncUI);
      applyDelay(true);
      applyPlayback();
    }
    mixer.resume();
  }

  function setVolume(id, v) {
    volumes[id] = v;
    if (v > 0) ensureMixer();
    if (mixer) mixer.setVolume(id, v);
  }

  function stopAll() {
    TRACK_IDS.forEach((id) => setVolume(id, 0));
  }

  // Click a runner: solo them (with commentary). Click the soloed runner again: back to stream audio.
  function toggleRunner(id) {
    const soloed = volumes[id] > 0 && config.runners.every((r) => r.id === id || volumes[r.id] === 0);
    if (soloed) {
      stopAll();
    } else {
      config.runners.forEach((r) => setVolume(r.id, r.id === id ? 1 : 0));
      setVolume('commentary', commentaryLevel);
    }
    syncUI();
  }

  function applyDelay(force) {
    if (!mixer) return;
    const base = twitchLatency === null ? FALLBACK_TWITCH_LATENCY : twitchLatency;
    mixer.setDelay(base - config.feedLatency + nudge, force);
  }

  function applyPlayback() {
    if (mixer) mixer.setMuted(player.paused);
  }

  function changeNudge(steps) {
    nudge = steps === 0 ? 0 : Math.round((nudge + steps * NUDGE_STEP) * 10) / 10;
    saveNudge();
    applyDelay(true);
    syncUI();
  }

  // ---- rendering ----

  function make(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function renderZones() {
    ui.zones.textContent = '';
    config.runners.forEach((r) => {
      const [x, y, w, h] = r.rect;
      const zone = make('div', 'zone');
      Object.assign(zone.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
      const chip = make('button', 'chip', '<span class="icon"></span><span class="label"></span>');
      chip.type = 'button';
      chip.dataset.id = r.id;
      chip.querySelector('.label').textContent = r.name;
      chip.addEventListener('click', () => toggleRunner(r.id));
      zone.appendChild(chip);
      ui.zones.appendChild(zone);
    });
  }

  function renderPanel() {
    const p = ui.panel;
    p.textContent = '';

    const head = make('div', 'panel-head', '<strong>Who do you want to hear?</strong>');
    const close = make('button', 'icon-btn', '&times;');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close mixer');
    close.addEventListener('click', () => setPanel(false));
    head.appendChild(close);
    p.appendChild(head);

    visibleTracks().forEach((id) => {
      const row = make('div', 'row',
        '<div class="row-top"><span class="dot"></span><span class="name"></span><span class="pct"></span></div>' +
        '<input type="range" min="0" max="100" step="1">');
      row.dataset.id = id;
      row.querySelector('.name').textContent = trackName(id);
      const range = row.querySelector('input');
      range.setAttribute('aria-label', `${trackName(id)} volume`);
      range.addEventListener('input', () => {
        const v = range.valueAsNumber / 100;
        if (id === 'commentary') commentaryLevel = v;
        setVolume(id, v);
        syncUI();
      });
      p.appendChild(row);
    });

    const sync = make('div', 'sync',
      '<span class="sync-label">Sync</span>' +
      '<button type="button" class="btn" data-step="-1" aria-label="Play audio earlier">&minus;</button>' +
      '<span class="sync-value"></span>' +
      '<button type="button" class="btn" data-step="1" aria-label="Play audio later">+</button>' +
      '<button type="button" class="btn" data-step="0">Reset</button>');
    sync.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => changeNudge(Number(b.dataset.step)));
    });
    p.appendChild(sync);
    p.appendChild(make('p', 'note', 'Hear it before you see it? Press +. After? Press &minus;.'));

    const back = make('button', 'btn wide', 'Back to stream audio');
    back.type = 'button';
    back.addEventListener('click', () => { stopAll(); syncUI(); });
    p.appendChild(back);
  }

  function statusClass(status) {
    if (status === 'live') return 'live';
    if (status === 'off') return 'off';
    if (status === 'connecting' || status === 'reconnecting' || status === 'not live yet') return 'pending';
    return 'error';
  }

  function syncUI() {
    ui.zones.querySelectorAll('.chip').forEach((chip) => {
      const id = chip.dataset.id;
      const on = volumes[id] > 0;
      chip.classList.toggle('on', on);
      chip.setAttribute('aria-pressed', String(on));
      chip.title = on ? `Listening to ${trackName(id)}. Click to go back to stream audio.` : `Listen to ${trackName(id)}`;
      chip.querySelector('.icon').innerHTML = on ? ICON_ON : ICON_OFF;
    });

    ui.panel.querySelectorAll('.row').forEach((row) => {
      const id = row.dataset.id;
      const v = volumes[id];
      const range = row.querySelector('input');
      if (document.activeElement !== range) range.value = String(Math.round(v * 100));
      const status = v > 0 && mixer ? mixer.status(id) : 'off';
      const dot = row.querySelector('.dot');
      dot.className = `dot ${statusClass(status)}`;
      dot.title = status;
      row.querySelector('.pct').textContent =
        v === 0 ? 'off' : status === 'live' ? `${Math.round(v * 100)}%` : `${status}…`;
    });

    const value = ui.panel.querySelector('.sync-value');
    if (value) value.textContent = `${nudge > 0 ? '+' : ''}${nudge.toFixed(1)}s`;

    ui.toggle.innerHTML = `${ICON_HEADPHONES}<span class="label">${isActive() ? 'Your mix' : 'Pick audio'}</span>`;
    ui.toggle.classList.toggle('on', isActive());
    ui.toggle.setAttribute('aria-expanded', String(panelOpen));
    ui.panel.hidden = !panelOpen;
    ui.hint.hidden = !(isActive() && !player.muted);
    ui.app.classList.toggle('panel-open', panelOpen);
    ui.app.classList.toggle('controls-hidden', !player.controls && !panelOpen);
    ui.app.hidden = !config.server;
  }

  function setPanel(open) {
    panelOpen = open;
    syncUI();
  }

  function applyConfig(raw) {
    config = RA.normalizeConfig(raw);
    RA.RUNNER_IDS.forEach((id) => {
      if (volumes[id] > 0 && !config.runners.some((r) => r.id === id)) setVolume(id, 0);
    });
    if (mixer) mixer.setServer(config.server);
    renderZones();
    renderPanel();
    applyDelay(true);
    syncUI();
  }

  // ---- Twitch wiring ----

  function readBroadcasterConfig() {
    const seg = ext.configuration.broadcaster;
    let raw = null;
    if (seg && seg.content) {
      try { raw = JSON.parse(seg.content); } catch (e) { raw = null; }
    }
    applyConfig(raw);
  }

  ui.toggle.addEventListener('click', () => setPanel(!panelOpen));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen) setPanel(false); });

  ext.configuration.onChanged(readBroadcasterConfig);

  // Live renames from the Stream Manager arrive here without a reload.
  ext.listen('broadcast', (target, contentType, message) => {
    try {
      const msg = JSON.parse(message);
      if (msg && msg.type === 'config') applyConfig(msg.config);
    } catch (e) { /* not ours */ }
  });

  ext.onContext((ctx) => {
    const latency = Number(ctx.hlsLatencyBroadcaster);
    if (latency > 0) twitchLatency = twitchLatency === null ? latency : twitchLatency * 0.7 + latency * 0.3;
    if ('isMuted' in ctx || 'volume' in ctx) player.muted = !!ctx.isMuted || ctx.volume === 0;
    if ('isPaused' in ctx) player.paused = !!ctx.isPaused;
    player.controls = ctx.arePlayerControlsVisible !== false;
    applyDelay(false);
    applyPlayback();
    syncUI();
  });

  renderZones();
  renderPanel();
  syncUI();
})();
