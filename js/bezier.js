// Bezier panel: draggable control points, a curve drawn through them, and a
// live visualization of De Casteljau's construction — the recursive linear
// interpolation that actually produces the point on the curve at a given t.
(() => {
  const CSS_W = 720;
  const CSS_H = 460;
  const POINT_R = 8;

  const COLOR_HULL = '#5B6E79';
  const COLOR_CURVE = '#E0972E';
  const COLOR_CONSTRUCT = '#ffd166';
  const COLOR_POINT_T = '#fb4c9d';
  const COLOR_CONTROL = '#7beaf1';
  const COLOR_LABEL = '#93A3AC';
  const COLOR_STROKE = '#12171B';

  const canvas = document.getElementById('bezier-canvas');
  const ctx = canvas.getContext('2d');
  const addBtn = document.getElementById('add-point-btn');
  const tSlider = document.getElementById('t-slider');
  const tValueEl = document.getElementById('t-value');
  const pointCountEl = document.getElementById('point-count');

  // Canvas backing store is scaled by devicePixelRatio for crisp lines, but
  // every coordinate in this file (points, mouse hit-testing) stays in the
  // 720x460 CSS-pixel space set up here.
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CSS_W * dpr;
    canvas.height = CSS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();

  // Starting control points sketch a simple S-curve so the page shows a
  // real curve immediately instead of an empty panel.
  let points = [
    { x: 90, y: 370 },
    { x: 230, y: 70 },
    { x: 490, y: 390 },
    { x: 630, y: 90 },
  ];

  let dragIndex = -1;

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  // Every level of De Casteljau's construction at parameter t: level 0 is
  // the control points themselves, each following level is the linear
  // interpolation of consecutive points from the level before, and the
  // last level is a single point — the point on the curve at t.
  function deCasteljauLevels(pts, t) {
    const levels = [pts];
    let current = pts;
    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length - 1; i++) next.push(lerp(current[i], current[i + 1], t));
      levels.push(next);
      current = next;
    }
    return levels;
  }

  function curvePoints(pts, steps) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const levels = deCasteljauLevels(pts, i / steps);
      out.push(levels[levels.length - 1][0]);
    }
    return out;
  }

  function toCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const src = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
    return {
      x: (src.clientX - rect.left) * (CSS_W / rect.width),
      y: (src.clientY - rect.top) * (CSS_H / rect.height),
    };
  }

  function hitTestPoint(pos) {
    for (let i = points.length - 1; i >= 0; i--) {
      const dx = points[i].x - pos.x;
      const dy = points[i].y - pos.y;
      if (dx * dx + dy * dy <= (POINT_R + 4) ** 2) return i;
    }
    return -1;
  }

  function drawHull() {
    ctx.save();
    ctx.strokeStyle = COLOR_HULL;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  function drawCurve() {
    const pts = curvePoints(points, 150);
    ctx.save();
    ctx.strokeStyle = COLOR_CURVE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  // Draws every intermediate level of the construction at the slider's t —
  // the connecting lines fading in amber, small dots at each interpolated
  // point, and a highlighted pink dot at the final point on the curve.
  function drawConstruction(t) {
    const levels = deCasteljauLevels(points, t);
    ctx.save();
    for (let lvl = 1; lvl < levels.length; lvl++) {
      const pts = levels[lvl];
      const isFinal = pts.length === 1;
      ctx.strokeStyle = COLOR_CONSTRUCT;
      ctx.fillStyle = COLOR_CONSTRUCT;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      if (pts.length > 1) {
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
      for (const p of pts) {
        ctx.globalAlpha = isFinal ? 1 : 0.85;
        ctx.fillStyle = isFinal ? COLOR_POINT_T : COLOR_CONSTRUCT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isFinal ? 7 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawControlPoints() {
    ctx.save();
    ctx.font = "11.5px 'IBM Plex Mono', monospace";
    points.forEach((p, i) => {
      ctx.fillStyle = COLOR_LABEL;
      ctx.fillText('P' + i, p.x + POINT_R + 3, p.y - POINT_R);

      ctx.beginPath();
      ctx.arc(p.x, p.y, POINT_R, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_CONTROL;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLOR_STROKE;
      ctx.stroke();
    });
    ctx.restore();
  }

  function updateStatus() {
    const t = Number(tSlider.value);
    tValueEl.textContent = 't = ' + t.toFixed(3);
    pointCountEl.textContent = points.length + (points.length === 1 ? ' point' : ' points');
  }

  function render() {
    ctx.clearRect(0, 0, CSS_W, CSS_H);
    if (points.length >= 2) {
      drawHull();
      drawCurve();
      drawConstruction(Number(tSlider.value));
    }
    drawControlPoints();
    updateStatus();
  }

  addBtn.addEventListener('click', () => {
    const margin = POINT_R + 24;
    points.push({
      x: margin + Math.random() * (CSS_W - margin * 2),
      y: margin + Math.random() * (CSS_H - margin * 2),
    });
    render();
  });

  tSlider.addEventListener('input', render);

  function startDrag(evt) {
    const idx = hitTestPoint(toCanvasCoords(evt));
    if (idx !== -1) {
      dragIndex = idx;
      canvas.style.cursor = 'grabbing';
      evt.preventDefault();
    }
  }
  function moveDrag(evt) {
    if (dragIndex === -1) return;
    const pos = toCanvasCoords(evt);
    points[dragIndex] = {
      x: Math.min(Math.max(pos.x, POINT_R), CSS_W - POINT_R),
      y: Math.min(Math.max(pos.y, POINT_R), CSS_H - POINT_R),
    };
    render();
    evt.preventDefault();
  }
  function endDrag() {
    dragIndex = -1;
    canvas.style.cursor = 'grab';
  }

  canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('touchend', endDrag);

  canvas.addEventListener('dblclick', (evt) => {
    const idx = hitTestPoint(toCanvasCoords(evt));
    if (idx !== -1) {
      points.splice(idx, 1);
      render();
    }
  });

  render();
})();
