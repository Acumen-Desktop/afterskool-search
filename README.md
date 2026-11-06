# After Skool, half remembered

A fan-made way back into [After Skool](https://www.youtube.com/@AfterSkool)'s videos, for when you half remember one.
You start from whatever stuck with you: a drawing, a name, an idea, or something that was said. It's a tribute to
Mark Wooding's drawings, made with love. It isn't affiliated with After Skool and makes no money; every video plays
from his channel. [Support Mark on Patreon](https://www.patreon.com/AfterSkool).

Live (unlisted for now): https://afterskool-search.pages.dev

## What it does
- **A drawing:** Mark's drawings on a pinboard, each drawing itself as it comes into view. Turn one over to see which
  video it's from and when. Not on the board? Describe it: the pictures described in the transcripts ("a king
  counting his gold") open their video at that second.
- **A name:** the narrators and the thinkers they talk about, as a wall of names.
- **An idea:** four topics with four ideas each, a 4x4.
- **Something said:** one box over the transcripts; each line opens its video right where it's said.
- **The reader:** the video beside its words, which follow along, plus its scenes and drawings as jumps.
- **For Mark:** the years of After Skool as a trail across the desert.

## How it's made
It's made the way [4x4](https://4x4desk.app) makes its pages, with no framework and no build step:
- HTML elements named for what they are (`video-card`, `drawing-shelf`, `topic-zone`);
- plain JavaScript modules;
- one stylesheet of 4x4's design tokens (`look.css`): golden hour by day, last light by night;
- 4x4's sandstone desert behind everything.

Two effects use [HTML in Canvas](https://github.com/WICG/html-in-canvas) where the browser has it (Chrome 157 on):
headings written in by a pen (`js/ink.js`), and a heading blowing away as sand on the way home (`js/sand.js`). Every
other browser gets a plain version.

## Running it
The code is here. The data and the pictures are not: they're Mark's work, kept in a separate private folder. The
tools find it with `--content PATH`, or `$AFTERSKOOL_CONTENT`, or `../after-skool` beside this repo. That folder holds
`data/site/*.json` and `public/` (stills, assets, thumbs, share.jpg).

    python3 tools/link.py                 # link the content in (ignored by git)
    python3 tools/thumbs.py               # small copies of the pictures, once (needs Pillow)
    python3 -m http.server 3011           # then open http://localhost:3011

**Putting it online:** `python3 tools/pack.py --url https://afterskool-search.pages.dev` makes `out/`, which holds
the site, the data and only the pictures it uses (about 1,350 files, 84 MB). It's unlisted unless `--listed` is
given. Then:

    npx wrangler pages deploy            # wrangler.jsonc names the project and out/

It's a classic Pages project (made with `wrangler pages project create --force`, since newer Wrangler otherwise
makes a Worker), which is what gives it the `pages.dev` address.

## What's where
- **Skeleton and look:**
  - `index.html`: the skeleton (`desert-scene`, `memory-sky`, `top-bar`, `main`, `site-footer`).
  - `look.css`: 4x4's light and sizes. `skool.css`: this site's look, by element name.
- **The moments:**
  - `js/main.js`: one moment at a time, from the address (`#`, `#drawings`, `#people`, `#ideas`, `#said`, `#mark`,
    `#videos?…`); the page's one ⌘K listener.
  - `js/arrival.js`: the four doors. `js/doors.js`: the pinboard, the names, the 4x4, the search through what was
    said. `js/tribute.js`: the trail of years.
  - `js/videos.js`: the cards and Refine.
  - `js/reader.js`: the player and its words. `js/search.js`, `js/about.js`: the sheets.
- **The effects:** `js/ink.js` (the pen), `js/sand.js` (the sand), `js/draw.js` (drawings drawing themselves).
- **Data:** `js/catalog.js`, everything from the data; every count and name on the page comes from it. That includes
  the moments graph (`data/moments.json`: people, pictures and ideas from the transcripts, each at a second).
- **Tools:** `tools/`: link, thumbs and pack.
