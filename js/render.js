// render.js – draws the paper (instructions, passages, tables, images, questions).

// ---------- Pictures ----------

// Creates a picture that keeps its shape, scales on phones and opens large when clicked.
function makeImage(context, fileName, altText) {
  const figure = document.createElement("figure");
  figure.className = "figure";

  const img = document.createElement("img");
  img.src = imagePath(context.type, context.groupId, context.itemId, fileName);
  img.alt = altText;
  img.title = "Click to enlarge";
  img.loading = "lazy";
  img.addEventListener("click", function () { openLightbox(img.src, altText); });

  // If the file is missing, say so clearly instead of showing a broken icon.
  img.addEventListener("error", function () {
    figure.innerHTML = "";
    const note = document.createElement("p");
    note.className = "img-missing";
    note.textContent = "⚠ Image not found: " + fileName + " (check the name and the images folder)";
    figure.appendChild(note);
  });

  figure.appendChild(img);
  return figure;
}

// The full-screen "enlarged picture" view. Created once, reused every time.
let lightbox = null;

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

    lightbox.addEventListener("click", closeLightbox); // click anywhere to close
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLightbox();
    });
  }
  const big = lightbox.querySelector("img");
  big.src = src;
  big.alt = altText;
  lightbox.hidden = false;
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.hidden = true;
  document.body.classList.remove("no-scroll");
}

// ---------- Tables ----------

// Turns the text from the Table column into an HTML table.
// Rows are on separate lines, cells are separated by "|". The first row is the heading.
function makeTable(tableText) {
  const lines = tableText.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });

  const wrap = document.createElement("div");
  wrap.className = "table-wrap"; // lets wide tables scroll sideways on phones
  const table = document.createElement("table");
  table.className = "data-table";

  lines.forEach(function (line, index) {
    const tr = document.createElement("tr");
    line.split("|").forEach(function (cellText) {
      const cell = document.createElement(index === 0 ? "th" : "td");
      cell.textContent = cellText.trim();
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  });

  wrap.appendChild(table);
  return wrap;
}

// ---------- Questions ----------

function renderQuestion(q, context) {
  const card = document.createElement("article");
  card.className = "question";
  card.dataset.number = q.label;

  // Question text, e.g. "Q1. Republic Day is celebrated on?"
  const title = document.createElement("p");
  title.className = "q-text";
  const num = document.createElement("span");
  num.className = "q-num";
  num.textContent = "Q" + q.label + ".";
  title.appendChild(num);
  title.appendChild(document.createTextNode(" " + q.text));
  card.appendChild(title);

  // This question's own picture (from the Image column of questions.csv).
  splitList(q.image).forEach(function (fileName) {
    card.appendChild(makeImage(context, fileName, "Figure for question " + q.label));
  });

  // Options
  const buttons = [];
  q.options.forEach(function (option) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.key = option.key;

    const key = document.createElement("span");
    key.className = "opt-key";
    key.textContent = option.key + ")";
    const text = document.createElement("span");
    text.className = "opt-text";
    text.textContent = option.text;

    button.appendChild(key);
    button.appendChild(text);
    card.appendChild(button);
    buttons.push(button);

    button.addEventListener("click", function () {
      if (card.classList.contains("locked") || q.problem) return; // already answered

      card.classList.add("locked");
      const isCorrect = option.key === q.answer;

      if (isCorrect) {
        button.classList.add("correct");
      } else {
        button.classList.add("wrong");
        buttons.forEach(function (b) {
          if (b.dataset.key === q.answer) b.classList.add("correct");
        });
      }
      recordAnswer(isCorrect);
    });
  });

  if (q.problem) {
    const note = document.createElement("p");
    note.className = "q-problem";
    note.textContent = "⚠ This question cannot be checked: " + q.problem + ".";
    card.appendChild(note);
  }
  return card;
}

// ---------- Groups (instruction + passage/table/graph + questions) ----------

// Builds the box that is shown once above a group of questions.
// 'extra' is the matching row from stimuli.csv (or undefined).
function makeGroup(instructionText, extra, context) {
  const section = document.createElement("section");
  section.className = "group";

  const box = document.createElement("div");
  box.className = "stimulus";

  const text = (extra && extra.instruction) || instructionText;
  if (text) {
    const instruction = document.createElement("p");
    instruction.className = "stimulus-text";
    instruction.textContent = text;
    box.appendChild(instruction);
  }

  if (extra) {
    if (extra.passage) {
      const passage = document.createElement("div");
      passage.className = "passage"; // keeps paragraph breaks
      passage.textContent = extra.passage;
      box.appendChild(passage);
    }
    if (extra.table) box.appendChild(makeTable(extra.table));
    extra.images.forEach(function (fileName) {
      box.appendChild(makeImage(context, fileName, "Shared figure for this group of questions"));
    });
    if (extra.caption) {
      const caption = document.createElement("p");
      caption.className = "caption";
      caption.textContent = extra.caption;
      box.appendChild(caption);
    }
  }

  const body = document.createElement("div");
  body.className = "group-questions";
  section.appendChild(box);
  section.appendChild(body);
  return { section: section, body: body };
}

// ---------- The whole paper ----------

// Draws everything in original order. 'context' tells us where the images live:
// { type, groupId, itemId }
function renderPaper(paper, container, context) {
  container.innerHTML = "";
  const stimuli = paper.stimuli || {};
  const groupBodies = {}; // stimulus id -> where its questions go

  function openGroup(id, instructionText) {
    const group = makeGroup(instructionText, stimuli[id], context);
    container.appendChild(group.section);
    groupBodies[id] = group.body;
  }

  paper.items.forEach(function (item) {
    if (item.type === "stimulus") {
      openGroup(item.id, item.instruction);
    } else {
      // A question that names a Stimulus ID but has no instruction row still gets its box.
      if (item.stimulusId && !groupBodies[item.stimulusId] && stimuli[item.stimulusId]) {
        openGroup(item.stimulusId, "");
      }
      const target = (item.stimulusId && groupBodies[item.stimulusId]) || container;
      target.appendChild(renderQuestion(item, context));
    }
  });
}