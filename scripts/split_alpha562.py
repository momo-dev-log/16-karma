#!/usr/bin/env python3
"""Split the exact alpha 5.62 HTML into HTML + nine unchanged PNG assets."""
from pathlib import Path
import base64
import hashlib
import json
import re

SOURCE = Path("index.html")
TARGET = Path("split-alpha-5.62")
EXPECTED_SHA256 = "66225fefb3c00e2e640132e1c101dcf0e8ea02f23318f4a82eb0a5102954db0e"
raw = SOURCE.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA256, "Source is not the verified alpha 5.62"
pattern = re.compile(rb"data:image/png;base64,([A-Za-z0-9+/=]+)")
matches = list(pattern.finditer(raw))
assert len(matches) == 9, f"Expected nine embedded PNGs, found {len(matches)}"
TARGET.mkdir(exist_ok=True)
(TARGET / "assets").mkdir(exist_ok=True)
rewritten = raw
replacements = []
metadata = []
for i, match in enumerate(matches, 1):
    name = f"asset-{i:02d}.png"
    image = base64.b64decode(match.group(1), validate=True)
    assert image.startswith(b"\x89PNG\r\n\x1a\n"), f"{name} not PNG"
    (TARGET / "assets" / name).write_bytes(image)
    old = match.group(0)
    new = f"assets/{name}".encode("ascii")
    replacements.append((old, new))
    metadata.append({"name": name, "bytes": len(image), "sha256": hashlib.sha256(image).hexdigest()})
for old, new in replacements:
    assert rewritten.count(old) == 1
    rewritten = rewritten.replace(old, new)
(TARGET / "index.html").write_bytes(rewritten)
restored = rewritten
for old, new in replacements:
    assert restored.count(new) == 1
    restored = restored.replace(new, old)
assert restored == raw, "Round-trip verification failed"
report = {"source": "index.html (main alpha 5.62)", "source_sha256": EXPECTED_SHA256,
          "source_bytes": len(raw), "html_bytes": len(rewritten),
          "images": metadata, "reversible_exact": True}
(TARGET / "verification.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(report, ensure_ascii=False))
