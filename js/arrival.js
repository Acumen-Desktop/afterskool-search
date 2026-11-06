// Arrival: one line and four doors, over the desert, with drawings from the videos drifting across the sky like
// half-remembered things. "I remember… a drawing, a name, an idea, something said": the person picks whichever stuck.
// A drifting drawing they recognise can be clicked straight into its video (a shortcut for the mouse; every video is
// also reachable by the doors and search, so the sky stays out of the keyboard's way).
import { el, shuffled } from './el.js';
import { cat, thumb } from './catalog.js';

const SKY = 16;   // drawings in the sky at once: enough to feel like a sky of memories, few enough for an old computer

export function fillSky(sky, open) {
  if (sky.childElementCount) return;
  const picks = shuffled(cat.videos.filter(v => v.still), new Date().toDateString()).slice(0, SKY);
  picks.forEach((v, i) => {
    const depth = i % 3;                                    // 0 far, 1 middle, 2 near
    const lane = (i * 37) % 100;                            // how high in the sky, spread out
    const memory = el('sky-memory', { depth, style: `--lane:${lane}; --tilt:${((i * 53) % 13) - 6}deg; --len:${110 + depth * -25 + (i % 5) * 9}s; --late:${-((i * 61) % 100) / 100}` },
      el('img', { src: thumb(v), alt: '', decoding: 'async', width: 320, height: 180 }));
    memory.title = v.title;
    memory.addEventListener('click', () => open(v.id, 0));
    sky.append(memory);
  });
}

export function arrival() {
  const sample = cat.videos.find(v => v.has_transcript && v.sample_snippet)?.sample_snippet?.replace(/\s+/g, ' ').trim();
  const drawing = cat.drawing.get('brain_sample_1') || cat.drawings[0];
  const doors = [
    { href: '#drawings', word: 'a drawing', count: `${cat.drawings.length} drawings`,
      art: drawing && el('img', { src: drawing.image_png, alt: '', width: 300, height: 300, decoding: 'async', drawn: true }) },
    { href: '#people', word: 'a name', count: `${cat.speakers.length} people`,
      art: el('door-names', {}, ...cat.speakers.slice(0, 3).map(s => el('span', { textContent: s.name }))) },
    { href: '#ideas', word: 'an idea', count: `${cat.ideas.length} ideas in ${cat.topics.length} topics`,
      // the 4x4 itself: each topic a quarter, its four ideas a 2 x 2 inside it (a wider gap, track 3, between topics)
      art: el('mini-grid', {}, ...cat.topics.flatMap(t => t.ideas.map((i, n) =>
        el('span', { tone: t.tone, style: `grid-area:${(t.tone >> 1) * 3 + (n >> 1) + 1} / ${(t.tone & 1) * 3 + (n & 1) + 1}` })))) },
    { href: '#said', word: 'something said', count: `${cat.videos.filter(v => v.has_transcript).length} transcripts`,
      art: sample && el('q', { textContent: sample }) },
  ];
  return el('arrival-moment', {},
    el('h1', { innerHTML: 'Find the video you <em>half</em> remember.' }),
    el('p', { className: 'lead', textContent: `${cat.videos.length} After Skool videos. Start from whatever stuck with you.` }),
    el('door-row', { role: 'list' },
      el('span', { className: 'remember', textContent: 'I remember…', 'aria-hidden': 'true' }),
      ...doors.map(d => el('a', { href: d.href, className: 'door', role: 'listitem', 'aria-label': `I remember ${d.word}: ${d.count}` },
        el('door-art', { 'aria-hidden': 'true' }, d.art),
        el('b', { textContent: d.word }),
        el('small', { textContent: d.count })))));
}
