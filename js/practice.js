// practice.js – controls practice.html.
// The address looks like: practice.html?type=pyqs&group=UPSSSC-PET&item=2026-25-Oct-Shift-2

function showMessage(text) {
  const box = document.getElementById("message");
  box.textContent = text;
  box.hidden = false;
}

// Shows data warnings (helpful for you while preparing CSV files).
function showWarnings(warnings) {
  const notice = document.getElementById("notice");
  if (warnings.length === 0) { notice.hidden = true; return; }

  notice.innerHTML = "";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "⚠ " + warnings.length + " issue(s) found in this file – click to see";
  const list = document.createElement("ul");
  warnings.forEach(function (w) {
    const li = document.createElement("li");
    li.textContent = w;
    list.appendChild(li);
  });
  details.appendChild(summary);
  details.appendChild(list);
  notice.appendChild(details);
  notice.hidden = false;
}

// The sticky passage/graph box must sit just below the sticky counters bar,
// so we measure the bar's height and give it to the CSS.
function syncStickyOffset() {
  const bar = document.getElementById("stats-bar");
  document.documentElement.style.setProperty("--stats-h", bar.offsetHeight + "px");
}

async function startPractice() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");       // "pyqs" or "topics"
  const groupId = params.get("group");   // e.g. "UPSSSC-PET"
  const itemId = params.get("item");     // e.g. "2026-25-Oct-Shift-2" (optional)

  const title = document.getElementById("page-title");

  try {
    // 1. Find the exam/topic in the manifest.
    const manifest = await loadManifest();
    const groups = manifest[type];
    const group = groups && groups.find(function (g) { return g.id === groupId; });
    if (!group) {
      title.textContent = "Not found";
      showMessage("This exam or topic could not be found. Please go back to the home page.");
      return;
    }

    // 2. Heading and list of papers (or parts).
    title.textContent = (type === "pyqs") ? group.name + " Solved PYQs" : group.name;
    document.title = group.name + " – TickRight.com";
    const items = (type === "pyqs") ? group.papers : group.parts;

    if (!items || items.length === 0) {
      showMessage("No questions have been added here yet. Coming soon!");
      return;
    }

    // 3. Which paper is selected? Default: the first one.
    const current = items.find(function (i) { return i.id === itemId; }) || items[0];

    // 4. Fill the dropdown. Changing it reloads the page with the new paper.
    const select = document.getElementById("item-select");
    items.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      option.selected = (item.id === current.id);
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      window.location.href = "practice.html?type=" + encodeURIComponent(type) +
        "&group=" + encodeURIComponent(group.id) +
        "&item=" + encodeURIComponent(select.value);
    });
    document.getElementById("select-bar").hidden = false;

    // 5. Load ONLY this paper's questions.
    const response = await fetch(dataPath(type, group.id, current.id, "questions.csv"));
    if (!response.ok) {
      showMessage("The questions file for this paper could not be loaded.");
      return;
    }
    const paper = buildPaper(parseCSV(await response.text()));

    // 6. Load stimuli.csv (passages, tables, graphs) if this paper has one.
    paper.stimuli = {};
    if (current.hasStimuli) {
      try {
        const stimResponse = await fetch(dataPath(type, group.id, current.id, "stimuli.csv"));
        if (stimResponse.ok) {
          paper.stimuli = buildStimuli(parseCSV(await stimResponse.text()));
        } else {
          paper.warnings.push("stimuli.csv could not be loaded.");
        }
      } catch (error) {
        paper.warnings.push("stimuli.csv problem: " + error.message);
      }
    }

    // Warn about Stimulus IDs in stimuli.csv that match nothing in questions.csv.
    const knownIds = {};
    paper.items.forEach(function (item) {
      if (item.type === "stimulus") knownIds[item.id] = true;
      if (item.type === "question" && item.stimulusId) knownIds[item.stimulusId] = true;
    });
    Object.keys(paper.stimuli).forEach(function (id) {
      if (!knownIds[id]) {
        paper.warnings.push("stimuli.csv: Stimulus ID \"" + id + "\" matches no instruction row in questions.csv " +
                            "(IDs look like S61 – the letter S plus the first question number).");
      }
    });

    // 7. Show everything.
    const context = { type: type, groupId: group.id, itemId: current.id };
    const container = document.getElementById("questions");
    renderPaper(paper, container, context);
    showWarnings(paper.warnings);
    resetScore(paper.totalQuestions);
    document.getElementById("stats-bar").hidden = false;
    syncStickyOffset();
    window.addEventListener("resize", syncStickyOffset);

    // 8. Restart button.
    document.getElementById("reset-btn").addEventListener("click", function () {
      if (Score.attempted > 0 && !confirm("Restart this paper? Your answers will be cleared.")) return;
      renderPaper(paper, container, context);
      resetScore(paper.totalQuestions);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  } catch (error) {
    console.error(error);
    showMessage("Sorry, something went wrong: " + error.message);
  }
}

startPractice();