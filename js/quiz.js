// quiz.js – behaviour for the ready-made question pages.
// The questions are already in the HTML. The correct answer is stored on each
// question as data-answer="C", so checking happens instantly in the browser.

(function () {
  const container = document.getElementById("questions");
  const total = container.querySelectorAll(".question").length;
  const score = { attempted: 0, correct: 0 };

  // ----- Counters and progress bar -----
  function updateStats() {
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-attempted").textContent = score.attempted;
    document.getElementById("stat-correct").textContent = score.correct;
    document.getElementById("stat-incorrect").textContent = score.attempted - score.correct;
    const percent = total ? (score.attempted / total) * 100 : 0;
    document.getElementById("progress-fill").style.width = percent + "%";
  }

  // ----- Answering -----
  container.addEventListener("click", function (event) {
    const button = event.target.closest(".option");
    if (!button) return;

    const card = button.closest(".question");
    const answer = card.dataset.answer;          // missing = question has a data problem
    if (!answer || card.classList.contains("locked")) return;

    card.classList.add("locked");
    const isCorrect = button.dataset.key === answer;

    if (isCorrect) {
      button.classList.add("correct");
    } else {
      button.classList.add("wrong");
      const right = card.querySelector('.option[data-key="' + answer + '"]');
      if (right) right.classList.add("correct");
    }
    score.attempted++;
    if (isCorrect) score.correct++;
    updateStats();
  });

  // ----- Restart -----
  document.getElementById("reset-btn").addEventListener("click", function () {
    if (score.attempted > 0 && !confirm("Restart this paper? Your answers will be cleared.")) return;
    container.querySelectorAll(".locked").forEach(function (card) { card.classList.remove("locked"); });
    container.querySelectorAll(".correct, .wrong").forEach(function (option) {
      option.classList.remove("correct", "wrong");
    });
    score.attempted = 0;
    score.correct = 0;
    updateStats();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ----- Paper / part dropdown: each choice is its own page -----
  document.getElementById("item-select").addEventListener("change", function (event) {
    window.location.href = event.target.value;
  });

  // ----- Missing image: show a clear message instead of a broken icon -----
  container.addEventListener("error", function (event) {
    if (event.target.tagName !== "IMG") return;
    const note = document.createElement("p");
    note.className = "img-missing";
    note.textContent = "⚠ Image could not be loaded.";
    event.target.replaceWith(note);
  }, true);

  // ----- Click an image to enlarge it -----
  let lightbox = null;

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function openLightbox(src, altText) {
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.className = "lightbox";
      lightbox.hidden = true;
      const big = document.createElement("img");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "lightbox-close";
      close.textContent = "✕";
      close.setAttribute("aria-label", "Close");
      lightbox.appendChild(big);
      lightbox.appendChild(close);
      document.body.appendChild(lightbox);
      lightbox.addEventListener("click", closeLightbox);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLightbox(); });
    }
    const big = lightbox.querySelector("img");
    big.src = src;
    big.alt = altText;
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
  }

  container.addEventListener("click", function (event) {
    const img = event.target.closest(".figure img");
    if (img) openLightbox(img.src, img.alt);
  });

  // ----- Keep the sticky passage box just below the sticky counters bar -----
  function syncStickyOffset() {
    const bar = document.getElementById("stats-bar");
    document.documentElement.style.setProperty("--stats-h", bar.offsetHeight + "px");
  }
  syncStickyOffset();
  window.addEventListener("resize", syncStickyOffset);

  updateStats();
})();