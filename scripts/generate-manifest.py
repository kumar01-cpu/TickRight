"""
generate-manifest.py
--------------------
Scans the "data" folder and writes "manifest.json".
The website reads manifest.json to build its buttons and dropdowns,
so you never have to edit any list by hand.

How to run (from the main TickRight folder):
    python scripts/generate-manifest.py

Folder rules:
    data/pyqs/<Exam>/<Paper>/questions.csv
    data/topics/<Topic>/<Part>/questions.csv

Optional helpers (plain text files):
    name.txt   inside any folder -> first line is used as the display name
    order.txt  inside any folder -> folder names, one per line, in the order you want
"""

import json
import re
from pathlib import Path

# The main project folder is one level above this "scripts" folder.
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUTPUT = ROOT / "manifest.json"


def natural_key(text):
    """Sorts 'Part-2' before 'Part-10' (normal sorting would get this wrong)."""
    return [int(piece) if piece.isdigit() else piece.lower()
            for piece in re.split(r"(\d+)", text)]


def read_lines(path):
    """Reads a small text file as a list of non-empty lines."""
    text = path.read_text(encoding="utf-8-sig")
    return [line.strip() for line in text.splitlines() if line.strip()]


def display_name(folder):
    """Nice name for a folder: 'UP-Police-Constable' -> 'UP Police Constable'.
    If the folder has a name.txt, its first line is used instead."""
    name_file = folder / "name.txt"
    if name_file.is_file():
        lines = read_lines(name_file)
        if lines:
            return lines[0]
    return re.sub(r"[-_]+", " ", folder.name).strip()


def sorted_subfolders(parent):
    """Subfolders in natural order, then adjusted by order.txt if present."""
    folders = [p for p in parent.iterdir()
               if p.is_dir() and not p.name.startswith(".")]
    folders.sort(key=lambda p: natural_key(p.name))

    order_file = parent / "order.txt"
    if order_file.is_file():
        wanted = read_lines(order_file)
        rank = {name: index for index, name in enumerate(wanted)}
        # Python's sort is stable: unlisted folders keep their natural order.
        folders.sort(key=lambda p: rank.get(p.name, len(wanted)))
    return folders


def has_file(folder, filename):
    """True only if the file exists with EXACTLY this capitalisation.
    (Windows ignores capitals but GitHub's servers do not, so we check strictly.)"""
    names = [p.name for p in folder.iterdir() if p.is_file()]
    if filename in names:
        return True
    for name in names:
        if name.lower() == filename.lower():
            print("  WARNING: '%s' should be named exactly '%s' in %s"
                  % (name, filename, folder.relative_to(ROOT).as_posix()))
    return False


def scan_section(section_dir, child_key):
    """Scans data/pyqs (child_key='papers') or data/topics (child_key='parts')."""
    result = []
    if not section_dir.is_dir():
        print("  Folder not found: " + section_dir.relative_to(ROOT).as_posix())
        return result

    for group in sorted_subfolders(section_dir):
        items = []
        for sub in sorted_subfolders(group):
            if not has_file(sub, "questions.csv"):
                print("  WARNING: skipped (no questions.csv): "
                      + sub.relative_to(ROOT).as_posix())
                continue
            items.append({
                "id": sub.name,
                "name": display_name(sub),
                "hasStimuli": has_file(sub, "stimuli.csv"),
            })
        result.append({"id": group.name,
                       "name": display_name(group),
                       child_key: items})
        print("  %s: %d item(s)" % (group.name, len(items)))
    return result


def main():
    print("Scanning PYQs...")
    pyqs = scan_section(DATA / "pyqs", "papers")
    print("Scanning topics...")
    topics = scan_section(DATA / "topics", "parts")

    manifest = {"pyqs": pyqs, "topics": topics}
    # ensure_ascii=False keeps Hindi/Unicode names readable in the file.
    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    print("Done. Wrote " + OUTPUT.name)


if __name__ == "__main__":
    main()