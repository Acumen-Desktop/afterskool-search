#!/usr/bin/env python3
"""Link the content into this folder so the site runs as written:
    python3 tools/link.py [--content PATH]        then: python3 -m http.server 3011   and open http://localhost:3011
The links are ignored by git (.gitignore): they point at a private folder on this computer."""
from content import args, site

a = args()
LINKS = {'data': 'data/site', 'stills': 'public/stills', 'assets': 'public/assets', 'thumbs': 'public/thumbs', 'share.jpg': 'public/share.jpg'}
for name, rel in LINKS.items():
    link, target = site / name, a.content / rel
    if link.is_symlink() or link.exists():
        link.unlink()
    link.symlink_to(target)
    print(f'{name} -> {target}{"" if target.exists() else "   (missing: run tools/thumbs.py)" if name == "thumbs" else "   (missing)"}')
