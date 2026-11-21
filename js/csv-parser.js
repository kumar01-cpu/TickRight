// csv-parser.js – turns CSV text into a list of rows.
// Each row is a list of cell texts: [["Q. No.", "Question", ...], ["1", "Match...", ...], ...]
// Handles: quoted cells, commas inside cells, "" for a quote, line breaks inside
// cells, Windows/Mac/Linux line endings, and the BOM at the start of Excel files.

function parseCSV(text) {
  // Remove the invisible BOM character some programs put at the very start.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Guess the separator from the first line (comma is normal; some PCs use semicolon).
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delimiter = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // "" means one quote mark
        else { inQuotes = false; }                       // closing quote
      } else {
        field += ch; // any character, even a comma or line break
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;                                   // opening quote
    } else if (ch === delimiter) {
      row.push(field); field = "";                       // next cell
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;      // Windows line ending
      row.push(field); field = "";
      rows.push(row); row = [];                          // next row
    } else {
      field += ch;
    }
  }

  // Last cell/row if the file does not end with a line break.
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

  // Throw away completely empty rows.
  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ""; });
  });
}