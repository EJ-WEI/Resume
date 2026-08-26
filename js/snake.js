// Snake game — classic grid movement on a canvas, keyboard + touch + on-screen controls.
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cell = 20;
  const cols = canvas.width / cell;
  const rows = canvas.height / cell;

  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const startBtn = document.getElementById('start-btn');

  const HIGH_KEY = 'ej-snake-highscore';
  let highScore = Number(localStorage.getItem(HIGH_KEY)) || 0;
  highEl.textContent = highScore;

  let snake, dir, nextDir, food, score, speedMs, timer, running;

  function reset() {
    snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    speedMs = 130;
    scoreEl.textContent = score;
    placeFood();
  }

  function placeFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) return gameOver();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = score;
      placeFood();
      if (score % 5 === 0 && speedMs > 70) {
        speedMs -= 8;
        restartTimer();
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.fillStyle = '#16202B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(184,196,204,0.08)';
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(canvas.width, y * cell); ctx.stroke();
    }

    ctx.fillStyle = '#2F6F5E';
    ctx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#E0972E' : 'rgba(224,151,46,0.75)';
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(tick, speedMs);
  }

  function start() {
    reset();
    draw();
    overlay.classList.remove('show');
    running = true;
    restartTimer();
  }

  function gameOver() {
    clearInterval(timer);
    running = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_KEY, String(highScore));
      highEl.textContent = highScore;
    }
    overlayTitle.textContent = 'SELF-TEST FAILED';
    overlayMsg.textContent = `Score: ${score} — press start to retry`;
    overlay.classList.add('show');
  }

  function setDir(x, y) {
    if (!running) return;
    if (dir.x === -x && dir.y === -y) return; // no reversing into yourself
    nextDir = { x, y };
  }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': setDir(0, -1); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': setDir(0, 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': setDir(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': setDir(1, 0); e.preventDefault(); break;
      case ' ': if (!running) start(); e.preventDefault(); break;
    }
  });

  document.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.dir.split(',').map(Number);
      setDir(x, y);
    });
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => { touchStart = e.touches[0]; }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  startBtn.addEventListener('click', start);

  reset();
  draw();
})();
