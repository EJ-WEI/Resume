// A* board: grid of clickable cells (start / end / wall), mirrored live onto
// a second, non-interactive board that shares the same start/end/walls but
// runs its own copy of the search with a different tie-break rule — so
// Run animates two independent A* searches side by side over identical
// inputs, and the status line under each board reports how many cells each
// one had to expand to reach the target.
(() => {
  const ROWS = 15;
  const COLS = 30;
  const STEP_DELAY = 30;
  const board = document.getElementById('board');
  const board2 = document.getElementById('board2');
  const runBtn = document.getElementById('run-btn');
  const clearBtn = document.getElementById('clear-btn');
  const statusEl = document.getElementById('run-status');
  const board1StatusEl = document.getElementById('board1-status');
  const board2StatusEl = document.getElementById('board2-status');

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
  let dragging = false; // true while the mouse button is held down over the board

  // `grid` is the app's own model of the board, parallel to the DOM: one
  // entry per cell holding a reference to its <div> on board 1 (`el`) and
  // to the matching <div> on board 2 (`el2`), plus its current `type`
  // ('empty' | 'start' | 'end' | 'wall'). Editing (setType/clearBoard)
  // always touches both `el` and `el2` together, since the two boards must
  // always agree on start/end/walls. Search highlighting does NOT: each
  // board runs its own independent search (see runSearch below), so their
  // frontier/visited/current/path classes are applied separately and are
  // expected to diverge during a run.
  const grid = [];

  // Build the board once: one <div class="cell"> per grid square on each of
  // the two boards. Only the first board's cells get input listeners — it's
  // the only one the user edits — wired to handleClick (single cell) and,
  // for the wall/erase modes, mousedown+mouseenter so the same gesture also
  // works as a press-and-drag across multiple cells. The mirror board's
  // cells are purely visual (see .astar-board.mirror in astar.css). dataset.
  // row/col aren't read by the app logic (grid[r][c] already knows its own
  // position) — they exist so a cell's coordinates are visible/queryable
  // from the DOM (devtools, tests, CSS attribute selectors).
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || running) return;
        dragging = true;
        handleClick(r, c);
      });
      cell.addEventListener('mouseenter', () => {
        // Dragging only paints for wall/erase — start/end stay single-cell.
        if (dragging && (currentMode === 'wall' || currentMode === 'erase')) handleClick(r, c);
      });
      board.appendChild(cell);

      const cell2 = document.createElement('div');
      cell2.className = 'cell';
      cell2.dataset.row = r;
      cell2.dataset.col = c;
      board2.appendChild(cell2);

      row.push({ el: cell, el2: cell2, type: 'empty' });
    }
    grid.push(row);
  }

  // Stop a drag wherever the mouse button is released, even off the board.
  document.addEventListener('mouseup', () => { dragging = false; });

  // Change what a cell *is* (empty/start/end/wall) — this is board editing,
  // separate from the temporary search-progress highlighting below. Swaps
  // the relevant CSS class and clears any leftover search visualization,
  // since editing the board mid-way would make an old frontier/path
  // rendering describe a search that no longer matches the current layout.
  function setType(r, c, type) {
    const entry = grid[r][c];
    entry.type = type;
    entry.el.classList.remove('start', 'end', 'wall');
    entry.el2.classList.remove('start', 'end', 'wall');
    if (type !== 'empty') {
      entry.el.classList.add(type);
      entry.el2.classList.add(type);
    }
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
        entry.el2.classList.remove('frontier', 'visited', 'current', 'path');
      }
    }
  }

  // Reset every cell on the board back to empty — start, end, and all walls
  // included — and forget the current start/end selection. Ignored while a
  // search animation is running, same as board edits via handleClick.
  function clearBoard() {
    if (running) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const entry = grid[r][c];
        entry.type = 'empty';
        entry.el.classList.remove('start', 'end', 'wall');
        entry.el2.classList.remove('start', 'end', 'wall');
      }
    }
    clearOverlay();
    startPos = null;
    endPos = null;
    setStatus('', false);
    setBoardStatus(1, '', false);
    setBoardStatus(2, '', false);
  }

  // Update the one-line status message under the Run button (e.g.
  // "Searching…", or a validation error). `warn` switches it to the
  // warning color for problem states like "no path found" or a missing
  // start/end, instead of the normal muted info color.
  function setStatus(text, warn) {
    statusEl.textContent = text;
    statusEl.classList.toggle('warn', !!warn);
  }

  // Same as setStatus, but for the per-board result line under board 1 or
  // board 2 — each board's search result (steps + cells expanded) is
  // reported separately since the two searches can now genuinely differ.
  function setBoardStatus(boardNum, text, warn) {
    const el = boardNum === 1 ? board1StatusEl : board2StatusEl;
    el.textContent = text;
    el.classList.toggle('warn', !!warn);
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

    if (currentMode === 'wall') {
      // Start/end are never turned into walls by a wall click — they must
      // be explicitly cleared first. Wall mode only ever adds walls (use
      // 'erase' mode to remove them), so dragging across an existing wall
      // or an already-empty cell is a no-op either way.
      if (entry.type === 'start' || entry.type === 'end' || entry.type === 'wall') return;
      setType(r, c, 'wall');
      return;
    }

    if (currentMode === 'erase') {
      // Only removes walls, leaving start/end/empty cells untouched.
      if (entry.type !== 'wall') return;
      setType(r, c, 'empty');
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
    clearBtn.disabled = !enabled;
  }

  // Candidate-comparison rules used to pick the next cell to expand out of
  // the open set, when more than one shares the lowest f. Each returns a
  // negative number when `a` should be preferred over `b`, 0 when neither
  // wins (in which case whichever was found first — i.e. already `best` —
  // keeps its lead), matching the semantics of a normal sort comparator.

  // Board 1 — the original, naive rule: only f matters. When several
  // frontier cells tie exactly on f, this never picks a's tie over b's, so
  // whichever cell happened to be discovered (and therefore pushed into
  // openList) first keeps winning — an arbitrary, order-of-discovery
  // tie-break that has nothing to do with which cell is actually closer to
  // the target.
  function compareBaseline(a, b) {
    return a.f - b.f;
  }

  // Board 2 — same f comparison, but when f ties exactly, prefer the
  // candidate with the larger g (equivalently, the smaller h: it's already
  // further along its path and thus closer to the target). This never
  // changes any g/f value used elsewhere, so the shortest path A* finds is
  // still guaranteed optimal — it only changes which of several
  // equally-good candidates gets expanded first, which is what stops the
  // search from visibly "jumping" to a far-away tied cell before working
  // its way back toward the goal.
  function compareTieBreak(a, b) {
    if (a.f !== b.f) return a.f - b.f;
    return b.g - a.g;
  }

  // Runs one full, independently-animated A* search against the current
  // start/end/walls, painting its progress onto one board only (`key` is
  // 'el' for board 1, 'el2' for board 2) using `compare` to break ties in
  // the open set. Returns how it went, so the caller can report each
  // board's result once both have finished.
  async function runSearch(key, compare) {
    // Per-cell A* bookkeeping, kept separate from the grid/DOM state above
    // (and separate per board, since the two searches now diverge):
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
    // the animation delay dwarfs the scan cost anyway.
    let openList = [{ r: startPos.r, c: startPos.c }];
    let current = { r: startPos.r, c: startPos.c };
    let found = false;
    // How many times a cell was popped off the open set and expanded before
    // the target was reached — this is the number the two boards are being
    // compared on, since a smarter tie-break should need fewer of them.
    let expansions = 0;

    grid[current.r][current.c][key].classList.add('current');

    // Main A* loop. Each iteration expands the current cell's 8 neighbors,
    // then jumps to whichever discovered-but-unexpanded cell now looks
    // most promising according to `compare`. Because that "most promising"
    // cell can be anywhere in the frontier (not necessarily one of the 8
    // just highlighted), the visualized path can double back or jump
    // across the board instead of only ever growing outward from the
    // previous cell — that's expected A* behavior, not a bug (though
    // board 1's arbitrary tie-break makes it jump further/more often than
    // board 2's does).
    while (true) {
      // The current cell is the target — since it was only ever chosen as
      // "current" by being the best candidate in the open set, its g is
      // guaranteed optimal and we can stop instead of expanding it.
      if (current.r === endPos.r && current.c === endPos.c) {
        found = true;
        break;
      }
      expansions++;

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
        // Candidate cost of reaching this neighbor by stepping here from
        // `current` — not committed yet, just compared against its best
        // known g below.
        const tentativeG = cur.g + cost;
        if (tentativeG < s.g) {
          // This route beats whatever was known before (or the neighbor
          // is brand new, since s.g starts at Infinity) — record it as
          // the new best: g is the real cost so far, f adds the
          // heuristic for ranking, and parent lets the path be traced
          // back once the search ends.
          s.g = tentativeG;
          s.f = tentativeG + octile(r, c, endPos.r, endPos.c);
          s.parent = current;
          if (!s.open) {
            // First time this cell has ever been discovered: add it to
            // the frontier. If it was already open, it's already in
            // openList/newlyOpened from an earlier round — only its g/f/
            // parent needed the update above, so skip re-adding it.
            s.open = true;
            openList.push({ r, c });
            newlyOpened.push({ r, c });
          }
        }
      }

      for (const { r, c } of newlyOpened) {
        if (grid[r][c].type === 'empty') grid[r][c][key].classList.add('frontier');
      }
      if (newlyOpened.length) await sleep(STEP_DELAY);

      // The current cell is fully expanded: move it from "open" to
      // "closed" (done, g is final) and fade its highlight from
      // current/frontier to visited.
      cur.closed = true;
      cur.open = false;
      openList = openList.filter((n) => !(n.r === current.r && n.c === current.c));
      grid[current.r][current.c][key].classList.remove('current', 'frontier');
      if (grid[current.r][current.c].type === 'empty') {
        grid[current.r][current.c][key].classList.add('visited');
      }

      // Nothing left to explore and the target was never reached — it's
      // unreachable (walled off).
      if (openList.length === 0) break;

      // Step 2: of every cell discovered so far (the whole open set, not
      // just this round's neighbors), pick the best one according to
      // `compare` — this is the only line that differs between board 1 and
      // board 2's searches.
      let best = openList[0];
      let bestS = state[best.r][best.c];
      for (const node of openList) {
        const s = state[node.r][node.c];
        if (compare(s, bestS) < 0) { best = node; bestS = s; }
      }

      current = best;
      grid[current.r][current.c][key].classList.remove('frontier');
      grid[current.r][current.c][key].classList.add('current');
      await sleep(STEP_DELAY);
    }

    let pathLength = 0;
    if (found) {
      pathLength = await tracePath(state, key);
    }
    return { found, expansions, pathLength };
  }

  // Reconstruct the shortest path by walking `parent` links backwards from
  // the end cell to the start (each cell's parent is whichever neighbor
  // gave it its cheapest known g), then reverse so it plays start -> end.
  // Returns the path length (in steps) once fully revealed.
  async function tracePath(state, key) {
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
      const el = grid[r][c][key];
      el.classList.remove('current', 'visited', 'frontier');
      el.classList.add('path');
      await sleep(STEP_DELAY);
    }
    return path.length - 1;
  }

  // Turns one board's { found, expansions, pathLength } result into the
  // text shown in its status line.
  function describeResult({ found, expansions, pathLength }) {
    if (!found) return `No path found — ${expansions} cells expanded.`;
    return `Path found — ${pathLength} steps (${expansions} cells expanded).`;
  }

  // Entry point wired to the Run button: runs board 1's baseline search and
  // board 2's tie-break search at the same time (via Promise.all, so their
  // `await sleep(...)` calls interleave and both animations play
  // simultaneously), then reports each board's own result once both are
  // done. Declared `async` so the caller doesn't need to block on it.
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
    setBoardStatus(1, 'Searching…', false);
    setBoardStatus(2, 'Searching…', false);

    try {
      const [result1, result2] = await Promise.all([
        runSearch('el', compareBaseline),
        runSearch('el2', compareTieBreak),
      ]);

      setBoardStatus(1, describeResult(result1), !result1.found);
      setBoardStatus(2, describeResult(result2), !result2.found);
      setStatus(
        result1.found && result2.found ? 'Both boards finished.' : 'No path found — walls block every route.',
        !(result1.found && result2.found)
      );
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

  // Kick off a search whenever the Run button is clicked.
  runBtn.addEventListener('click', runAstar);

  // Reset the whole board whenever the Clear Board button is clicked.
  clearBtn.addEventListener('click', clearBoard);
})();
