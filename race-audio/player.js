// Receives each audio feed over WebRTC (WHEP, served by MediaMTX) and mixes them
// through one shared DelayNode so the audio lines up with the viewer's Twitch video.
window.RaceAudio = window.RaceAudio || {};

(function (RA) {
  'use strict';

  const ICE_WAIT_MS = 1500;
  const RETRY_MS = 4000;
  const MAX_DELAY = 20;
  const DELAY_DEADBAND = 0.25; // ignore small latency wobble; each delay change bends pitch briefly

  function waitForIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ICE_WAIT_MS);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  class Track {
    constructor(mixer, id) {
      this.mixer = mixer;
      this.id = id;
      this.gain = mixer.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(mixer.bus);
      this.pc = null;
      this.el = null;
      this.source = null;
      this.wanted = false;
      this.status = 'off';
      this.retryTimer = null;
    }

    setVolume(v) {
      this.gain.gain.setTargetAtTime(v, this.mixer.ctx.currentTime, 0.05);
      if (v > 0 && !this.wanted) this.start();
      else if (v === 0 && this.wanted) this.stop();
    }

    start() {
      this.wanted = true;
      this.connect();
    }

    stop() {
      this.wanted = false;
      clearTimeout(this.retryTimer);
      this.teardown();
      this.setStatus('off');
    }

    setStatus(status) {
      this.status = status;
      this.mixer.emit();
    }

    teardown() {
      if (this.source) { this.source.disconnect(); this.source = null; }
      if (this.el) { this.el.srcObject = null; this.el = null; }
      if (this.pc) { this.pc.close(); this.pc = null; }
    }

    retry() {
      this.teardown();
      clearTimeout(this.retryTimer);
      if (this.wanted) this.retryTimer = setTimeout(() => this.connect(), RETRY_MS);
    }

    async connect() {
      clearTimeout(this.retryTimer);
      this.teardown();
      if (!this.wanted) return;
      const base = this.mixer.server;
      if (!base) { this.setStatus('no server'); return; }

      this.setStatus('connecting');
      const pc = new RTCPeerConnection();
      this.pc = pc;
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (ev) => {
        if (pc !== this.pc) return;
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        // Chrome only feeds a remote WebRTC stream into Web Audio while a media element also plays it.
        const el = new Audio();
        el.muted = true;
        el.srcObject = stream;
        el.play().catch(() => {});
        this.el = el;
        this.source = this.mixer.ctx.createMediaStreamSource(stream);
        this.source.connect(this.gain);
      };

      pc.onconnectionstatechange = () => {
        if (pc !== this.pc) return;
        if (pc.connectionState === 'connected') this.setStatus('live');
        else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          this.setStatus('reconnecting');
          this.retry();
        }
      };

      try {
        await pc.setLocalDescription(await pc.createOffer());
        await waitForIce(pc);
        if (pc !== this.pc) return;
        const res = await fetch(`${base}/${this.id}/whep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp,
        });
        if (pc !== this.pc) return;
        if (!res.ok) {
          this.setStatus(res.status === 404 ? 'not live yet' : `error ${res.status}`);
          this.retry();
          return;
        }
        await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
      } catch (e) {
        if (pc !== this.pc) return;
        this.setStatus('server offline');
        this.retry();
      }
    }
  }

  class Mixer {
    constructor(trackIds) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'playback' });
      this.bus = this.ctx.createGain();
      this.delay = this.ctx.createDelay(MAX_DELAY);
      this.out = this.ctx.createGain();
      this.bus.connect(this.delay);
      this.delay.connect(this.out);
      this.out.connect(this.ctx.destination);
      this.server = '';
      this.delaySeconds = null;
      this.listeners = [];
      this.tracks = new Map(trackIds.map((id) => [id, new Track(this, id)]));
    }

    resume() {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    setServer(url) {
      url = String(url || '').replace(/\/+$/, '');
      if (url === this.server) return;
      this.server = url;
      for (const t of this.tracks.values()) if (t.wanted) t.connect();
    }

    setVolume(id, v) {
      const t = this.tracks.get(id);
      if (t) t.setVolume(v);
    }

    status(id) {
      const t = this.tracks.get(id);
      return t ? t.status : 'off';
    }

    // force=true for deliberate viewer nudges; latency-driven updates respect the deadband.
    setDelay(seconds, force) {
      const s = Math.min(MAX_DELAY - 0.5, Math.max(0, seconds));
      if (this.delaySeconds === null) {
        this.delay.delayTime.value = s;
      } else {
        if (!force && Math.abs(s - this.delaySeconds) < DELAY_DEADBAND) return;
        this.delay.delayTime.setTargetAtTime(s, this.ctx.currentTime, 0.2);
      }
      this.delaySeconds = s;
    }

    setMuted(muted) {
      this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }

    onChange(fn) {
      this.listeners.push(fn);
    }

    emit() {
      this.listeners.forEach((fn) => fn());
    }
  }

  RA.Mixer = Mixer;
})(window.RaceAudio);
