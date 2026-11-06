#!/usr/bin/env python3
"""Small copies of each video's still, for the cards and the sky: 640 px wide WebP, about a fifth of the 1280 px
original's weight. The cards ask for the original only on screens sharp and wide enough to need it (srcset).
Also each video's three scenes (public/stills/milestones: frames at 25, 50 and 75% through) at 480 px, for the
cards' hover and the reader's storyboard: thumbs/scenes/<id>_25.webp and so on.
They're made from Mark's pictures, so they're written into the content folder (public/thumbs), not this repo.
Run after the data scripts change the stills:  python3 tools/thumbs.py [--content PATH]"""
import json
from PIL import Image
from content import args

a = args()
public = a.content / 'public'
out = public / 'thumbs'
out.mkdir(exist_ok=True)
videos = json.load(open(a.content / 'data/site/graphData.json'))['videos']
made = 0
for v in videos:
    src = public / v['still'].lstrip('/') if v.get('still') else None
    dst = out / f"{v['id']}.webp"
    if not src or not src.exists() or (dst.exists() and dst.stat().st_mtime > src.stat().st_mtime):
        continue
    im = Image.open(src).convert('RGB')
    im.thumbnail((640, 360))
    im.save(dst, 'WEBP', quality=78, method=6)
    made += 1
scenes = out / 'scenes'
scenes.mkdir(exist_ok=True)
for src in sorted((public / 'stills/milestones').glob('*_stage_*.jpg')):
    vid, at = src.stem.rsplit('_stage_', 1)
    dst = scenes / f'{vid}_{at}.webp'
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        continue
    im = Image.open(src).convert('RGB')
    im.thumbnail((480, 270))
    im.save(dst, 'WEBP', quality=74, method=6)
    made += 1
print(f'{made} made, {len(list(out.glob("*.webp")))} in {out}')
