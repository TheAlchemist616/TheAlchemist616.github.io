// Shared by the viewer overlay and the broadcaster config page.
window.RaceAudio = window.RaceAudio || {};

(function (RA) {
  'use strict';

  RA.RUNNER_IDS = ['r1', 'r2', 'r3', 'r4'];
  RA.CONFIG_VERSION = '1';

  // Rects are [x, y, width, height] in percent of the video frame.
  RA.LAYOUTS = {
    side: { label: 'Side by side', rects: [[0, 0, 50, 100], [50, 0, 50, 100]] },
    row3: { label: 'Three columns', rects: [[0, 0, 33.33, 100], [33.33, 0, 33.34, 100], [66.67, 0, 33.33, 100]] },
    grid: { label: '2 × 2 grid', rects: [[0, 0, 50, 50], [50, 0, 50, 50], [0, 50, 50, 50], [50, 50, 50, 50]] },
    custom: { label: 'Custom', rects: [] },
  };

  function clamp(n, lo, hi, fallback) {
    n = Number(n);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  }

  // Layouts with fewer slots than runners fall back to grid positions for the extras.
  RA.presetRect = function (layout, index) {
    const own = (RA.LAYOUTS[layout] || RA.LAYOUTS.grid).rects[index];
    return (own || RA.LAYOUTS.grid.rects[index]).slice();
  };

  RA.normalizeConfig = function (raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const layout = RA.LAYOUTS[raw.layout] ? raw.layout : 'grid';
    const list = Array.isArray(raw.runners) ? raw.runners : [];
    const count = clamp(list.length || 4, 2, 4, 4);
    const runners = [];
    for (let i = 0; i < count; i++) {
      const r = list[i] || {};
      const preset = RA.presetRect(layout, i);
      const rect = Array.isArray(r.rect) && r.rect.length === 4
        ? r.rect.map((v, k) => clamp(v, 0, 100, preset[k]))
        : preset;
      runners.push({ id: RA.RUNNER_IDS[i], name: String(r.name || `Runner ${i + 1}`).slice(0, 40), rect });
    }
    return {
      server: String(raw.server || '').trim().replace(/\/+$/, ''),
      feedLatency: clamp(raw.feedLatency, 0, 10, 0.8),
      layout,
      runners,
    };
  };
})(window.RaceAudio);
