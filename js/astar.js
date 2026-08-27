// A* board: grid of clickable cells (start / end / wall / clear), plus an
// animated A* search that visualizes the frontier, the current "best guess"
// cell, and the final path.
(() => {
  const ROWS = 30;
  const COLS = 30;
  const STEP_DELAY = 30;
  const board = document.getElementById('board');
  const runBtn = document.getElementById('run-btn');
  const statusEl = document.getElementById('run-status');

  // The 8 directions a cell can move in (N/S/E/W + 4 diagonals), as [dRow, dCol]
  // offsets. This is what makes the search "8-direction" instead of the more
  // common 4-direction (up/down/left/right only) grid search.
  const DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  let currentMode = 'start';
  let startPos = null;
  let endPos = null;
  let running = false;

  // `grid` is the app's own model of the board, parallel to the DOM: one
  // entry per cell holding a reference to its <div> (`el`) plus its current
  // `type` ('empty' | 'start' | 'end' | 'wall'). The A* search reads/writes
  // this instead of touching the DOM directly (except to add/remove CSS
  // classes for highlighting), and it's addressed as grid[row][col].
  const grid = [];

  // Build the 30x30 board once: one <div class="cell"> per grid square,
  // wired to handleClick so the user can paint start/end/wall cells on it.
  // dataset.row/col aren't read by the app logic (grid[r][c] already knows
  // its own position) — they exist so a cell's coordinates are visible/
  // queryable from the DOM (devtools, tests, CSS attribute selectors).
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

  // Change what a cell *is* (empty/start/end/wall) — this is board editing,
  // separate from the temporary search-progress highlighting below. Swaps
  // the relevant CSS class and clears any leftover search visualization,
  // since editing the board mid-way would make an old frontier/path
  // rendering describe a search that no longer matches the current layout.
  function setType(r, c, type) {
    const entry = grid[r][c];
    entry.type = type;
    entry.el.classList.remove('start', 'end', 'wall');
    if (type !== 'empty') entry.el.classList.add(type);
    clearOverlay();
  }

  // Strip the search-progress classes (frontier/visited/current/path) from
  // every cell, without touching start/end/wall. Called before each new run
  // and whenever the board is edited, so stale highlighting from a previous
  // search never lingers on screen.
  function clearOverlay() {
    for (const row of grid) {
      for (const entry of row) {
        entry.el.classList.remove('frontier', 'visited', 'current', 'path');
      }
    }
  }

  // Update the one-line status message under the Run button (e.g.
  // "Searching…", "Path found — 15 steps."). `warn` switches it to the
  // warning color for problem states like "no path found" or a missing
  // start/end, instead of the normal muted info color.
  function setStatus(text, warn) {
    statusEl.textContent = text;
    statusEl.classList.toggle('warn', !!warn);
  }

  // Click handler for a single board cell. What it does depends on
  // `currentMode`, which mirrors the selected radio button in the toolbar.
  // Ignored entirely while a search animation is running, since the board
  // (start/end/walls) must stay fixed for the in-progress search to still
  // make sense — setInteractive() also disables the mode radios for the
  // same reason, this is just the second line of defense.
  function handleClick(r, c) {
    if (running) return;
    const entry = grid[r][c];

    if (currentMode === 'clear') {
      // Erase this cell back to empty, and forget it as start/end if it
      // was one so a stale startPos/endPos doesn't point at an empty cell.
      if (entry.type === 'start') startPos = null;
      if (entry.type === 'end') endPos = null;
      setType(r, c, 'empty');
      return;
    }

    if (currentMode === 'wall') {
      // Start/end are never turned into walls by a wall click — they must
      // be explicitly cleared first. Otherwise, toggle: wall <-> empty.
      if (entry.type === 'start' || entry.type === 'end') return;
      setType(r, c, entry.type === 'wall' ? 'empty' : 'wall');
      return;
    }

    if (currentMode === 'start') {
      if (entry.type === 'start') return; // clicking the existing start is a no-op
      // Only one start cell can exist: clear the old one first.
      if (startPos) setType(startPos.r, startPos.c, 'empty');
      // If the clicked cell was the end, moving start onto it displaces
      // the end (a cell can't be both at once).
      if (endPos && endPos.r === r && endPos.c === c) endPos = null;
      setType(r, c, 'start');
      startPos = { r, c };
      return;
    }

    if (currentMode === 'end') {
      // Mirror image of the 'start' branch above.
      if (entry.type === 'end') return;
      if (endPos) setType(endPos.r, endPos.c, 'empty');
      if (startPos && startPos.r === r && startPos.c === c) startPos = null;
      setType(r, c, 'end');
      endPos = { r, c };
    }
  }

  // Keep `currentMode` in sync with whichever mode radio is checked, and
  // move the `.active` styling to match (the radios themselves are visually
  // hidden pills — see astar.css — so the label needs its own active class).
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      currentMode = radio.value;
      document.querySelectorAll('.mode-pill').forEach((label) => label.classList.remove('active'));
      radio.closest('.mode-pill').classList.add('active');
    });
  });

  // Promise-based delay, used to pace the search animation: `await
  // sleep(STEP_DELAY)` pauses the async runAstar()/tracePath() functions
  // for STEP_DELAY ms without blocking the page (a plain loop or a
  // synchronous wait would freeze the UI instead of animating it).
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // A*'s heuristic h(n): a fast, optimistic *estimate* of the remaining
  // distance from (r, c) to the target (tr, tc) — it never looks at walls,
  // it just guesses from geometry. For 4-direction grids that's usually
  // Manhattan distance (dx + dy). Here moves can also go diagonally, and a
  // diagonal step covers one dx AND one dy at once for the cost of a single
  // Math.SQRT2 move, so "octile distance" is used instead: take the diagonal
  // shortcut across the smaller of dx/dy, then walk straight the rest of the
  // way. This has to stay <= the true remaining cost (i.e. "admissible") or
  // A* can settle for a non-shortest path.
  function octile(r, c, tr, tc) {
    const dx = Math.abs(c - tc);
    const dy = Math.abs(r - tr);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  // Walkable neighbors of (r, c), each tagged with the real move cost:
  // 1 for a straight step, sqrt(2) for a diagonal one (Pythagoras — a
  // diagonal move covers more ground than a straight one, so it must cost
  // more or the search would treat them as equal).
  function neighbors(r, c) {
    const result = [];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (grid[nr][nc].type === 'wall') continue;
      if (dr !== 0 && dc !== 0) {
        // Don't let a diagonal step squeeze through the gap between two
        // walls that meet at a corner — require both orthogonal cells next
        // to that corner to be open, otherwise skip the diagonal.
        if (grid[r + dr][c].type === 'wall' || grid[r][c + dc].type === 'wall') continue;
      }
      result.push({ r: nr, c: nc, cost: (dr !== 0 && dc !== 0) ? Math.SQRT2 : 1 });
    }
    return result;
  }

  // Lock or unlock board editing while a search animation plays. Disabling
  // the radios prevents switching modes mid-run, and toggling the
  // `.running` class (see astar.css) sets pointer-events:none on the board
  // so cell clicks can't edit start/end/walls out from under the search
  // that's currently reading them.
  function setInteractive(enabled) {
    document.querySelectorAll('input[name="mode"]').forEach((r) => { r.disabled = !enabled; });
    board.classList.toggle('running', !enabled);
  }

  // Entry point wired to the Run button: sets up A* state for the current
  // start/end/walls, then animates the search to completion. Declared
  // `async` so it can `await sleep(...)` between steps further down,
  // pausing this function without blocking the rest of the page.
  async function runAstar() {
    if (running) return; // ignore extra clicks while already animating
    if (!startPos || !endPos) {
      setStatus('Set a start and an end cell first.', true);
      return;
    }

    running = true;
    clearOverlay(); // wipe any highlighting left over from a previous run
    setInteractive(false);
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
    setStatus('Searching…', false);

    // Per-cell A* bookkeeping, kept separate from the grid/DOM state above:
    //   g      — cheapest known cost from the start to this cell
    //   f      — g + h(this cell, end): A*'s guess of the cost of the best
    //            full path that runs through this cell. This is the number
    //            used to rank candidates below.
    //   parent — the cell we stepped from to achieve that g, so the final
    //            path can be reconstructed by walking parents backwards
    //            from the end
    //   open   — true while the cell is a candidate waiting to be expanded
    //            (the "frontier")
    //   closed — true once the cell has been expanded and its best-known
    //            g is considered final (the "visited" set)
    const state = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({
        g: Infinity, f: Infinity, parent: null, open: false, closed: false,
      }))
    );

    // The start cell costs nothing to reach and is immediately open.
    state[startPos.r][startPos.c].g = 0;
    state[startPos.r][startPos.c].f = octile(startPos.r, startPos.c, endPos.r, endPos.c);
    state[startPos.r][startPos.c].open = true;

    // openList is the frontier: every discovered-but-not-yet-expanded cell.
    // A real implementation would use a priority queue/min-heap so grabbing
    // the best candidate is O(log n); here it's a plain array scanned
    // linearly each round (see "Step 2" below) since the board is small and
    // the 300ms animation delay dwarfs the scan cost anyway.
    let openList = [{ r: startPos.r, c: startPos.c }];
    let current = { r: startPos.r, c: startPos.c };
    let found = false;

    grid[current.r][current.c].el.classList.add('current');

    try {
      // Main A* loop. Each iteration expands the current cell's 8 neighbors,
      // then jumps to whichever discovered-but-unexpanded cell now looks
      // most promising. Because that "most promising" cell can be anywhere
      // in the frontier (not necessarily one of the 8 just highlighted),
      // the visualized path can double back or jump across the board
      // instead of only ever growing outward from the previous cell — that's
      // expected A* behavior, not a bug.
      while (true) {
        // The current cell is the target — since it was only ever chosen as
        // "current" by being the cheapest-f candidate in the open set, its
        // g is guaranteed optimal and we can stop instead of expanding it.
        if (current.r === endPos.r && current.c === endPos.c) {
          found = true;
          break;
        }

        // Step 1: expand the 8 neighbors of the current cell. For each one,
        // check whether reaching it *through the current cell* beats the
        // best path found for it so far (tentativeG < s.g). If so, record
        // that better cost/parent and, if it's a brand-new discovery, add
        // it to the open set and highlight it as part of the frontier.
        const cur = state[current.r][current.c];
        const newlyOpened = [];

        for (const { r, c, cost } of neighbors(current.r, current.c)) {
          const s = state[r][c];
          if (s.closed) continue; // already expanded with a final, optimal g
          const tentativeG = cur.g + cost;
          if (tentativeG < s.g) {
            s.g = tentativeG;
            s.f = tentativeG + octile(r, c, endPos.r, endPos.c);
            s.parent = current;
            if (!s.open) {
              s.open = true;
              openList.push({ r, c });
              newlyOpened.push({ r, c });
            }
          }
        }

        for (const { r, c } of newlyOpened) {
          if (grid[r][c].type === 'empty') grid[r][c].el.classList.add('frontier');
        }
        if (newlyOpened.length) await sleep(STEP_DELAY);

        // The current cell is fully expanded: move it from "open" to
        // "closed" (done, g is final) and fade its highlight from
        // current/frontier to visited.
        cur.closed = true;
        cur.open = false;
        openList = openList.filter((n) => !(n.r === current.r && n.c === current.c));
        grid[current.r][current.c].el.classList.remove('current', 'frontier');
        if (grid[current.r][current.c].type === 'empty') {
          grid[current.r][current.c].el.classList.add('visited');
        }

        // Nothing left to explore and the target was never reached — it's
        // unreachable (walled off).
        if (openList.length === 0) break;

        // Step 2: of every cell discovered so far (the whole open set, not
        // just this round's neighbors), pick the one with the lowest f.
        // f = g + h estimates "cost of the best full path through this
        // cell", so the lowest-f cell is A*'s current best guess for where
        // the shortest path goes next — that becomes the new current cell.
        let best = openList[0];
        let bestF = state[best.r][best.c].f;
        for (const node of openList) {
          const f = state[node.r][node.c].f;
          if (f < bestF) { best = node; bestF = f; }
        }

        current = best;
        grid[current.r][current.c].el.classList.remove('frontier');
        grid[current.r][current.c].el.classList.add('current');
        setStatus(`Best candidate: row ${current.r}, col ${current.c}`, false);
        await sleep(STEP_DELAY);
      }

      if (found) {
        setStatus('Path found — tracing route…', false);
        await tracePath(state);
      } else {
        setStatus('No path found — walls block every route.', true);
      }
    } finally {
      // Always restore board interactivity, even if something above threw —
      // otherwise a bug in the search could leave the board permanently
      // locked with the Run button stuck on "Running…".
      running = false;
      setInteractive(true);
      runBtn.disabled = false;
      runBtn.textContent = 'Run again';
    }
  }

  // Reconstruct the shortest path by walking `parent` links backwards from
  // the end cell to the start (each cell's parent is whichever neighbor
  // gave it its cheapest known g), then reverse so it plays start -> end.
  async function tracePath(state) {
    const path = [];
    let node = endPos;
    while (node) {
      path.push(node);
      node = state[node.r][node.c].parent;
    }
    path.reverse(); // was end -> start; flip so it renders start -> end

    // Reveal the path one cell at a time (rather than all at once) so the
    // final route is as much a part of the animation as the search was.
    for (const { r, c } of path) {
      grid[r][c].el.classList.remove('current', 'visited', 'frontier');
      grid[r][c].el.classList.add('path');
      await sleep(STEP_DELAY);
    }
    setStatus(`Path found — ${path.length - 1} steps.`, false);
  }

  // Kick off a search whenever the Run button is clicked.
  runBtn.addEventListener('click', runAstar);
})();
