// questions.js – turns CSV rows into a "paper" and validates it.
//
// A paper is: { items: [...], totalQuestions: number, warnings: [text, ...] }
// Each item is either
//   { type: "stimulus", id, instruction }   (a "Directions (6–10)…" row)
//   { type: "question", number, label, text, options:[{key,text}], answer, stimulusId, image, problem }

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

// "Q. No." -> "qno", "Option A" -> "optiona", "Stimulus ID" -> "stimulusid"
function normaliseHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Converts Hindi digits (०-९) to normal digits so ranges like (७६–८०) also work.
function toAsciiDigits(text) {
  return text.replace(/[०-९]/g, function (d) {
    return String(d.charCodeAt(0) - 0x0966);
  });
}

// Finds the question range in an instruction, e.g. "Directions (61–65)" -> {from:61, to:65}
function findRange(text) {
  const match = toAsciiDigits(text).match(/(\d+)\s*(?:–|—|-|to|से|and|&|और)\s*(\d+)/i);
  if (!match) return null;
  const from = parseInt(match[1], 10);
  const to = parseInt(match[2], 10);
  return to >= from ? { from: from, to: to } : null;
}

function buildPaper(rows) {
  if (rows.length < 2) {
    throw new Error("The file has no questions in it.");
  }

  // Which column is which (by header name, so column order does not matter).
  const headers = rows[0].map(normaliseHeader);
  ["qno", "question", "optiona", "optionb", "answer"].forEach(function (needed) {
    if (headers.indexOf(needed) === -1) {
      throw new Error("A required column is missing from the first row of the CSV: " + needed);
    }
  });

  const items = [];
  const warnings = [];
  const seenNumbers = {};
  let totalQuestions = 0;
  let currentStimulus = null; // the instruction row we are currently inside

  rows.slice(1).forEach(function (cells, index) {
    const rowNumber = index + 2; // roughly the spreadsheet row (row 1 = headings)

    // Put the cells into a record, e.g. record.question, record.optiona ...
    const record = {};
    headers.forEach(function (name, col) {
      record[name] = (cells[col] || "").trim();
    });

    const qnoText = record.qno;
    const text = record.question;

    // Empty row – ignore.
    if (!qnoText && !text) return;

    // ----- Instruction / stimulus row: blank Q.no but text in Question -----
    if (!qnoText && text) {
      const range = findRange(text);
      const id = record.stimulusid || (range ? "S" + range.from : "S-row" + rowNumber);
      currentStimulus = { id: id, from: range ? range.from : null, to: range ? range.to : null };
      items.push({ type: "stimulus", id: id, instruction: text });
      if (!range && !record.stimulusid) {
        warnings.push("Row " + rowNumber + ": could not find a question range like (6–10) in the instruction. " +
                      "It will apply to the questions that follow it, up to the next instruction.");
      }
      return;
    }

    // ----- Normal question row -----
    const number = parseInt(qnoText, 10);
    const label = isNaN(number) ? qnoText : String(number);

    if (!isNaN(number)) {
      if (seenNumbers[number]) {
        warnings.push("Question number " + number + " appears more than once (row " + rowNumber + ").");
      }
      seenNumbers[number] = true;
    } else {
      warnings.push("Row " + rowNumber + ": Q.no \"" + qnoText + "\" is not a number.");
    }

    if (!text) {
      warnings.push("Q" + label + ": the question text is empty. Skipped.");
      return;
    }

    // Collect only the options that actually have text (Option E is optional).
    const options = [];
    OPTION_LETTERS.forEach(function (letter) {
      const optionText = record["option" + letter.toLowerCase()];
      if (optionText) options.push({ key: letter, text: optionText });
    });

    // Check the answer key.
    const answer = (record.answer || "").toUpperCase();
    let problem = "";
    if (options.length < 2) {
      problem = "this question has fewer than 2 options";
    } else if (OPTION_LETTERS.indexOf(answer) === -1) {
      problem = "the answer key \"" + record.answer + "\" is not A, B, C, D or E";
    } else if (!options.some(function (o) { return o.key === answer; })) {
      problem = "the answer key " + answer + " points to an empty option";
    }
    if (problem) warnings.push("Q" + label + ": " + problem + ". It is shown but cannot be checked.");

    // Which instruction group does this question belong to?
    let stimulusId = record.stimulusid || null;
    if (!stimulusId && currentStimulus) {
      if (currentStimulus.from === null) {
        stimulusId = currentStimulus.id; // no range known: applies until the next instruction
      } else if (!isNaN(number) && number >= currentStimulus.from && number <= currentStimulus.to) {
        stimulusId = currentStimulus.id;
      } else {
        currentStimulus = null; // we are past the group's range
      }
    }

    items.push({
      type: "question",
      number: number,
      label: label,
      text: text,
      options: options,
      answer: answer,
      stimulusId: stimulusId,
      image: record.image || "",
      problem: problem
    });
    totalQuestions++;
  });

  if (totalQuestions === 0) {
    throw new Error("No valid questions were found in the file.");
  }
  return { items: items, totalQuestions: totalQuestions, warnings: warnings };
}