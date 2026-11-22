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

// Writes text into an element, turning [u]...[/u], [b]...[/b] and [i]...[/i]
// into real underline, bold and italic. Built with safe DOM elements (no innerHTML),
// so odd characters in your data can never break the page.
function appendRichText(parent, text) {
  const tagPattern = /\[(u|b|i)\]([\s\S]*?)\[\/\1\]/;
  const tagNames = { u: "u", b: "strong", i: "em" };
  let rest = text || "";

  while (rest.length > 0) {
    const match = rest.match(tagPattern);
    if (!match) {
      parent.appendChild(document.createTextNode(rest)); // no more tags
      return;
    }
    if (match.index > 0) {
      parent.appendChild(document.createTextNode(rest.slice(0, match.index)));
    }
    const element = document.createElement(tagNames[match[1]]);
    appendRichText(element, match[2]); // allows tags inside tags
    parent.appendChild(element);
    rest = rest.slice(match.index + match[0].length);
  }
}