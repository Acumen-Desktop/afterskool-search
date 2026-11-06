// The four doors, each one moment that fills the screen.
//   drawings()  a pinboard of the cut-out drawings, in their families. A drawing turns over to show where it appears
//               in the videos, to the second: the fastest way from "that ape with the mushroom" to the moment itself
//   people()    everyone the videos are linked to, as a wall of names, bigger for more videos. Most are thinkers a
//               video talks about, not its narrator (voice_credits, reviewed, are few), so the door says "a name"
//   ideas()     the 4x4: four topics in 4x4's four zone colours, four ideas each
//   said()      one box that looks through what was said in the transcripts (loaded only now: they are about 1 MB)
import { el, clock, shuffled } from './el.js';
import { cat, waysIn, transcripts, findLines, thumb, when } from './catalog.js';

const heading = (text, lead) => [el('h2', { innerHTML: text }), lead && el('p', { className: 'lead', textContent: lead })];

export function drawings(open) {
  let tilt = 0;
  const card = d => {
    const t = (((tilt++ * 47) % 9) - 4) * 0.7;
    const seen = d.occurrences || [];
    const front = el('button', { type: 'button', className: 'front', 'aria-expanded': 'false', 'aria-label': `${d.name}: show where it appears` },
      el('img', { src: d.image_png, alt: d.description || d.name, width: d.width || 600, height: d.height || 600, decoding: 'async', drawn: true }),
      el('span', { className: 'name', textContent: d.name }));
    const back = el('card-back', {},
      el('b', { textContent: 'Seen in' }),
      el('ul', {}, ...seen.map(o => el('li', {}, el('button', { type: 'button', onclick: () => open(o.video_id, o.timestamp ?? 0) },
        el('time', { textContent: when(o) }), el('span', { textContent: cat.video.get(o.video_id)?.title || o.title }))))),
      el('a', { href: `#videos?drawing=${encodeURIComponent(d.id)}`, textContent: `All ${waysIn.drawing(d.id).length} videos with it` }),
      el('button', { type: 'button', className: 'turn', textContent: 'Turn back' }));
    const node = el('drawing-card', { style: `--tilt:${t}deg` }, el('card-turn', {}, front, back));
    const flip = to => {
      node.toggleAttribute('turned', to);
      front.setAttribute('aria-expanded', String(to));
      (to ? back.querySelector('button') : front).focus({ preventScroll: true });
    };
    front.onclick = () => flip(true);
    back.querySelector('.turn').onclick = () => flip(false);
    node.addEventListener('keydown', e => { if (e.key === 'Escape' && node.hasAttribute('turned')) { e.stopPropagation(); flip(false); } });
    return node;
  };
  return el('door-moment', { door: 'drawings' },
    ...heading('Which <em>drawing</em>?', 'Turn one over to see which video it’s from, and when.'),
    el('drawing-shelf', {}, ...cat.families.map(f => el('drawing-family', {},
      el('h3', { textContent: f.name }),
      el('family-cards', {}, ...f.samples.map(card))))));
}

export function people() {
  const most = Math.max(...cat.speakers.map(s => s.video_count || 0), 1);
  return el('door-moment', { door: 'people' },
    ...heading('Whose <em>name</em>?', 'The voices, and the thinkers they talk about. Bigger names have more videos.'),
    el('name-wall', {}, ...shuffled(cat.speakers, 'voices').map(s => {
      const n = s.video_count || 0, k = Math.log(n + 1) / Math.log(most + 1);
      return el('a', { href: `#videos?voice=${encodeURIComponent(s.id)}`, style: `--k:${k.toFixed(3)}`, 'aria-label': `${s.name}, ${n} videos` },
        el('span', { textContent: s.name }), el('sup', { textContent: n }));
    })));
}

export function ideas() {
  // a different picture in each of the sixteen: an idea's first video not already shown by another
  const used = new Set();
  const stillFor = idea => { const v = waysIn.idea(idea.id).find(x => x.still && !used.has(x.id)); if (v) used.add(v.id); return thumb(v); };
  return el('door-moment', { door: 'ideas' },
    ...heading('What was it <em>about</em>?', 'Four topics, four ideas each.'),
    el('idea-grid', {}, ...cat.topics.map(t => el('topic-zone', { tone: t.tone },
      el('a', { className: 'topic', href: `#videos?topic=${encodeURIComponent(t.name)}`, textContent: t.name }),
      el('topic-ideas', {}, ...t.ideas.map((i, n) => {
        const still = stillFor(i);
        return el('a', { className: 'idea', href: `#videos?idea=${encodeURIComponent(i.id)}`, style: `--n:${n}` },
          still && el('img', { src: still, alt: '', loading: 'lazy', decoding: 'async' }),
          el('b', { textContent: i.name }),
          el('small', { textContent: `${waysIn.idea(i.id).length} videos` }));
      }))))));
}

export function said(open) {
  const box = el('input', { type: 'search', placeholder: 'a few words you remember…', 'aria-label': 'Words someone said', autocomplete: 'off', spellcheck: false });
  const list = el('ol', { className: 'lines', 'aria-live': 'polite' });
  const note = el('p', { className: 'note', textContent: 'Loading what was said…' });
  const show = (lines, q) => {
    list.replaceChildren(...lines.map(l => el('li', {}, el('button', { type: 'button', onclick: () => open(l.video.id, l.start) },
      el('q', { innerHTML: mark(l.text, q) }),
      el('span', { className: 'from', textContent: `${l.video.title} · ${clock(l.start)}` })))));
  };
  let examples = [];
  transcripts().then(all => {
    // four lines to start from, so the box isn't a blank stare
    const pool = Object.values(all).flatMap(t => t.snippets.filter(s => s.text.length > 50 && s.text.length < 120).slice(5, 8).map(s => ({ video: cat.video.get(t.video_id), start: s.start, text: s.text.replace(/\s+/g, ' ').trim() }))).filter(l => l.video);
    examples = shuffled(pool, new Date().toDateString()).slice(0, 4);
    note.textContent = `${Object.keys(all).length} transcripts. Or start from one of these:`;
    if (!box.value) show(examples, '');
  }).catch(() => { note.textContent = 'The transcripts didn’t load. Check the connection and open this again.'; });
  let timer;
  box.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = box.value.trim();
      if (q.length < 3) { note.textContent = 'Three letters or more.'; show(examples, ''); return; }
      const lines = await findLines(q).catch(() => []);
      note.textContent = lines.length ? `${lines.length >= 40 ? '40 or more lines' : lines.length === 1 ? 'One line' : `${lines.length} lines`} with “${q}”.` : `Nobody said “${q}” in the ${cat.videos.filter(v => v.has_transcript).length} transcripts. Try fewer words.`;
      show(lines, q);
    }, 140);
  });
  return el('door-moment', { door: 'said' },
    ...heading('What was <em>said</em>?', 'Type a few words. Each line opens the video right where it was said.'),
    el('line-search', {}, box), note, list);
}

// the words looked for, marked in a line (the line is escaped first; it's text from the data, not markup)
export function mark(text, q) {
  const safe = text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (!q) return safe;
  const at = safe.toLowerCase().indexOf(q.toLowerCase());
  return at < 0 ? safe : `${safe.slice(0, at)}<mark>${safe.slice(at, at + q.length)}</mark>${safe.slice(at + q.length)}`;
}
