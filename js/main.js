// The page: one moment at a time, and the address says which (Back goes back a moment).
//   #             arrival: one line, four doors
//   #drawings  #people  #ideas  #said     a door, filling the screen (#voices: the old name for #people)
//   #mark         ten years of After Skool, for the man who drew it
//   #videos?drawing=…|voice=…|idea=…|topic=…   the videos it led to (plain #videos: all of them)
// A video opens in the reader over whatever moment it was found from. ⌘K / Ctrl K opens search: the page's one
// shortcut listener (architecture.md).
import { el, motion, pause, still } from './el.js';
import { loadCatalog } from './catalog.js';
import { arrival, fillSky } from './arrival.js';
import { drawings, people, ideas, said } from './doors.js';
import { tribute } from './tribute.js';
import { videos } from './videos.js';
import { openReader } from './reader.js';
import { openSearch } from './search.js';
import { openAbout } from './about.js';
import { ink } from './ink.js';
import { watch } from './draw.js';
import { sand, canSand } from './sand.js';

// Everything scales with the window: 4x4's --size (look.css), set from the width so a 4K screen at 100% gets a page
// as full as a laptop's, and a phone a smaller one. Laid out for about 1700 CSS px wide; never under .72, and at most 1.8 so a 4K screen keeps room around it.
const fit = () => {
  const w = innerWidth, size = w < 760 ? 0.72 : Math.min(1.8, Math.max(0.8, w / 1700));
  document.documentElement.style.setProperty('--size', size.toFixed(3));
};
fit();
addEventListener('resize', fit);

const main = document.querySelector('main');
const sky = document.querySelector('memory-sky');
const open = (id, at) => openReader(id, at);
const navigate = to => { if (location.hash === to) route(); else location.hash = to; };

function moment(hash) {
  const [name, query] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query || '');
  switch (name) {
    case 'drawings': return drawings(open);
    case 'people': case 'voices': return people();
    case 'ideas': return ideas();
    case 'said': return said(open);
    case 'mark': return tribute();
    case 'videos': return videos(params, open);
    default: return arrival();
  }
}

let turn = 0;
// the pen writes a moment's heading the first time it's seen on this visit; coming back, it's simply there
const written = new Set();
async function route() {
  const mine = ++turn;
  for (const d of document.querySelectorAll('dialog[open]')) d.close();   // a new moment: no sheet left over it
  const next = moment(location.hash);
  const home = next.localName === 'arrival-moment';
  document.documentElement.toggleAttribute('home', home);
  if (home) fillSky(sky, open);
  // the old moment leaves upward, the new one's heading is written in, then its parts rise one by one
  const old = main.firstElementChild?.localName?.endsWith('-moment') ? main.firstElementChild : null;
  const oldHead = old?.querySelector('h1, h2');
  // going home from a door: its heading blows away as sand into the arrival's line (sand.js), where it can
  const blow = home && oldHead && canSand() && scrollY < 40;   // only from the top: the line forms at the top
  if (blow) {
    // the old moment stays where it is, out of the flow, while the arrival lays out under it
    const top = old.getBoundingClientRect().top + scrollY - main.getBoundingClientRect().top - scrollY;
    Object.assign(old.style, { position: 'absolute', left: '0', right: '0', top: `${top}px`, pointerEvents: 'none' });
    for (const c of old.children) if (!c.contains(oldHead)) motion(c, { opacity: [1, 0] }, { duration: 300 });
  } else if (old) await motion(old, { opacity: [1, 0], translate: ['0 0', '0 -2vh'] }, { duration: 240 });
  if (mine !== turn) return;
  if (!blow) window.scrollTo(0, 0);
  const head = next.querySelector('h1, h2');
  const parts = [...next.children].filter(c => !c.contains(head));
  if (head) head.style.opacity = '0';
  parts.forEach(p => { p.style.opacity = '0'; });
  if (blow) main.append(next); else main.replaceChildren(next);
  watch(next);   // Mark's drawings on this moment draw themselves as they come into view
  document.title = head ? `${head.textContent.replace(/[.?]$/, '')} · After Skool, half remembered` : 'After Skool, half remembered';
  // the heading's siblings in the head come in with it
  const headParts = head?.parentElement !== next ? [...head.parentElement.children].filter(c => c !== head) : [];
  headParts.forEach(p => { p.style.opacity = '0'; });
  // the arrival is the one moment where the pen is the point: everything waits for it. Elsewhere the parts rise while
  // the heading is still being written, so a door opens without a wait
  let writing;
  if (blow) {
    const layer = document.body.appendChild(el('sand-layer'));
    writing = sand(oldHead, head, layer).then(played => (played ? null : ink(head))).then(() => { head.style.opacity = ''; old.remove(); layer.remove(); scrollTo(0, 0); });
  } else if (head && written.has(location.hash)) {
    writing = Promise.resolve().then(() => { head.style.opacity = ''; return motion(head, { opacity: [0, 1] }, { duration: 300 }); });
  } else writing = head ? pause(home ? 500 : 60).then(() => ink(head, { speed: home ? 1 : 1.5 })).then(() => { head.style.opacity = ''; }) : null;
  written.add(location.hash);
  if (home) await writing; else await pause(250);
  if (mine !== turn) return;
  headParts.forEach(p => { p.style.opacity = ''; motion(p, { opacity: [0, 1] }, { duration: 400 }); });
  await Promise.all([writing, ...parts.map((p, i) => { p.style.opacity = ''; return motion(p, { opacity: [0, 1], translate: ['0 3vh', '0 0'] }, { delay: i * 110, duration: 620 }); })]);
  // moving focus to the heading tells a screen reader where it is now, without moving the view
  if (!home) { head?.setAttribute('tabindex', '-1'); head?.focus({ preventScroll: true }); }
}

// the one shortcut listener
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(navigate, open); }
});
document.querySelector('top-bar .search').onclick = () => openSearch(navigate, open);
document.querySelector('top-bar .about').onclick = () => openAbout();
if (!/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelector('top-bar kbd').textContent = 'Ctrl K';

try {
  await loadCatalog();
  addEventListener('hashchange', route);
  route();
} catch (e) {
  main.replaceChildren(el('arrival-moment', {}, el('h1', { textContent: 'The index didn’t load.' }),
    el('p', { className: 'lead', textContent: `Reload the page to try again. (${e.message})` })));
}
if (still.matches) document.documentElement.setAttribute('still', '');
