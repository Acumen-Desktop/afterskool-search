// The videos a way in led to, as cards, with one row of Refine chips: words, length, years, transcript, drawing, and
// the order. Nothing unknown is invented: a video with no length or year shows none, and sorts last by either.
// A card opens its video; its drawing chips sit beside that button, never inside it (nothing clickable in clickable).
import { el, clock } from './el.js';
import { cat, credits, toneOf, waysIn, picture, scenes } from './catalog.js';

const LENGTHS = [
  { id: 'short', word: 'Under 10 min', fits: s => s < 600 },
  { id: 'mid', word: '10–20 min', fits: s => s >= 600 && s < 1200 },
  { id: 'long', word: 'Over 20 min', fits: s => s >= 1200 },
];
const ORDERS = [
  { id: 'new', word: 'Newest' }, { id: 'old', word: 'Oldest' }, { id: 'long', word: 'Longest' }, { id: 'short', word: 'Shortest' }, { id: 'az', word: 'A to Z' },
];
const known = (a, b, f) => (a == null) - (b == null) || (a == null ? 0 : f(a, b));   // unknown always last
const sorters = {
  new: (a, b) => known(a.upload_date, b.upload_date, (x, y) => y.localeCompare(x)),
  old: (a, b) => known(a.upload_date, b.upload_date, (x, y) => x.localeCompare(y)),
  long: (a, b) => known(a.duration, b.duration, (x, y) => y - x),
  short: (a, b) => known(a.duration, b.duration, (x, y) => x - y),
  az: (a, b) => a.title.localeCompare(b.title),
};

// what the person chose, in words, from the address (#videos?drawing=…)
function chosen(params) {
  const [kind, id] = [...params.entries()].find(([k]) => k in waysIn) || [];
  if (!kind) return { list: cat.videos, title: 'Every <em>video</em>' };
  const name = { drawing: () => cat.drawing.get(id)?.name, voice: () => cat.speaker.get(id)?.name, idea: () => cat.idea.get(id)?.name, topic: () => id, year: () => (waysIn.year(id).length ? id : null) }[kind]();
  if (!name) return { list: cat.videos, title: 'Every <em>video</em>' };
  const lead = { drawing: 'With the drawing', voice: 'With', idea: 'About', topic: 'About', year: 'Drawn in' }[kind];
  const tone = kind === 'idea' ? cat.idea.get(id)?.tone : kind === 'topic' ? cat.topics.findIndex(t => t.name === id) : null;
  const drawing = kind === 'drawing' ? cat.drawing.get(id) : null;
  const at = new Map((drawing?.occurrences || []).map(o => [o.video_id, o.timestamp]));
  return { drawing, at, list: waysIn[kind](id), title: `${lead} <em>${name.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</em>`, tone, back: { drawing: '#drawings', voice: '#people', idea: '#ideas', topic: '#ideas', year: '#mark' }[kind] };
}

// Hovering a card leafs through the video's scenes, so a half-remembered moment can be recognised without opening
// it. The scene pictures load only on the first hover (most cards are never hovered).
function leaf(still, v) {
  let layers = null, timer = 0, n = 0;
  still.addEventListener('pointerenter', () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    layers ||= scenes(v).map(s => {
      const img = el('img', { src: s.src, alt: '', decoding: 'async', className: 'scene' });
      img.onerror = () => img.remove();
      still.append(img);
      return img;
    });
    const step = () => { layers.forEach((l, i) => l.toggleAttribute('shown', i === n % layers.length)); n++; };
    step();
    timer = setInterval(step, 850);
  });
  still.addEventListener('pointerleave', () => { clearInterval(timer); n = 0; layers?.forEach(l => l.removeAttribute('shown')); });
}

export function card(v, open, { at } = {}) {
  const who = credits(v);
  const meta = [who.voice, v.year].filter(Boolean).join(' · ');   // the length is on the picture
  const art = (v.artwork_assets || []).filter(a => cat.drawing.has(a.id));
  const still = el('card-still', {}, v.still ? el('img', { ...picture(v), sizes: '(max-width: 760px) 100vw, 30vw', alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 360 }) : null,
    v.duration ? el('time', { textContent: clock(v.duration) }) : null);
  if (v.still) leaf(still, v);
  return el('video-card', { tone: toneOf(v) },
    el('button', { type: 'button', className: 'open', onclick: () => open(v.id, at || 0) },
      still,
      el('h3', { textContent: v.title }),
      meta && el('small', { textContent: meta }),
      at != null ? el('b', { className: 'at', textContent: `Opens where it appears, at ${clock(at)}` }) : null),
    art.length ? el('drawing-chips', { 'aria-label': 'Drawings in this video' }, ...art.slice(0, 3).map(a =>
      el('a', { href: `#videos?drawing=${encodeURIComponent(a.id)}`, title: a.name }, el('img', { src: a.image_jpg || cat.drawing.get(a.id).image_png, alt: a.name, loading: 'lazy' })))) : null);
}

