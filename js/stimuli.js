// stimuli.js – reads stimuli.csv into a lookup table keyed by Stimulus ID.
//
// stimuli.csv columns (the first row must contain these headings):
//   Stimulus ID | Instruction | Passage | Table | Image | Caption
// Only "Stimulus ID" is required. Everything else is optional.

function buildStimuli(rows) {
  const map = {};
  if (rows.length < 2) return map;

  const headers = rows[0].map(normaliseHeader);
  if (headers.indexOf("stimulusid") === -1) {
    throw new Error("stimuli.csv needs a column called 'Stimulus ID' in its first row.");
  }

  rows.slice(1).forEach(function (cells) {
    const record = {};
    headers.forEach(function (name, col) {
      record[name] = (cells[col] || "").trim();
    });
    if (!record.stimulusid) return; // ignore rows without an ID

    map[record.stimulusid] = {
      instruction: record.instruction || "",  // optional: replaces the text from questions.csv
      passage: record.passage || "",
      table: record.table || "",
      images: splitList(record.image),
      caption: record.caption || ""
    };
  });
  return map;
}