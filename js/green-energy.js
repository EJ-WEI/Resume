// Green energy panel: a one-day load curve (96 × 15-minute points) drawn on a
// canvas over time-of-use (TOU) tariff bands, with every point draggable.
//
// The curve is a load *shape*. Which hours count as peak / half-peak /
// off-peak is a property of the day type, not of the curve, so switching the
// day type only re-slices the background and re-buckets the statistics; the
// points themselves never move. The band boundaries mirror Flux's
// CurveLibrary/TimeOfUse.ts (Taipower high-voltage three-tier tariff), and
// the TOU colours are Flux's TOU_ORDER so a bucket reads the same here as it
// does in the app.
(() => {
  const canvas = document.getElementById('green-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('curve-status');
  const resetBtn = document.getElementById('reset-curve-btn');
  const statsTable = document.getElementById('tou-stats');
  const dayTypeInputs = Array.from(document.querySelectorAll('input[name="day-type"]'));

  const CSS_W = 760;
  const CSS_H = 400;
  // Plot area inside the canvas: room for the Y labels on the left and the
  // hour labels along the bottom.
  const PAD = { left: 52, right: 16, top: 30, bottom: 44 };
  const PLOT_W = CSS_W - PAD.left - PAD.right;
  const PLOT_H = CSS_H - PAD.top - PAD.bottom;

  const SLOTS = 96;                 // 15-minute intervals in a day
  const MINUTES_PER_DAY = 1440;
  const CONTRACT_KW = 100;          // 經常契約容量 - every curve is a shape scaled to this
  const DOT_R = 3;
  const DOT_R_ACTIVE = 5.5;
  const HIT_X = 7;                  // px either side of a dot that still counts as that dot
  const HIT_Y = 14;

  const style = getComputedStyle(document.documentElement);
  const COLOR_CURVE = style.getPropertyValue('--charge').trim() || '#E0972E';
  const COLOR_INK = style.getPropertyValue('--ink').trim() || '#E7ECEE';
  const COLOR_INK_SOFT = style.getPropertyValue('--ink-soft').trim() || '#93A3AC';
  const COLOR_LINE = style.getPropertyValue('--line').trim() || '#33414A';
  const COLOR_LINE_SOFT = style.getPropertyValue('--line-soft').trim() || '#222C33';
  const COLOR_PAPER = style.getPropertyValue('--paper').trim() || '#12171B';
  const COLOR_CONTRACT = '#f46461';

  // TOU buckets, in the order Flux lists them. `label` is an i18n key so the
  // canvas text follows the language toggle.
  const TOU = {
    peak:             { color: '#f46461', label: 'green.tou.peak' },
    halfPeak:         { color: '#ffb27a', label: 'green.tou.halfPeak' },
    saturdayHalfPeak: { color: '#7ec8e3', label: 'green.tou.saturdayHalfPeak' },
    offPeak:          { color: '#6ea772', label: 'green.tou.offPeak' },
  };
  const TOU_ORDER = ['peak', 'halfPeak', 'saturdayHalfPeak', 'offPeak'];

  // Day-type sections. `boundaries` are slot indexes (slot i covers minutes
  // i×15 → (i+1)×15) and every boundary lands on a whole hour, so an hour is
  // never split across two bands. Source: 整理電價表 p.13, 高壓三段式.
  //   weekday : summer 00-09 off / 09-16 half / 16-22 peak / 22-24 half
  //             non-summer 00-06 off / 06-11 half / 11-14 off / 14-24 half
  //   saturday: summer 00-09 off / 09-24 sat-half
  //             non-summer 00-06 off / 06-11 sat-half / 11-14 off / 14-24 sat-half
  //   off-peak day (Sunday & holidays): all off-peak
  const SECTIONS = {
    summerWeekday:     { boundaries: [0, 36, 64, 88, 96], periods: ['offPeak', 'halfPeak', 'peak', 'halfPeak'] },
    nonSummerWeekday:  { boundaries: [0, 24, 44, 56, 96], periods: ['offPeak', 'halfPeak', 'offPeak', 'halfPeak'] },
    summerSaturday:    { boundaries: [0, 36, 96],         periods: ['offPeak', 'saturdayHalfPeak'] },
    nonSummerSaturday: { boundaries: [0, 24, 44, 56, 96], periods: ['offPeak', 'saturdayHalfPeak', 'offPeak', 'saturdayHalfPeak'] },
    offPeakDay:        { boundaries: [0, 96],             periods: ['offPeak'] },
  };

  function touAt(dayType, index) {
    const { boundaries, periods } = SECTIONS[dayType];
    for (let s = 0; s < periods.length; s++) {
      if (index >= boundaries[s] && index < boundaries[s + 1]) return periods[s];
    }
    return periods[periods.length - 1];
  }

  // Canvas backing store is scaled by devicePixelRatio for crisp lines; all
  // coordinates below stay in the 760x400 CSS-pixel space.
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CSS_W * dpr;
    canvas.height = CSS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();

  // ---- Curve data -------------------------------------------------------

  const smoothstep = (x, a, b) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const bump = (x, centre, width) => Math.exp(-(((x - centre) / width) ** 2));

  // A plausible daytime-factory profile: ~30 kW overnight base, ramp up from
  // 07:00, a lunch dip, and a tail-off through the evening. Peaks in the
  // 80s so it sits under the 100 kW contract line with room to drag above.
  function defaultCurve() {
    const kw = [];
    for (let i = 0; i < SLOTS; i++) {
      const h = (i + 1) * 0.25; // end of the interval, in hours
      let v = 30;
      v += 55 * smoothstep(h, 6.5, 8.5) * (1 - smoothstep(h, 17, 19.5));
      v -= 18 * bump(h, 12.25, 0.6);
      v += 12 * smoothstep(h, 18.5, 19.5) * (1 - smoothstep(h, 21.5, 23));
      kw.push(Math.round(v));
    }
    return kw;
  }

  let points = defaultCurve();       // kW per slot, index 0 = 00:00-00:15
  let dayType = 'summerWeekday';
  let hoverIndex = -1;
  let dragIndex = -1;
  let dragAxis = null;               // Y axis frozen for the duration of a drag

  const pad2 = (n) => String(n).padStart(2, '0');
  // Interval `i` ends at minute (i+1)×15 - that is the timestamp shown for it.
  function timeLabel(i) {
    const m = (i + 1) * 15;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  // ---- Axis -------------------------------------------------------------

  // Headroom above whichever is taller, the curve or the contract line, with
  // a 1/2/5-style step so ~6 round gridlines fit at any scale. Same rule as
  // Flux's CurveChart.yAxisFor: 100 kW contract / 85 kW curve → 0-120 by 20.
  function yAxisFor(kwValues) {
    const top = Math.max(1, CONTRACT_KW, ...kwValues) * 1.15;
    const rawStep = top / 6;
    const pow = 10 ** Math.floor(Math.log10(rawStep));
    const f = rawStep / pow;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
    const yMax = Math.ceil(top / step) * step;
    const ticks = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v);
    return { yMax, ticks };
  }

  const xOfMinute = (m) => PAD.left + (m / MINUTES_PER_DAY) * PLOT_W;
  const xOfSlot = (i) => xOfMinute((i + 1) * 15);
  const yOfKw = (kw, axis) => PAD.top + PLOT_H - (kw / axis.yMax) * PLOT_H;
  const kwOfY = (y, axis) => ((PAD.top + PLOT_H - y) / PLOT_H) * axis.yMax;

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  // ---- Drawing ----------------------------------------------------------

  function drawBands() {
    const { boundaries, periods } = SECTIONS[dayType];
    ctx.save();
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let s = 0; s < periods.length; s++) {
      const x0 = xOfMinute(boundaries[s] * 15);
      const x1 = xOfMinute(boundaries[s + 1] * 15);
      const tou = TOU[periods[s]];
      ctx.fillStyle = hexToRgba(tou.color, 0.16);
      ctx.fillRect(x0, PAD.top, x1 - x0, PLOT_H);
      // Boundary hairline between two bands.
      if (s > 0) {
        ctx.strokeStyle = hexToRgba(tou.color, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, PAD.top);
        ctx.lineTo(x0 + 0.5, PAD.top + PLOT_H);
        ctx.stroke();
      }
      // Band name along the top, only where there is room for it.
      const label = I18N.t(tou.label);
      if (ctx.measureText(label).width + 8 < x1 - x0) {
        ctx.fillStyle = hexToRgba(tou.color, 0.9);
        ctx.fillText(label, (x0 + x1) / 2, PAD.top + 6);
      }
    }
    ctx.restore();
  }

  function drawGridAndAxes(axis) {
    ctx.save();
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.lineWidth = 1;

    // Horizontal gridlines + Y labels.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of axis.ticks) {
      const y = Math.round(yOfKw(v, axis)) + 0.5;
      ctx.strokeStyle = COLOR_LINE_SOFT;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + PLOT_W, y);
      ctx.stroke();
      ctx.fillStyle = COLOR_INK_SOFT;
      ctx.fillText(String(v), PAD.left - 8, y);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('(kW)', PAD.left - 40, PAD.top - 8);

    // X axis line, hourly tick marks, labels every three hours.
    const yAxisLine = PAD.top + PLOT_H + 0.5;
    ctx.strokeStyle = COLOR_LINE;
    ctx.beginPath();
    ctx.moveTo(PAD.left, yAxisLine);
    ctx.lineTo(PAD.left + PLOT_W, yAxisLine);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let h = 0; h <= 24; h++) {
      const x = Math.round(xOfMinute(h * 60)) + 0.5;
      const major = h % 3 === 0;
      ctx.beginPath();
      ctx.moveTo(x, yAxisLine);
      ctx.lineTo(x, yAxisLine + (major ? 6 : 3));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = COLOR_INK_SOFT;
        ctx.fillText(pad2(h) + ':00', x, yAxisLine + 10);
      }
    }
    ctx.restore();
  }

  function drawContractLine(axis) {
    const y = Math.round(yOfKw(CONTRACT_KW, axis)) + 0.5;
    ctx.save();
    ctx.strokeStyle = COLOR_CONTRACT;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + PLOT_W, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '500 10.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = COLOR_CONTRACT;
    ctx.fillText(CONTRACT_KW + ' kW', PAD.left + PLOT_W - 4, y - 3);
    ctx.restore();
  }

  function drawCurve(axis) {
    ctx.save();
    // Area under the curve.
    ctx.beginPath();
    ctx.moveTo(xOfSlot(0), PAD.top + PLOT_H);
    for (let i = 0; i < SLOTS; i++) ctx.lineTo(xOfSlot(i), yOfKw(points[i], axis));
    ctx.lineTo(xOfSlot(SLOTS - 1), PAD.top + PLOT_H);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(COLOR_CURVE, 0.14);
    ctx.fill();

    // The line itself.
    ctx.beginPath();
    for (let i = 0; i < SLOTS; i++) {
      const x = xOfSlot(i);
      const y = yOfKw(points[i], axis);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COLOR_CURVE;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots - drag handles. The active one (hovered or being dragged) is bigger.
    const active = dragIndex !== -1 ? dragIndex : hoverIndex;
    for (let i = 0; i < SLOTS; i++) {
      const r = i === active ? DOT_R_ACTIVE : DOT_R;
      ctx.beginPath();
      ctx.arc(xOfSlot(i), yOfKw(points[i], axis), r, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_CURVE;
      ctx.fill();
      ctx.strokeStyle = COLOR_PAPER;
      ctx.lineWidth = i === active ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTooltip(axis) {
    const i = dragIndex !== -1 ? dragIndex : hoverIndex;
    if (i === -1) return;
    const x = xOfSlot(i);
    const y = yOfKw(points[i], axis);
    const tou = TOU[touAt(dayType, i)];

    ctx.save();
    // Hairline down to the axis.
    ctx.strokeStyle = hexToRgba(COLOR_INK_SOFT, 0.6);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, PAD.top);
    ctx.lineTo(Math.round(x) + 0.5, PAD.top + PLOT_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label box: time on the first line, kW + bucket on the second.
    ctx.font = '11px "IBM Plex Mono", monospace';
    const line1 = timeLabel(i);
    const line2 = points[i] + ' kW · ' + I18N.t(tou.label);
    const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width + 14) + 20;
    const h = 40;
    let bx = x + 12;
    if (bx + w > PAD.left + PLOT_W) bx = x - 12 - w;
    let by = y - h - 10;
    if (by < PAD.top) by = y + 12;

    ctx.fillStyle = hexToRgba(COLOR_PAPER, 0.94);
    ctx.strokeStyle = COLOR_LINE;
    ctx.beginPath();
    ctx.rect(Math.round(bx) + 0.5, Math.round(by) + 0.5, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR_INK_SOFT;
    ctx.fillText(line1, bx + 10, by + 7);
    ctx.fillStyle = tou.color;
    ctx.fillRect(bx + 10, by + 24, 8, 8);
    ctx.fillStyle = COLOR_INK;
    ctx.fillText(line2, bx + 24, by + 22);
    ctx.restore();
  }

  function render() {
    const axis = dragAxis || yAxisFor(points);
    ctx.clearRect(0, 0, CSS_W, CSS_H);
    drawBands();
    drawGridAndAxes(axis);
    drawContractLine(axis);
    drawCurve(axis);
    drawTooltip(axis);
    canvas.style.cursor = dragIndex !== -1 || hoverIndex !== -1 ? 'ns-resize' : 'default';
  }

  // ---- Statistics -------------------------------------------------------

  // Bucket the 96 slots by the current day type: hours covered, energy
  // (kW × ¼ h per slot) and the highest single interval.
  function updateStats() {
    const buckets = {};
    for (const key of TOU_ORDER) buckets[key] = { slots: 0, kwh: 0, max: 0 };
    let totalKwh = 0;
    let dayMax = 0;
    for (let i = 0; i < SLOTS; i++) {
      const b = buckets[touAt(dayType, i)];
      const kw = points[i];
      b.slots += 1;
      b.kwh += kw * 0.25;
      if (kw > b.max) b.max = kw;
      totalKwh += kw * 0.25;
      if (kw > dayMax) dayMax = kw;
    }

    for (const row of statsTable.querySelectorAll('tbody tr')) {
      const b = buckets[row.dataset.tou];
      const empty = b.slots === 0;
      row.classList.toggle('empty', empty);
      row.querySelector('[data-cell="hours"]').textContent = empty ? '—' : String(b.slots / 4);
      row.querySelector('[data-cell="kwh"]').textContent = empty ? '—' : b.kwh.toFixed(1);
      row.querySelector('[data-cell="max"]').textContent = empty ? '—' : String(b.max);
    }

    I18N.bind(statusEl, 'green.status', {
      kwh: totalKwh.toFixed(1),
      max: dayMax,
      over: dayMax > CONTRACT_KW ? I18N.t('green.overContract') : '',
    });
  }

  function refresh() {
    render();
    updateStats();
  }

  // ---- Interaction ------------------------------------------------------

  function toCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (CSS_W / rect.width),
      y: (evt.clientY - rect.top) * (CSS_H / rect.height),
    };
  }

  // Nearest slot by X, or -1 when the pointer is not close to any dot.
  function slotNear(pos, axis, checkY) {
    const minute = ((pos.x - PAD.left) / PLOT_W) * MINUTES_PER_DAY;
    const i = Math.round(minute / 15) - 1;
    if (i < 0 || i >= SLOTS) return -1;
    if (Math.abs(xOfSlot(i) - pos.x) > HIT_X) return -1;
    if (checkY && Math.abs(yOfKw(points[i], axis) - pos.y) > HIT_Y) return -1;
    return i;
  }

  function applyDrag(pos) {
    const kw = Math.round(kwOfY(pos.y, dragAxis));
    points[dragIndex] = Math.min(dragAxis.yMax, Math.max(0, kw));
    refresh();
  }

  canvas.addEventListener('pointerdown', (evt) => {
    const axis = yAxisFor(points);
    const idx = slotNear(toCanvasCoords(evt), axis, true);
    if (idx === -1) return;
    dragIndex = idx;
    // Freeze the axis so the point does not jump under the cursor when the
    // scale would otherwise grow mid-drag.
    dragAxis = axis;
    canvas.setPointerCapture(evt.pointerId);
    applyDrag(toCanvasCoords(evt));
    evt.preventDefault();
  });

  canvas.addEventListener('pointermove', (evt) => {
    const pos = toCanvasCoords(evt);
    if (dragIndex !== -1) {
      applyDrag(pos);
      return;
    }
    const next = slotNear(pos, yAxisFor(points), false);
    if (next !== hoverIndex) {
      hoverIndex = next;
      render();
    }
  });

  function endDrag(evt) {
    if (dragIndex === -1) return;
    try { canvas.releasePointerCapture(evt.pointerId); } catch (_) { /* already released */ }
    dragIndex = -1;
    dragAxis = null;
    refresh();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (dragIndex !== -1 || hoverIndex === -1) return;
    hoverIndex = -1;
    render();
  });

  dayTypeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      dayType = input.value;
      dayTypeInputs.forEach((other) => other.closest('.mode-pill').classList.toggle('active', other === input));
      refresh();
    });
  });

  resetBtn.addEventListener('click', () => {
    points = defaultCurve();
    refresh();
  });

  // Band names and the tooltip are painted on the canvas, so they need a
  // repaint when the language flips (DOM text is handled by i18n.js).
  window.addEventListener('langchange', refresh);

  refresh();
})();
