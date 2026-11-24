"""
build-site.py
-------------
Turns your CSV files into ready-made HTML pages, so search engines (and Google
AdSense) can read every question as plain text.

Run from the main TickRight folder:
    python scripts/build-site.py

What it does:
  1. runs generate-manifest.py  (the list of exams, papers, topics)
  2. for every paper / topic part, reads questions.csv (+ stimuli.csv)
  3. writes   pyqs/<Exam>/<Paper>/index.html   and   topics/<Topic>/<Part>/index.html

Those two output folders are rebuilt every time. Never edit them by hand.
Warnings (e.g. a bad answer key) are printed here. A hard error stops the build.
"""

import csv
import html
import io
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

# Some Windows terminals cannot print Hindi unless we ask for UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ----- Things you may want to change -----
SITE_NAME = "TickRight.com"
TAGLINE = "Single Website – Multiple Exams"
CONTACT_EMAIL = "your-email@example.com"
# -----------------------------------------

OPTION_LETTERS = "ABCDE"
SECTIONS = {            # data folder name -> (name of the list in manifest, page heading suffix)
    "pyqs": ("papers", " Solved PYQs"),
    "topics": ("parts", ""),
}


class BuildError(Exception):
    """A problem serious enough that this paper cannot be built."""


# ---------------------------------------------------------------- CSV reading

def read_csv(path):
    """Reads a CSV file into a list of rows (each row is a list of cell texts)."""
    try:
        text = path.read_text(encoding="utf-8-sig")  # utf-8-sig removes Excel's invisible BOM
    except UnicodeDecodeError:
        raise BuildError("%s is not saved as UTF-8. Re-save it as CSV UTF-8." % path.name)
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    rows = list(csv.reader(io.StringIO(text, newline=""), delimiter=delimiter))
    return [r for r in rows if any(cell.strip() for cell in r)]


def normalise_header(header):
    """'Q. No.' -> 'qno', 'Option A' -> 'optiona', 'Stimulus ID' -> 'stimulusid'."""
    return re.sub(r"[^a-z0-9]", "", header.lower())


def to_ascii_digits(text):
    """Converts Hindi digits (०-९) to normal digits."""
    return text.translate({0x0966 + i: ord("0") + i for i in range(10)})


def find_range(text):
    """'Directions (61–65)' -> (61, 65). Returns None if no range is found."""
    match = re.search(r"(\d+)\s*(?:–|—|-|to|से|and|&|और)\s*(\d+)", to_ascii_digits(text), re.I)
    if not match:
        return None
    start, end = int(match.group(1)), int(match.group(2))
    return (start, end) if end >= start else None


def split_list(text):
    """'a.png | b.png' -> ['a.png', 'b.png']."""
    return [part.strip() for part in re.split(r"[|;]", text or "") if part.strip()]


# ------------------------------------------------- Reading questions and stimuli

