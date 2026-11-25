const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");
const scoreElement = document.getElementById("score");
const linesElement = document.getElementById("lines");
const levelElement = document.getElementById("level");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");
const gameOverElement = document.getElementById("game-over");
const pauseOverlay = document.getElementById("pause-overlay");
const finalScoreElement = document.getElementById("final-score");

const COLS = 10;
const ROWS = 20;
const CELL = 30;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]],
};

const COLORS = {
  I: "#44cbe8",
  J: "#5577e7",
  L: "#ed9a45",
  O: "#e9cd57",
  S: "#63c984",
  T: "#a66ad8",
  Z: "#dd5f78",
};

let board = createBoard();
let piece = null;
let nextPiece = randomPiece();
let score = 0;
let lines = 0;
let level = 1;
let running = false;
let gameOver = false;
let paused = false;
let lastTime = 0;
let dropCounter = 0;
let elapsedPlayTime = 0;
let animationId = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function clonePiece(pieceToClone) {
  return {
    type: pieceToClone.type,
    matrix: pieceToClone.matrix.map((row) => [...row]),
    x: pieceToClone.x,
    y: pieceToClone.y,
  };
}

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  paused = false;
  running = true;
  dropCounter = 0;
  elapsedPlayTime = 0;
  lastTime = performance.now();
  nextPiece = randomPiece();
  spawnPiece();
  updateStats();
  gameOverElement.hidden = true;
  startButton.textContent = "STARTA OM";
  pauseButton.textContent = "PAUSA (P)";
  pauseButton.setAttribute("aria-pressed", "false");
  pauseButton.disabled = false;
  pauseOverlay.hidden = true;

  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  animationId = requestAnimationFrame(update);
}

function spawnPiece() {
  piece = clonePiece(nextPiece);
  piece.x = Math.floor((COLS - piece.matrix[0].length) / 2);
  piece.y = 0;
  nextPiece = randomPiece();
  drawNext();

  if (collides(piece)) {
    endGame();
  }
}

function collides(testPiece) {
  for (let y = 0; y < testPiece.matrix.length; y += 1) {
    for (let x = 0; x < testPiece.matrix[y].length; x += 1) {
      if (!testPiece.matrix[y][x]) continue;

      const boardX = testPiece.x + x;
      const boardY = testPiece.y + y;
      if (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && board[boardY][boardX])
      ) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece() {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = piece.y + y;
        if (boardY >= 0) {
          board[boardY][piece.x + x] = piece.type;
        }
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateStats();
  }
}

function move(dx, dy) {
  if (!running || gameOver || paused) return false;
  piece.x += dx;
  piece.y += dy;

  if (collides(piece)) {
    piece.x -= dx;
    piece.y -= dy;
    if (dy > 0) {
      lockPiece();
    }
    return false;
  }
  return true;
}

function softDrop() {
  if (paused) return;
  if (move(0, 1)) {
    score += 1;
    updateStats();
  }
  dropCounter = 0;
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
  dropCounter = 0;
}

function rotate() {
  if (!running || gameOver || paused || piece.type === "O") return;

  const original = piece.matrix;
  const rotated = original[0].map((_, index) =>
    original.map((row) => row[index]).reverse(),
  );
  piece.matrix = rotated;

  if (collides(piece)) {
    piece.x -= 1;
    if (collides(piece)) {
      piece.x += 2;
      if (collides(piece)) {
        piece.x -= 1;
        piece.y -= 1;
        if (collides(piece)) {
          piece.matrix = original;
          piece.y += 1;
        }
      }
    }
  }
}

function hardDrop() {
  if (!running || gameOver || paused) return;
  let distance = 0;
  while (!collides({ ...piece, y: piece.y + 1 })) {
    piece.y += 1;
    distance += 1;
  }
  lockPiece();
  score += distance * 2;
  updateStats();
}

function endGame() {
  running = false;
  gameOver = true;
  paused = false;
  pauseButton.disabled = true;
  pauseButton.setAttribute("aria-pressed", "false");
  pauseOverlay.hidden = true;
  finalScoreElement.textContent = score;
  gameOverElement.hidden = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  draw();
}

function update(time = 0) {
  if (!running) return;

  if (paused) {
    animationId = null;
    return;
  }

  const delta = time - lastTime;
  lastTime = time;
  elapsedPlayTime += delta;
  dropCounter += delta;
  const timeSpeedup = Math.floor(elapsedPlayTime / 15_000) * 30;
  const interval = Math.max(70, 650 - (level - 1) * 55 - timeSpeedup);

  if (dropCounter > interval) {
    move(0, 1);
    dropCounter = 0;
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function updateStats() {
  scoreElement.textContent = score;
  linesElement.textContent = lines;
  levelElement.textContent = level;
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  pauseOverlay.hidden = !paused;
  pauseButton.textContent = paused ? "FORTSÄTT (P)" : "PAUSA (P)";
  pauseButton.setAttribute("aria-pressed", paused ? "true" : "false");
  lastTime = performance.now();
  dropCounter = 0;

  if (paused) {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  } else {
    animationId = requestAnimationFrame(update);
  }
}

function drawCell(ctx, x, y, type, size = CELL) {
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(x * size + 3, y * size + 3, size - 6, 3);

  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.fillRect(x * size + size - 5, y * size + 5, 3, size - 8);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#10102a";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(158, 151, 212, 0.055)";
  context.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x * CELL + 0.5, 0);
    context.lineTo(x * CELL + 0.5, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * CELL + 0.5);
    context.lineTo(canvas.width, y * CELL + 0.5);
    context.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(context, x, y, type);
    });
  });

  if (piece) {
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) drawCell(context, piece.x + x, piece.y + y, piece.type);
      });
    });
  }
}

function drawNext() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const width = nextPiece.matrix[0].length * size;
  const height = nextPiece.matrix.length * size;
  const offsetX = (nextCanvas.width - width) / 2;
  const offsetY = (nextCanvas.height - height) / 2;

  nextPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      nextContext.fillStyle = COLORS[nextPiece.type];
      nextContext.fillRect(
        offsetX + x * size + 1,
        offsetY + y * size + 1,
        size - 2,
        size - 2,
      );
      nextContext.strokeStyle = "rgba(255, 255, 255, 0.12)";
      nextContext.strokeRect(
        offsetX + x * size + 1.5,
        offsetY + y * size + 1.5,
        size - 3,
        size - 3,
      );
    });
  });
}

function draw() {
  drawBoard();
}

function flashKey(key) {
  const element = document.querySelector(`[data-key="${key.toUpperCase()}"]`);
  if (!element) return;
  element.classList.add("active");
  window.setTimeout(() => element.classList.remove("active"), 90);
}

function handleKey(event) {
  const key = event.key.toLowerCase();

  if (key === "p" || key === "escape") {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }

  const keyMap = {
    w: "W",
    arrowup: "W",
    a: "A",
    arrowleft: "A",
    s: "S",
    arrowdown: "S",
    d: "D",
    arrowright: "D",
  };

  if (keyMap[key] && (running || keyMap[key] === "W")) {
    event.preventDefault();
  }

  if (keyMap[key]) {
    flashKey(keyMap[key]);
  }

  if (key === "w" || key === "arrowup") rotate();
  if (key === "a" || key === "arrowleft") move(-1, 0);
  if (key === "s" || key === "arrowdown") softDrop();
  if (key === "d" || key === "arrowright") move(1, 0);
  if (key === " ") hardDrop();
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);
document.addEventListener("keydown", handleKey);

drawBoard();
drawNext();
