#!/usr/bin/env python3
"""Fix alpha 5.62 weapon detail charge denominators without touching any other code."""
from pathlib import Path
p=Path("split-alpha-5.62/index.html")
source=p.read_text(encoding="utf-8")
old="'/3\\n\\n※"
# The source contains a literal JavaScript string escape sequence, not newlines.
needle="c.charge+'/3\\n\\n※"
replacement="c.charge+'/'+originalWeapons[active].charge+'\\n\\n※"
assert source.count(needle)==2, f"Expected 2 detail labels, found {source.count(needle)}"
source=source.replace(needle,replacement)
assert source.count(replacement)==2
p.write_text(source,encoding="utf-8")
print("Updated both weapon detail charge labels to use configured weapon charge capacity")
