// A* board setup: grid of clickable cells, mode-driven (start / end / wall / clear).
// Pathfinding itself is not implemented yet — this just manages cell state.
(() => {
  const ROWS = 30;
  const COLS = 30;
  const board = document.getElementById('board');

  let currentMode = 'start';
  let startPos = null;
  let endPos = null;

  const grid = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => handleClick(r, c));
      board.appendChild(cell);
      row.push({ el: cell, type: 'empty' });
    }
    grid.push(row);
  }

  function setType(r, c, type) {
    const entry = grid[r][c];
    entry.type = type;
    entry.el.classList.remove('start', 'end', 'wall');
    if (type !== 'empty') entry.el.classList.add(type);
  }

  function handleClick(r, c) {
    const entry = grid[r][c];

    if (currentMode === 'clear') {
      if (entry.type === 'start') startPos = null;
      if (entry.type === 'end') endPos = null;
      setType(r, c, 'empty');
      return;
    }

    if (currentMode === 'wall') {
      if (entry.type === 'start' || entry.type === 'end') return;
      setType(r, c, entry.type === 'wall' ? 'empty' : 'wall');
      return;
    }

    if (currentMode === 'start') {
      if (entry.type === 'start') return;
      if (startPos) setType(startPos.r, startPos.c, 'empty');
      if (endPos && endPos.r === r && endPos.c === c) endPos = null;
      setType(r, c, 'start');
      startPos = { r, c };
      return;
    }

    if (currentMode === 'end') {
      if (entry.type === 'end') return;
      if (endPos) setType(endPos.r, endPos.c, 'empty');
      if (startPos && startPos.r === r && startPos.c === c) startPos = null;
      setType(r, c, 'end');
      endPos = { r, c };
    }
  }

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      currentMode = radio.value;
      document.querySelectorAll('.mode-pill').forEach((label) => label.classList.remove('active'));
      radio.closest('.mode-pill').classList.add('active');
    });
  });
})();
