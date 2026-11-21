// home.js – builds the homepage buttons from manifest.json.

// Puts one red button for each item into a box.
// 'type' is "pyqs" or "topics"; it goes into the link so practice.html knows what to open.
function fillBox(containerId, items, type) {
  const box = document.getElementById(containerId);
  box.innerHTML = ""; // remove the "Loading…" text

  if (!items || items.length === 0) {
    box.innerHTML = '<p class="status">Coming soon</p>';
    return;
  }

  items.forEach(function (item) {
    const link = document.createElement("a");
    link.className = "pill";
    link.textContent = item.name; // textContent is safe against odd characters
    link.href = "practice.html?type=" + type + "&group=" + encodeURIComponent(item.id);
    box.appendChild(link);
  });
}

async function startHome() {
  try {
    const manifest = await loadManifest();
    fillBox("pyq-list", manifest.pyqs, "pyqs");
    fillBox("topic-list", manifest.topics, "topics");
  } catch (error) {
    console.error(error);
    const message = '<p class="status">Sorry, the list could not be loaded. Please try again later.</p>';
    document.getElementById("pyq-list").innerHTML = message;
    document.getElementById("topic-list").innerHTML = message;
  }
}

startHome();