// Refine's choices, kept while the person stays on the same way in (open a video, come back: still refined). A new
// way in starts clear, or a filter set for one drawing would quietly hide most of the next one's videos. The order
// is kept throughout: it's a taste, not a filter.
const CLEAR = { words: '', length: null, transcript: false, drawing: false, from: null, to: null };
const state = { ...CLEAR, order: 'new', for: '' };

export function videos(params, open) {
  const pick = chosen(params);
  if (state.for !== params.toString()) Object.assign(state, CLEAR, { for: params.toString() });
  const years = [...new Set(cat.videos.map(v => v.year).filter(Boolean))].sort();
  const grid = el('video-grid');
  const count = el('p', { className: 'count', 'aria-live': 'polite' });
  const words = el('input', { type: 'search', placeholder: 'Words in the title…', value: state.words, 'aria-label': 'Words in the title', autocomplete: 'off' });
  const chip = (word, on, toggle) => {
    const b = el('button', { type: 'button', className: 'chip', textContent: word, 'aria-pressed': String(!!on) });
    b.onclick = () => { toggle(); draw(); };
    return b;
  };
  const select = (label, options, value, set) => {
    const s = el('select', { 'aria-label': label }, ...options.map(([v, w]) => el('option', { value: v, textContent: w, selected: String(v) === String(value) })));
    s.onchange = () => { set(s.value); draw(); };
    return s;
  };
  const refine = el('refine-row', { role: 'group', 'aria-label': 'Refine' });
  function draw() {
    const q = state.words.trim().toLowerCase();
    let list = pick.list.filter(v =>
      (!q || v.title.toLowerCase().includes(q)) &&
      (!state.length || (v.duration != null && LENGTHS.find(l => l.id === state.length).fits(v.duration))) &&
      (!state.transcript || v.has_transcript) &&
      (!state.drawing || v.artwork_assets?.length) &&
      (!state.from || (v.year && v.year >= state.from)) &&
      (!state.to || (v.year && v.year <= state.to)));
    list = [...list].sort(sorters[state.order]);
    const on = state.words || state.length || state.transcript || state.drawing || state.from || state.to;
    refine.replaceChildren(...[
      words,
      ...LENGTHS.map(l => chip(l.word, state.length === l.id, () => { state.length = state.length === l.id ? null : l.id; })),
      chip('Has a transcript', state.transcript, () => { state.transcript = !state.transcript; }),
      chip('Has a drawing', state.drawing, () => { state.drawing = !state.drawing; }),
      select('From year', [['', 'Any year'], ...years.map(y => [y, `From ${y}`])], state.from ?? '', v => { state.from = v ? +v : null; }),
      select('To year', [['', 'to now'], ...years.map(y => [y, `to ${y}`])], state.to ?? '', v => { state.to = v ? +v : null; }),
      select('Order', ORDERS.map(o => [o.id, o.word]), state.order, v => { state.order = v; }),
      on ? el('button', { type: 'button', className: 'reset', textContent: 'Clear', onclick: () => { Object.assign(state, CLEAR); words.value = ''; draw(); } }) : null].filter(Boolean));
    count.textContent = list.length === pick.list.length ? `${list.length} ${list.length === 1 ? 'video' : 'videos'}` : `${list.length} of ${pick.list.length} videos`;
    grid.replaceChildren(...(list.length ? list.map(v => card(v, open, { at: pick.at?.get(v.id) })) : [el('p', { className: 'empty', textContent: 'Nothing fits all of that. Clear one of the choices above.' })]));
  }
  // typing waits a moment, then redraws (the box is the same node in the new row, so it keeps focus and caret)
  let typing;
  words.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { state.words = words.value; draw(); words.focus(); }, 120); });
  draw();
  return el('videos-moment', { tone: pick.tone ?? null },
    el('moment-head', {},
      pick.back ? el('a', { className: 'back', href: pick.back, textContent: '‹ Choose another' }) : null,
      pick.drawing ? el('pinned-drawing', {}, el('img', { src: pick.drawing.image_png, alt: pick.drawing.description || pick.drawing.name, drawn: true })) : null,
      el('h2', { innerHTML: pick.title }), count),
    refine, grid);
}
