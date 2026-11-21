// utils.js – small helpers used by several pages.

// Loads manifest.json (the auto-generated list of all exams, papers and topics).
async function loadManifest() {
  const response = await fetch("manifest.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error("Could not load manifest.json (status " + response.status + ")");
  }
  return response.json();
}

// Builds a safe path such as: data/pyqs/UPSSSC-PET/2026-25-Oct-Shift-2/questions.csv
// Each folder name is encoded so spaces or special characters cannot break the address.
function dataPath(type, groupId, itemId, fileName) {
  return ["data", type, groupId, itemId, fileName].map(encodeURIComponent).join("/");
}

// Path of a picture inside the paper's "images" folder.
function imagePath(type, groupId, itemId, fileName) {
  return ["data", type, groupId, itemId, "images", fileName].map(encodeURIComponent).join("/");
}

// Splits "a.png | b.png" (or "a.png; b.png") into a clean list of file names.
function splitList(text) {
  return (text || "").split(/[|;]/).map(function (s) { return s.trim(); })
                     .filter(function (s) { return s !== ""; });
}