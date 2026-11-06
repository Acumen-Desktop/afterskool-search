// Search, from anywhere: ⌘K or Ctrl K (the page's only shortcut listener, in main.js), or the top bar's button.
// One box over people, ideas, drawings and videos at once, and what was said once three letters are typed (that is
// when the transcripts load). Arrow keys move, Enter opens, Escape closes; all from the keyboard.
import { el, clock } from './el.js';
import { cat, findLines, thumb } from './catalog.js';
import { mark } from './doors.js';

const dialog = el('dialog', { className: 'search', 'aria-label': 'Search' });
const box = el('input', { type: 'search', placeholder: 'A name, an idea, a drawing, a title, words said…', 'aria-label': 'Search', autocomplete: 'off', spellcheck: false, role: 'combobox', 'aria-controls': 'found', 'aria-expanded': 'true' });
const found = el('ol', { id: 'found', role: 'listbox', 'aria-label': 'Found' });
const hint = el('p', { className: 'note' });
dialog.append(el('search-sheet', {}, box, hint, found));
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

let go = () => {}, picks = [], at = 0, asked = 0;
const has = (s, q) => s?.toLowerCase().includes(q);
// "AW" for Alan Watts; titles like Dr. and Prof. are skipped
const initials = name => name.replace(/\b(Dr|Prof|Sir)\.?\s/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).filter(c => /\p{L}/u.test(c)).slice(0, 2).join('');

// the highlighted row: the keyboard's place in the list, also followed by the mouse

function choose(i) {
  at = Math.max(0, Math.min(picks.length - 1, i));
  picks.forEach((p, n) => p.node.setAttribute('aria-selected', String(n === at)));
  const now = picks[at];
  if (now) { box.setAttribute('aria-activedescendant', now.node.id); now.node.scrollIntoView({ block: 'nearest' }); }
}

async function look() {
  const q = box.value.trim().toLowerCase(), ask = ++asked;
  if (!q) { picks = []; found.replaceChildren(); hint.textContent = `${cat.speakers.length} people, ${cat.ideas.length} ideas, ${cat.drawings.length} drawings, ${cat.videos.length} videos.`; return; }
  const groups = [
    ['People', cat.speakers.filter(s => has(s.name, q)).slice(0, 5).map(s => ({ word: s.name, more: `${s.video_count || 0} videos`, initials: initials(s.name), run: () => go(`#videos?voice=${encodeURIComponent(s.id)}`) }))],
    ['Ideas', cat.ideas.filter(i => has(i.name, q) || has(i.topic, q)).slice(0, 5).map(i => ({ word: i.name, more: i.topic, tone: i.tone, run: () => go(`#videos?idea=${encodeURIComponent(i.id)}`) }))],
    ['Drawings', cat.drawings.filter(d => has(d.name, q) || has(d.family_name, q) || has(d.description, q)).slice(0, 5).map(d => ({ word: d.name, more: d.family_name, img: d.image_png, run: () => go(`#videos?drawing=${encodeURIComponent(d.id)}`) }))],
    ['Videos', cat.videos.filter(v => has(v.title, q)).slice(0, 8).map(v => ({ word: v.title, more: [v.year, v.duration && clock(v.duration)].filter(Boolean).join(' · '), img: thumb(v), run: () => go(null, v.id, 0) }))],
  ];
  // drawn twice: at once from the catalogue, then again when the transcripts answer. A newer keystroke wins: an
  // older answer arriving late is dropped (ask !== asked)
  const draw = lines => {
    if (ask !== asked) return;
    const all = lines ? [...groups, ['Said', lines.slice(0, 8).map(l => ({ word: l.text, quote: true, more: `${l.video.title} · ${clock(l.start)}`, run: () => go(null, l.video.id, l.start) }))]] : groups;
    picks = [];
    found.replaceChildren(...all.filter(([, list]) => list.length).map(([name, list]) => el('li', { role: 'presentation' },
      el('b', { textContent: name }),
      el('ul', { role: 'presentation' }, ...list.map(p => {
        p.node = el('li', { role: 'option', id: `found-${picks.length}`, tone: p.tone ?? null, onclick: p.run, onmousemove: () => choose(picks.indexOf(p)) },
          p.img ? el('img', { src: p.img, alt: '', loading: 'lazy' }) : p.initials ? el('i', { textContent: p.initials, 'aria-hidden': 'true' }) : null,
          el(p.quote ? 'q' : 'span', { innerHTML: mark(p.word, q) }),
          el('small', { textContent: p.more }));
        picks.push(p);
        return p.node;
      })))));
    hint.textContent = picks.length ? '↑ ↓ to move, Enter to open' : q.length < 3 ? 'Keep typing…' : 'Nothing found. Try fewer or other words.';
    choose(0);
  };
  draw(null);
  if (q.length >= 3) draw(await findLines(q, 8).catch(() => []));
}

let timer;
box.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(look, 90); });
box.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); choose(at + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); choose(at - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); picks[at]?.run(); }
});

// to: an address to go to; or a video and second to open
export function openSearch(navigate, open) {
  go = (to, id, s) => { dialog.close(); if (to) navigate(to); else open(id, s); };
  if (!dialog.isConnected) document.body.append(dialog);
  if (dialog.open) { box.select(); return; }
  dialog.showModal();
  box.select();
  look();
}