def build_paper(rows, warn):
    """Turns questions.csv rows into a list of items (instruction rows and questions)."""
    if len(rows) < 2:
        raise BuildError("questions.csv has no questions in it.")

    headers = [normalise_header(h) for h in rows[0]]
    for needed in ("qno", "question", "optiona", "optionb", "answer"):
        if needed not in headers:
            raise BuildError("questions.csv is missing the column: %s" % needed)

    items, seen, total, current = [], set(), 0, None

    for index, cells in enumerate(rows[1:]):
        row_number = index + 2
        rec = {name: (cells[c].strip() if c < len(cells) else "")
               for c, name in enumerate(headers)}
        qno, text = rec.get("qno", ""), rec.get("question", "")

        if not qno and not text:
            continue

        # Instruction / stimulus row: blank Q.no but text in Question
        if not qno and text:
            rng = find_range(text)
            sid = rec.get("stimulusid") or ("S%d" % rng[0] if rng else "S-row%d" % row_number)
            current = {"id": sid, "from": rng[0] if rng else None, "to": rng[1] if rng else None}
            items.append({"type": "stimulus", "id": sid, "instruction": text})
            if not rng and not rec.get("stimulusid"):
                warn("Row %d: no question range like (6–10) found in the instruction. "
                     "It applies to the questions after it, until the next instruction." % row_number)
            continue

        # Normal question row
        m = re.match(r"\s*(\d+)", qno)
        number = int(m.group(1)) if m else None
        label = str(number) if number is not None else qno
        if number is not None:
            if number in seen:
                warn("Question number %d appears more than once (row %d)." % (number, row_number))
            seen.add(number)
        else:
            warn('Row %d: Q.no "%s" is not a number.' % (row_number, qno))

        if not text:
            warn("Q%s: the question text is empty. Skipped." % label)
            continue

        options = [(letter, rec.get("option" + letter.lower(), ""))
                   for letter in OPTION_LETTERS if rec.get("option" + letter.lower(), "")]

        answer = rec.get("answer", "").upper()
        problem = ""
        if len(options) < 2:
            problem = "this question has fewer than 2 options"
        elif answer not in OPTION_LETTERS:
            problem = 'the answer key "%s" is not A, B, C, D or E' % rec.get("answer", "")
        elif answer not in [k for k, _ in options]:
            problem = "the answer key %s points to an empty option" % answer
        if problem:
            warn("Q%s: %s. It is shown but cannot be checked." % (label, problem))

        sid = rec.get("stimulusid") or None
        if not sid and current:
            if current["from"] is None:
                sid = current["id"]
            elif number is not None and current["from"] <= number <= current["to"]:
                sid = current["id"]
            else:
                current = None

        items.append({"type": "question", "label": label, "text": text, "options": options,
                      "answer": answer, "stimulus_id": sid, "image": rec.get("image", ""),
                      "problem": problem})
        total += 1

    if total == 0:
        raise BuildError("No valid questions were found in questions.csv.")
    return items, total


def build_stimuli(rows):
    """Turns stimuli.csv rows into a dictionary keyed by Stimulus ID."""
    result = {}
    if len(rows) < 2:
        return result
    headers = [normalise_header(h) for h in rows[0]]
    if "stimulusid" not in headers:
        raise BuildError("stimuli.csv needs a column called 'Stimulus ID'.")
    for cells in rows[1:]:
        rec = {name: (cells[c].strip() if c < len(cells) else "")
               for c, name in enumerate(headers)}
        if not rec.get("stimulusid"):
            continue
        result[rec["stimulusid"]] = {
            "instruction": rec.get("instruction", ""),
            "passage": rec.get("passage", ""),
            "table": rec.get("table", ""),
            "images": split_list(rec.get("image", "")),
            "caption": rec.get("caption", ""),
        }
    return result


# ------------------------------------------------------------- HTML building

def esc(text):
    return html.escape(text or "", quote=True)


def rich(text):
    """Escapes text safely, then turns [u]..[/u] [b]..[/b] [i]..[/i] into real formatting."""
    out = esc(text)
    tags = {"u": "u", "b": "strong", "i": "em"}
    pattern = re.compile(r"\[(u|b|i)\](.*?)\[/\1\]", re.S)
    while True:  # repeat so nested tags work
        new = pattern.sub(lambda m: "<%s>%s</%s>" % (tags[m.group(1)], m.group(2), tags[m.group(1)]), out)
        if new == out:
            return out
        out = new


def render_table(table_text):
    lines = [l for l in table_text.splitlines() if l.strip()]
    rows = []
    for i, line in enumerate(lines):
        tag = "th" if i == 0 else "td"
        cells = "".join("<%s>%s</%s>" % (tag, rich(c.strip()), tag) for c in line.split("|"))
        rows.append("<tr>%s</tr>" % cells)
    return '<div class="table-wrap"><table class="data-table">%s</table></div>' % "".join(rows)


