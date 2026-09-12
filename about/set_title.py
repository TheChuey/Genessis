"""Change the app title/subtitle shown as the H1 on index.html.

Usage:  python about/set_title.py [title [subtitle]]   (args optional;
        run with no args to edit interactively). about.json is read by the
        server on every request, so the new title shows after a refresh.
"""
import json, sys
from pathlib import Path

f = Path(__file__).parent / "about.json"
data = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
data.setdefault("title", "Genessis")
data.setdefault("subtitle", "Home")
args = sys.argv[1:]

for i, key in enumerate(("title", "subtitle")):
    value = args[i] if i < len(args) else None
    if value is None:
        try:
            value = input(f"{key} [{data[key]}]: ").strip()
        except EOFError:
            break
    if value:
        data[key] = value

f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Saved ->", data["title"])