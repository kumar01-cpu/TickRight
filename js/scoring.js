// scoring.js – keeps the counters and the progress bar up to date.

const Score = { total: 0, attempted: 0, correct: 0 };

function resetScore(total) {
  Score.total = total;
  Score.attempted = 0;
  Score.correct = 0;
  updateStatsDisplay();
}

function recordAnswer(isCorrect) {
  Score.attempted++;
  if (isCorrect) Score.correct++;
  updateStatsDisplay();
}

function updateStatsDisplay() {
  document.getElementById("stat-total").textContent = Score.total;
  document.getElementById("stat-attempted").textContent = Score.attempted;
  document.getElementById("stat-correct").textContent = Score.correct;
  document.getElementById("stat-incorrect").textContent = Score.attempted - Score.correct;

  const percent = Score.total ? (Score.attempted / Score.total) * 100 : 0;
  document.getElementById("progress-fill").style.width = percent + "%";
}