# TickRight.com

Single Website – Multiple Exams. Solved PYQs and topic-wise MCQs.

## How content works
Everything lives in `data/`. The website never needs editing to add content.
When you upload to GitHub, an automation scans `data/`, rebuilds `manifest.json`
and publishes the site.

## Add a new exam
Create `data/pyqs/<Exam-Name>/` then add paper folders inside it.
Folder names become display names: `UP-Police-Constable` shows as "UP Police Constable".

## Add a new PYQ paper
Create `data/pyqs/<Exam>/<Paper-Name>/` containing:
- `questions.csv`  (required)
- `stimuli.csv`    (optional: passages, tables, shared graphs)
- `images/`        (optional: graphs and figures)

## Add a new topic or part
Create `data/topics/<Topic>/<Part-Name>/questions.csv` (same format as above).

## questions.csv columns (row 1 = headings)
`Q. No.` | `Question` | `Option A` | `Option B` | `Option C` | `Option D` | `Option E` (optional) | `Answer` (A–E) | `Image` (optional)
- A row with a blank Q. No. and text in Question is an instruction row,
  e.g. "Directions (61–65): Study the following bar graph…". The range in
  brackets tells the site which questions belong to it.
- `Image` = a picture belonging to ONE question (file in the paper's `images/` folder).

## stimuli.csv columns (row 1 = headings)
`Stimulus ID` | `Instruction` | `Passage` | `Table` | `Image` | `Caption`
- Stimulus ID = letter S + first question number of the group (S61 for "(61–65)").
- Passage: new paragraph = Alt+Enter (Excel) or Ctrl+Enter (LibreOffice) inside the cell.
- Table: one table row per line, cells separated by `|`, first line = headings.
- Image: file name only. Several images: `a.png | b.png`.

## Saving CSV
Save as CSV with UTF-8 encoding (needed for Hindi). In LibreOffice:
File → Save As → Text CSV → tick "Edit filter settings" → UTF-8, comma, quote all text cells.

## Image rules
.png / .jpg / .jpeg / .webp. Use lowercase names without spaces.
The name in the CSV must match the file EXACTLY (capital letters matter online).

## Optional helper files (inside any folder)
- `name.txt`  – first line = display name (overrides the folder name)
- `order.txt` – folder names, one per line, in the order you want them shown

## Test on your computer
1. `python scripts/generate-manifest.py`
2. Right-click `index.html` → Open with Live Server

## Publish
Commit and push to the `main` branch. Check progress in the repository's Actions tab.