class PaperContext:
    """Knows where this paper's images are, and checks that they exist."""

    def __init__(self, section, group_id, item_id, root_prefix, warn):
        self.root_prefix = root_prefix
        self.base = "%s/%s/%s" % (section, group_id, item_id)
        self.warn = warn
        folder = DATA / section / group_id / item_id / "images"
        self.files = set(p.name for p in folder.iterdir()) if folder.is_dir() else set()

    def figure(self, filename, alt):
        if filename not in self.files:  # exact match, capital letters included
            self.warn('Image not found: "%s" (check the name, capitals and the images folder).' % filename)
        src = "%sdata/%s/images/%s" % (self.root_prefix, "/".join(quote(p) for p in self.base.split("/")),
                                       quote(filename))
        return ('<figure class="figure"><img src="%s" alt="%s" title="Click to enlarge" loading="lazy">'
                '</figure>' % (src, esc(alt)))


def render_question(q, ctx):
    attrs = 'data-number="%s"' % esc(q["label"])
    if not q["problem"]:
        attrs += ' data-answer="%s"' % q["answer"]
    parts = ['<article class="question" %s>' % attrs]
    # Keep this on ONE line: the CSS keeps line breaks inside question text.
    parts.append('<p class="q-text"><span class="q-num">Q%s.</span> %s</p>' % (esc(q["label"]), rich(q["text"])))
    for filename in split_list(q["image"]):
        parts.append(ctx.figure(filename, "Figure for question %s" % q["label"]))
    for key, text in q["options"]:
        parts.append('<button type="button" class="option" data-key="%s">'
                     '<span class="opt-key">%s)</span><span class="opt-text">%s</span></button>'
                     % (key, key, rich(text)))
    if q["problem"]:
        parts.append('<p class="q-problem">⚠ This question cannot be checked: %s.</p>' % esc(q["problem"]))
    parts.append("</article>")
    return "".join(parts)


def render_group(instruction, extra, ctx):
    """Returns (start_html, end_html). Questions are placed between them."""
    box = ['<section class="group"><div class="stimulus">']
    text = (extra and extra["instruction"]) or instruction
    if text:
        box.append('<p class="stimulus-text">%s</p>' % rich(text))
    if extra:
        if extra["passage"]:
            box.append('<div class="passage">%s</div>' % rich(extra["passage"]))
        if extra["table"]:
            box.append(render_table(extra["table"]))
        for filename in extra["images"]:
            box.append(ctx.figure(filename, "Shared figure for this group of questions"))
        if extra["caption"]:
            box.append('<p class="caption">%s</p>' % rich(extra["caption"]))
    box.append('</div><div class="group-questions">')
    return "".join(box), "</div></section>"


def render_body(items, stimuli, ctx):
    """Draws everything in the original order, with questions grouped under their instruction."""
    blocks = []      # each block is a standalone question or a group
    groups = {}      # stimulus id -> group block

    def open_group(sid, instruction):
        block = {"kind": "group", "id": sid, "instruction": instruction, "questions": []}
        blocks.append(block)
        groups[sid] = block

    for item in items:
        if item["type"] == "stimulus":
            open_group(item["id"], item["instruction"])
        else:
            sid = item["stimulus_id"]
            if sid and sid not in groups and sid in stimuli:
                open_group(sid, "")
            if sid and sid in groups:
                groups[sid]["questions"].append(item)
            else:
                blocks.append({"kind": "question", "q": item})

    out = []
    for block in blocks:
        if block["kind"] == "question":
            out.append(render_question(block["q"], ctx))
        else:
            start, end = render_group(block["instruction"], stimuli.get(block["id"]), ctx)
            out.append(start + "".join(render_question(q, ctx) for q in block["questions"]) + end)
    return "\n".join(out)


