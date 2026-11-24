// home.js – builds the homepage buttons from manifest.json.
// Only exams/topics that have at least one paper are shown.
// Each button opens the FIRST paper in its list (use order.txt to choose which one is first).

function fillBox(containerId, groups, type, listKey) {
  const box = document.getElementById(containerId);
  box.innerHTML = ""; // remove the "Loading…" text

  // Keep only groups that really contain papers/parts.
  const available = (groups || []).filter(function (group) {
    return group[listKey] && group[listKey].length > 0;
  });

  if (available.length === 0) {
    box.innerHTML = '<p class="status">Coming soon</p>';
    return;
  }

  available.forEach(function (group) {
    const first = group[listKey][0];
    const link = document.createElement("a");
    link.className = "pill";
    link.textContent = group.name; // textContent is safe against odd characters
    // Example: pyqs/UPSSSC-PET/2026-25-Oct-Shift-1/
    link.href = [type, group.id, first.id].map(encodeURIComponent).join("/") + "/";
    box.appendChild(link);
  });
}

async function startHome() {
  try {
    const manifest = await loadManifest();
    fillBox("pyq-list", manifest.pyqs, "pyqs", "papers");
    fillBox("topic-list", manifest.topics, "topics", "parts");
  } catch (error) {
    console.error(error);
    const message = '<p class="status">Sorry, the list could not be loaded. Please try again later.</p>';
    document.getElementById("pyq-list").innerHTML = message;
    document.getElementById("topic-list").innerHTML = message;
  }
}

startHome();