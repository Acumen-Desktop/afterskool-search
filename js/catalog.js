// Everything the page knows, from the data the scripts make (data/: graphData.json and artworkAssetsData.json).
// Every count and name on the page comes from here, never typed by hand (architecture.md: hand-typed copy once named
// thinkers and topics that don't exist). The transcripts (about 1 MB) load only when a line is looked for or a video
// opens: transcripts() below.
//
// Speakers: video.voice_credits are the reviewed voices (often none); video.speakers are every linked thinker, including
// ones a video only talks about. credits() keeps the two apart so a discussed thinker is never shown as the narrator.
export const cat = {
  videos: [], speakers: [], topics: [], ideas: [], families: [], drawings: [],
  video: new Map(), speaker: new Map(), idea: new Map(), drawing: new Map(), slug: new Map(),
};

// a video's name in its address: its title, lower case, hyphens between words, at most 70 letters
// ("why-do-bad-things-happen-to-good-people-book-of-job"). Every title gives a different one (checked for all 254)
export const slug = title => title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '');

export async function loadCatalog() {
  const [graph, art] = await Promise.all(['/data/graphData.json', '/data/artworkAssetsData.json'].map(u => fetch(u).then(r => {
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    return r.json();
  })));
  cat.videos = graph.videos || [];
  cat.speakers = (graph.speakers || []).sort((a, b) => (b.video_count || 0) - (a.video_count || 0));
  // the four topics, in the data's order, each with its four ideas; tone = which of 4x4's four zone colours it wears
  cat.topics = Object.entries(graph.domains_4x4 || {}).map(([name, ideas], tone) => ({ name, tone, ideas: ideas.map(i => ({ ...i, topic: name, tone })) }));
  cat.ideas = cat.topics.flatMap(t => t.ideas);
  cat.families = art.families || [];
  cat.drawings = cat.families.flatMap(f => f.samples);
  for (const v of cat.videos) { v.slug = slug(v.title); cat.video.set(v.id, v); cat.slug.set(v.slug, v); }
  for (const s of cat.speakers) cat.speaker.set(s.id, s);
  for (const i of cat.ideas) cat.idea.set(i.id, i);
  for (const d of cat.drawings) cat.drawing.set(d.id, d);
  return cat;
}

// a video's picture: the small copy (tools/thumbs.py) for cards and the sky; the full still where a card is big
export const thumb = v => (v?.still ? `/thumbs/${v.id}.webp` : null);
export const picture = v => (v?.still ? { src: thumb(v), srcset: `${thumb(v)} 640w, ${v.still} 1280w` } : null);

// a video's three scenes, at 25, 50 and 75% through (tools/thumbs.py); `at` is the second, when the length is known
export const scenes = v => (v?.still ? [25, 50, 75].map(p => ({ src: `/thumbs/scenes/${v.id}_${p}.webp`, part: p, at: v.duration ? Math.round(v.duration * p / 100) : null })) : []);

// When a drawing is seen: "5:32", or "Cover" when it was cut from the video's cover picture, which has no known
// second (scripts/10_correct_drawings.py)
export const when = o => (o.timestamp == null ? 'Cover' : o.timestamp_label?.replace(/^0(?=\d:)/, '') || String(o.timestamp));

export const toneOf = video => Math.max(0, cat.topics.findIndex(t => t.name === video.discipline));

const nameOf = id => cat.speaker.get(id)?.name;
export function credits(video) {
  const voices = video.voice_credits || [];
  const linked = (video.speakers || []).map(nameOf).filter(Boolean);
  return { voice: voices.length ? voices.join(', ') : null, about: [...new Set(linked)].filter(n => !voices.includes(n)) };
}

// The videos a way in leads to
export const waysIn = {
  drawing(id) {
    const d = cat.drawing.get(id), seen = new Set(d?.occurrences?.map(o => o.video_id) || []);
    return cat.videos.filter(v => seen.has(v.id) || v.artwork_assets?.some(a => a.id === id));
  },
  voice(id) {
    const s = cat.speaker.get(id);
    return cat.videos.filter(v => v.speakers?.includes(id) || (s && v.voice_credits?.includes(s.name)));
  },
  idea: id => cat.videos.filter(v => v.concepts?.includes(id)),
  topic: name => cat.videos.filter(v => v.discipline === name),
  year: y => cat.videos.filter(v => String(v.year) === String(y)),
};

let loading = null;
export const transcripts = () => (loading ||= fetch('/data/transcriptsIndex.json').then(r => r.json()).catch(e => { loading = null; throw e; }));

// The moments graph (data/moments.json, scripts/11_build_moments.py in the content): people named, pictures described
// and ideas stated in each transcript, at the second they're said. Loaded only when looked for, like the transcripts
let momentsLoading = null;
export const moments = () => (momentsLoading ||= fetch('/data/moments.json').then(r => (r.ok ? r.json() : { people: [], moments: [] }))
  .catch(() => ({ people: [], moments: [] })));

// Moments matching some words: every word must appear in the label, its tags, its quote or the person's name.
// Pictures first, then people, then ideas; at most `most`
export async function findMoments(words, { kinds = ['picture', 'person', 'idea'], most = 40 } = {}) {
  const g = await moments(), qs = words.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (!qs.length) return [];
  // each word matches at the start of a word ("king" finds "kings", not "drinking")
  const res = qs.map(w => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const order = { picture: 0, person: 1, idea: 2 };
  return g.moments
    .filter(m => kinds.includes(m.k) && cat.video.has(m.v))
    .filter(m => { const hay = `${m.text} ${(m.tags || []).join(' ')} ${m.q || ''}`.toLowerCase(); return res.every(r => r.test(hay)); })
    .sort((a, b) => order[a.k] - order[b.k])
    .slice(0, most)
    .map(m => ({ ...m, video: cat.video.get(m.v) }));
}

// One spoken line for each transcript match: [{ video, start, text }], up to `most`
export async function findLines(words, most = 40) {
  const all = await transcripts(), q = words.trim().toLowerCase();
  if (q.length < 3) return [];
  const found = [];
  for (const t of Object.values(all)) {
    for (const s of t.snippets) {
      if (s.text.toLowerCase().includes(q)) {
        const video = cat.video.get(t.video_id);
        if (video) found.push({ video, start: s.start, text: s.text.replace(/\s+/g, ' ').trim() });
        if (found.length >= most) return found;
      }
    }
  }
  return found;
}
