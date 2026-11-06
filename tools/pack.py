#!/usr/bin/env python3
"""The site as one plain folder for a static host (Cloudflare Pages, or any): out/ in this repo (ignored by git).
It copies the site as written (no compiling: the files served are the files here), the three data files, and only
the pictures the data names, plus the thumbs and the share card, from the content folder (tools/content.py). The
content holds hundreds of MB of working frames the site never shows; they stay behind.
Then it checks the host's limits: Cloudflare Pages takes at most 20,000 files and 25 MiB a file.
    python3 tools/pack.py [--content PATH] [--url https://afterskool-search.pages.dev] [--listed]
--url     the live address, so the share card's picture is a full address (link previews need one)
--listed  let search engines index it. Without it, every page says noindex: right while friends and family look
          and before Mark has seen it."""
import re, shutil
from content import args, site

a = args(('--url', {'default': ''}), ('--listed', {'action': 'store_true'}))
url = a.url.rstrip('/')
out = site / 'out'
DATA = ['graphData.json', 'artworkAssetsData.json', 'transcriptsIndex.json', 'moments.json']   # all the page fetches
CODE = ['index.html', 'look.css', 'skool.css', 'favicon.svg', 'js', 'scene']   # this repo's part

if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in CODE:
    p = site / name
    (shutil.copytree if p.is_dir() else shutil.copy2)(p, out / name)

# the share card's picture, as a full address when the live one is known
if url:
    page = out / 'index.html'
    page.write_text(page.read_text().replace('content="share.jpg"', f'content="{url}/share.jpg"'))

# the data
(out / 'data').mkdir()
text = ''
for name in DATA:
    if not (a.content / 'data/site' / name).exists():
        continue   # moments.json is optional: the site manages without it
    shutil.copy2(a.content / 'data/site' / name, out / 'data' / name)
    if name not in ('transcriptsIndex.json', 'moments.json'):
        text += (a.content / 'data/site' / name).read_text()

# only the pictures the data names, then the thumbs (tools/thumbs.py) and the share card
public = a.content / 'public'
wanted = set(re.findall(r'"/((?:stills|assets)/[^"]+\.(?:jpg|jpeg|png|webp))"', text))
missing = []
for rel in sorted(wanted):
    src = public / rel
    if not src.exists():
        missing.append(rel)
        continue
    (out / rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, out / rel)
shutil.copytree(public / 'thumbs', out / 'thumbs')
shutil.copy2(public / 'share.jpg', out / 'share.jpg')

# Cloudflare Pages reads _headers. Pictures and the scene never change under the same name, so browsers keep them;
# the page, scripts and data are checked each visit, so a new version shows at once. Unlisted: noindex everywhere
headers = '' if a.listed else '/*\n  X-Robots-Tag: noindex\n'
headers += ''.join(f'/{d}/*\n  Cache-Control: public, max-age={"31536000, immutable" if d == "scene" else "2592000"}\n'
                   for d in ['scene', 'thumbs', 'stills', 'assets'])
(out / '_headers').write_text(headers)
if not a.listed:
    (out / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')

files = [p for p in out.rglob('*') if p.is_file()]
size = sum(p.stat().st_size for p in files)
biggest = max(files, key=lambda p: p.stat().st_size)
print(f'{len(files)} files, {size / 1e6:.1f} MB in {out}{"" if a.listed else " (unlisted: noindex)"}')
print(f'biggest: {biggest.relative_to(out)} {biggest.stat().st_size / 1e6:.1f} MB')
if missing:
    print(f'{len(missing)} pictures the data names are missing from the content, e.g. {missing[:3]}')
assert len(files) <= 20000, "over Cloudflare Pages' 20,000 files"
assert biggest.stat().st_size <= 25 * 1024 * 1024, "a file over Cloudflare Pages' 25 MiB"