def render_page(root, title, description, heading, options_html, body_html, total):
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <link rel="stylesheet" href="{root}css/style.css">
</head>
<body>

  <header class="site-header">
    <a class="home-link" href="{root}index.html">⌂ Home</a>
    <h1 class="site-title">{site}</h1>
    <p class="site-tagline">{tagline}</p>
  </header>

  <main class="practice">
    <h2 class="title-bar">{heading}</h2>

    <div class="select-bar">
      <label for="item-select" class="visually-hidden">Choose a paper</label>
      <select id="item-select">{options}</select>
    </div>

    <div class="stats-bar" id="stats-bar">
      <div class="stats">
        <span>Total: <b id="stat-total">{total}</b></span>
        <span>Attempted: <b id="stat-attempted">0</b></span>
        <span class="good">Correct: <b id="stat-correct">0</b></span>
        <span class="bad">Incorrect: <b id="stat-incorrect">0</b></span>
        <button type="button" id="reset-btn" class="reset-btn">↻ Restart</button>
      </div>
      <div class="progress"><div class="progress-fill" id="progress-fill"></div></div>
    </div>

    <div id="questions">
{body}
    </div>
  </main>

  <footer class="site-footer">
    <p>
      Questions are compiled from examination sources and trusted references.
      Despite careful checking, factual errors may occasionally occur.
      If you spot a mistake, please report it to {email}.
    </p>
  </footer>

  <script src="{root}js/quiz.js"></script>
</body>
</html>
""".format(title=esc(title), description=esc(description), root=root, site=SITE_NAME,
           tagline=TAGLINE, heading=esc(heading), options=options_html, total=total,
           body=body_html, email=esc(CONTACT_EMAIL))


# ------------------------------------------------------------------ Main work

def build_one(section, group, item, list_key, suffix):
    """Builds one page. Returns the number of warnings."""
    label = "%s / %s / %s" % (section, group["id"], item["id"])
    warnings = []

    def warn(message):
        warnings.append(message)
        print("  WARNING [%s] %s" % (item["id"], message))

    folder = DATA / section / group["id"] / item["id"]
    items, total = build_paper(read_csv(folder / "questions.csv"), warn)

    stimuli = {}
    if item.get("hasStimuli"):
        stimuli = build_stimuli(read_csv(folder / "stimuli.csv"))

    known = set()
    for it in items:
        if it["type"] == "stimulus":
            known.add(it["id"])
        elif it["stimulus_id"]:
            known.add(it["stimulus_id"])
    for sid in stimuli:
        if sid not in known:
            warn('stimuli.csv: Stimulus ID "%s" matches no instruction row in questions.csv '
                 '(IDs look like S61: the letter S plus the first question number).' % sid)

    root = "../../../"   # pages sit 3 folders deep: section / group / item
    ctx = PaperContext(section, group["id"], item["id"], root, warn)
    body = render_body(items, stimuli, ctx)

    options = "".join('<option value="../%s/"%s>%s</option>'
                      % (quote(other["id"]), " selected" if other["id"] == item["id"] else "", esc(other["name"]))
                      for other in group[list_key])
    heading = group["name"] + suffix
    title = "%s – %s | %s" % (item["name"], heading, SITE_NAME)
    description = "Practice %d questions from %s (%s) with instant answer checking. Free on %s." % (
        total, item["name"], group["name"], SITE_NAME)

    out_dir = ROOT / section / group["id"] / item["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(
        render_page(root, title, description, heading, options, body, total), encoding="utf-8")
    print("  built %s  (%d questions)" % (label, total))
    return len(warnings)


def main():
    # 1. Refresh the manifest first.
    subprocess.run([sys.executable, str(ROOT / "scripts" / "generate-manifest.py")], check=True)
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))

    # 2. Clear the old generated pages (only folders that this script made).
    for section in SECTIONS:
        out = ROOT / section
        if out.exists():
            if not (out / ".generated").exists():
                print("ERROR: %s exists but was not made by this script. Not touching it." % out)
                sys.exit(1)
            shutil.rmtree(out)
        out.mkdir()
        (out / ".generated").write_text("Made by scripts/build-site.py. Safe to delete.\n")

    # 3. Build every paper and topic part.
    pages = warnings = errors = 0
    print("\nBuilding pages...")
    for section, (list_key, suffix) in SECTIONS.items():
        for group in manifest.get(section, []):
            for item in group.get(list_key, []):
                try:
                    warnings += build_one(section, group, item, list_key, suffix)
                    pages += 1
                except (BuildError, OSError) as error:
                    errors += 1
                    print("  ERROR [%s / %s / %s] %s" % (section, group["id"], item["id"], error))

    print("\nDone: %d page(s) built, %d warning(s), %d error(s)." % (pages, warnings, errors))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()