// The page: one moment at a time, and the address says which (Back goes back a moment).
//   #             arrival: one line, four doors
//   #drawings  #people  #ideas  #said     a door, filling the screen (#voices: the old name for #people)
//   #mark         ten years of After Skool, for the man who drew it
//   #videos?drawing=…|voice=…|idea=…|topic=…   the videos it led to (plain #videos: all of them)
// A video opens in the reader over whatever moment it was found from. ⌘K / Ctrl K opens search: the page's one
// shortcut listener (architecture.md).
import { el, motion, pause, still } from './el.js';
import { loadCatalog } from './catalog.js';
import { arrival, fillSky, drift, small } from './arrival.js';
import { drawings, people, ideas, said } from './doors.js';
import { tribute } from './tribute.js';
import { videos } from './videos.js';
import { openReader, watching, readerOpen } from './reader.js';
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
// a move to another moment: a new history entry, then the page follows it (as it does for Back and Forward)
const navigate = to => { if (location.pathname + location.hash !== `/${to}`) history.pushState(null, '', `/${to}`); route(); };

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
// moments seen on this visit: coming back to one, its sand blows quicker
const seen = new Set();
// The page follows the address: a moment from its #, and a video from /watch/… (reader.js) over the moment that
// entry remembers. Called on every history move (popstate: links, Back, Forward) and after each push
let shownKey = null;
async function route() {
  const mine = ++turn;
  const w = watching();
  const key = w ? history.state?.under ?? shownKey ?? '' : location.hash;
  if (!w) for (const d of document.querySelectorAll('dialog[open]')) d.close();   // a new moment: no sheet left over it
  // the same moment already showing (the reader closed or reopened over it): leave it be
  if (key === shownKey && main.firstElementChild?.localName?.endsWith('-moment')) {
    if (w && !readerOpen()) openReader(w.id, w.at, { push: false });
    return;
  }
  shownKey = key;
  const next = moment(key);
  const home = next.localName === 'arrival-moment';
  document.documentElement.toggleAttribute('home', home);
  if (home) { fillSky(sky, open); drift(sky); }
  // Every heading arrives as sand (sand.js, James 2026-11-05: "use the blowing sand for intro and outro"). From the
  // top of a moment, the old heading blows away into the new one; on the first visit, or from far down a page, the
  // new one blows in from the desert floor. Without HTML in Canvas, the heading wipes in (ink.js)
  const old = main.firstElementChild?.localName?.endsWith('-moment') ? main.firstElementChild : null;
  const oldHead = old?.querySelector('h1, h2');
  const sandy = canSand();
  const blow = sandy && oldHead && scrollY < 40;
  if (blow) {
    // the old moment stays where it is, out of the flow, while the new one lays out under it
    const top = old.getBoundingClientRect().top - main.getBoundingClientRect().top;
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
  if (w && !readerOpen()) openReader(w.id, w.at, { push: false });   // Back onto a video: it opens again, where it was
  document.title = head ? `${head.textContent.replace(/[.?]$/, '')} · After Skool, half remembered` : 'After Skool, half remembered';
  // the heading's siblings in the head come in with it
  const headParts = head?.parentElement !== next ? [...head.parentElement.children].filter(c => c !== head) : [];
  headParts.forEach(p => { p.style.opacity = '0'; });
  // the arrival waits for its sand: it's the moment. Elsewhere the parts rise while the sand is still settling
  const back = seen.has(key);
  seen.add(key);
  const duration = home ? (old ? 2400 : 2800) : back ? 1300 : 1800;
  let writing = null;
  if (head && sandy) {
    const layer = document.body.appendChild(el('sand-layer'));
    writing = pause(old ? 0 : 400)   // the first visit: a beat for the desert to be seen first
      .then(() => sand(blow ? oldHead : null, head, layer, { duration }))
      .then(played => (played ? null : ink(head)))
      .then(() => { head.style.opacity = ''; layer.remove(); if (blow) { old.remove(); scrollTo(0, 0); } });
  } else if (head) writing = ink(head).then(() => { head.style.opacity = ''; });
  else if (blow) old.remove();
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
  addEventListener('popstate', route);   // links within the page, Back and Forward (a # link fires it too)
  // a shared link to a video (?watch=…): the moment under it, then the reader over it. The address without the video
  // goes first in the history, so closing the reader leaves the page behind it, as if the person had opened it here
  const shared = watching();
  if (shared) history.replaceState(null, '', `/${location.hash}`);
  route();
  if (shared) openReader(shared.id, shared.at);
} catch (e) {
  main.replaceChildren(el('arrival-moment', {}, el('h1', { textContent: 'The index didn’t load.' }),
    el('p', { className: 'lead', textContent: `Reload the page to try again. (${e.message})` })));
}
if (still.matches) document.documentElement.setAttribute('still', '');
if (small()) document.documentElement.setAttribute('calm', '');   // a small computer: the sky stands still (arrival.js)
