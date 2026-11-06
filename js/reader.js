// The reader: a video with its words beside it. The player is YouTube's own (the IFrame API); the transcript follows
// it, the line being spoken lit, and any line jumps the video there or copies itself as a quote with a link to that
// second. A fresh reader for every video and start (architecture.md): the old player is destroyed first.
// No transcript: the reader says so and the video still plays. The video won't play here (offline, blocked, or not
// allowed to be embedded): it says so and links to YouTube.
import { el, clock } from './el.js';
import { cat, credits, transcripts, scenes, when, moments } from './catalog.js';

let api = null;
function youtube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return (api ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = el('script', { src: 'https://www.youtube.com/iframe_api', async: true });
    s.onerror = () => { api = null; reject(new Error('no YouTube')); };
    document.head.append(s);
    setTimeout(() => reject(new Error('YouTube took too long')), 12000);
  }));
}

const dialog = el('dialog', { className: 'reader', 'aria-label': 'Video' });
let player = null, poll = 0;
function close() {
  clearInterval(poll);
  try { player?.destroy(); } catch { /* already gone */ }
  player = null;
}
// The open video is its own address: /watch/<its title as a slug>?t=1m30s (James, 2026-11-05: readable, with the
// time, and nothing else), so it can be bookmarked or sent. The time follows the video as it plays. The moment under
// the reader isn't in it: a shared link opens over the start. Back closes the reader, as on a phone: opening it adds
// a history entry, closing it any other way (×, Escape, a click outside) takes that entry back off
const stamp = s => { s = Math.floor(s); const m = Math.floor(s / 60); return m ? `${m}m${s % 60 ? `${s % 60}s` : ''}` : `${s}s`; };
const seconds = t => { if (!t) return 0; if (/^\d+$/.test(t)) return +t; const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const address = (id, at) => {
  const v = id && cat.video.get(id);
  if (!v) return `/${location.pathname.startsWith('/watch/') ? '' : location.search}${location.hash}`;   // no video: the page under it
  return `/watch/${v.slug}${at >= 1 ? `?t=${stamp(at)}` : ''}`;
};
// the video an address names: /watch/<slug>?t=…, or the older ?watch=<id>&t=<seconds>
export const watching = () => {
  const q = new URLSearchParams(location.search), m = location.pathname.match(/^\/watch\/([^/]+)/);
  const v = m ? cat.slug.get(decodeURIComponent(m[1])) : cat.video.get(q.get('watch'));
  return v ? { id: v.id, at: seconds(q.get('t')) } : null;
};
dialog.addEventListener('close', () => {
  close(); dialog.replaceChildren();
  if (history.state?.reader) history.back();
  else if (watching()) history.replaceState(history.state, '', address(null));   // closed by a move elsewhere: tidy the address
});
addEventListener('popstate', () => { if (dialog.open && !history.state?.reader) dialog.close(); });
// a link inside the reader to another moment: close first (its entry comes off), then go
function leaveTo(href) {
  addEventListener('popstate', () => { location.hash = href; }, { once: true });
  dialog.close();
}
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });   // a click on the dimmed desert closes it

export async function openReader(id, at = 0) {
  const v = cat.video.get(id);
  if (!v) return;
  close();
  if (!dialog.isConnected) document.body.append(dialog);
  let follow = () => {};   // the transcript's: set once the words load
  const who = credits(v), link = s => `https://www.youtube.com/watch?v=${v.id}${s ? `&t=${Math.floor(s)}s` : ''}`;
  const frame = el('player-frame', {}, el('div'));
  const seen = cat.drawings.flatMap(d => (d.occurrences || []).filter(o => o.video_id === v.id).map(o => ({ d, o }))).sort((a, b) => (a.o.timestamp ?? -1) - (b.o.timestamp ?? -1));   // the cover first
  const ideas = (v.concepts || []).map(c => cat.idea.get(c)).filter(Boolean);
  const board = scenes(v).filter(s => s.at != null);   // a scene can be jumped to only when the video's length is known
  const lines = el('spoken-lines', { 'aria-label': 'What is said' }, el('p', { className: 'note', textContent: v.has_transcript ? 'Loading the words…' : 'No transcript for this one yet. The video still plays.' }));
  // a link to this video at the second it's playing now: this site's address, so it opens here, in the reader
  const share = el('button', { type: 'button', className: 'share', textContent: 'Copy link' });
  share.onclick = async () => {
    const now = player?.getCurrentTime?.() ?? at;
    try { await navigator.clipboard.writeText(address(v.id, now)); share.textContent = `Copied, at ${clock(now)}`; } catch { share.textContent = 'Can’t copy'; }
    setTimeout(() => { share.textContent = 'Copy link'; }, 2000);
  };
  const shut = el('button', { type: 'button', className: 'shut', 'aria-label': 'Close', textContent: '×', onclick: () => dialog.close() });
  dialog.replaceChildren(el('reader-sheet', { tone: Math.max(0, cat.topics.findIndex(t => t.name === v.discipline)), bare: !v.has_transcript },
    el('reader-head', {},
      el('h2', { textContent: v.title }),
      el('p', {}, [v.discipline, who.voice && `Voice: ${who.voice}`, who.about.length && `About ${who.about.join(', ')}`, v.duration && clock(v.duration), v.year].filter(Boolean).join(' · ')),
      share,
      el('a', { href: link(at), target: '_blank', rel: 'noopener', textContent: 'Watch on YouTube' }),
      shut),
    frame,
    // under the player: the drawings that appear in this video, each a jump to its second, and the ideas it's about
    seen.length || ideas.length || board.length ? el('reader-more', {},
      // the storyboard: the video's scenes a quarter, half and three quarters through, each a jump there
      board.length ? el('story-board', { 'aria-label': 'Scenes' }, ...board.map(s =>
        el('button', { type: 'button', onclick: () => { player?.seekTo?.(s.at, true); player?.playVideo?.(); follow(s.at); } },
          el('img', { src: s.src, alt: '', loading: 'lazy' }), el('time', { textContent: clock(s.at) })))) : null,
      seen.length ? el('drawing-strip', { 'aria-label': 'Drawings in this video' }, ...seen.map(({ d, o }) =>
        el('button', { type: 'button', title: d.name, onclick: () => { const s = o.timestamp ?? 0; player?.seekTo?.(s, true); player?.playVideo?.(); follow(s); } },
          el('img', { src: d.image_png, alt: '' }), el('time', { textContent: when(o) }), el('span', { textContent: d.name })))) : null,
      ideas.length ? el('idea-links', {}, el('span', { textContent: 'More about' }), ...ideas.map(i =>
        el('a', { href: `#videos?idea=${encodeURIComponent(i.id)}`, tone: i.tone, textContent: i.name, onclick: e => { e.preventDefault(); leaveTo(e.currentTarget.getAttribute('href')); } }))) : null) : null,
    lines));
  if (!dialog.open) { history.pushState({ reader: true }, '', address(v.id, at)); dialog.showModal(); }
  else history.replaceState({ reader: true }, '', address(v.id, at));   // another video in the open reader
  shut.focus();

  // the player
  youtube().then(YT => {
    if (!frame.isConnected) return;
    player = new YT.Player(frame.firstElementChild, {
      videoId: v.id,
      playerVars: { start: Math.floor(at), autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => {
          let shown = -1;
          poll = setInterval(() => {
            const t = player?.getCurrentTime?.();
            if (typeof t !== 'number') return;
            follow(t);
            // the address keeps the time, to the nearest 5 seconds, so copying it from the bar starts where you are
            const five = Math.floor(t / 5) * 5;
            if (five !== shown && history.state?.reader && dialog.open) { shown = five; history.replaceState(history.state, '', address(v.id, five)); }
          }, 500);
        },
        onError: () => broken(),
      },
    });
  }).catch(() => broken());
  function broken() {
    if (!frame.isConnected) return;
    frame.replaceChildren(el('player-broken', {},
      el('p', { textContent: 'This video won’t play here: you may be offline, or YouTube doesn’t allow it on other sites.' }),
      el('a', { href: link(at), target: '_blank', rel: 'noopener', textContent: 'Open it on YouTube' })));
  }

  // who's named and what's pictured in this video, from the moments graph: each a jump to its second
  moments().then(g => {
    const here = g.moments.filter(m => m.v === v.id && m.k !== 'idea');
    if (!here.length || !frame.isConnected) return;
    let more = dialog.querySelector('reader-more');
    if (!more) { more = el('reader-more'); frame.after(more); }
    more.append(el('moment-chips', { 'aria-label': 'Named and pictured in this video' }, ...here.map(m =>
      el('button', { type: 'button', kind: m.k, title: m.q ? `“${m.q}”` : m.text, onclick: () => { player?.seekTo?.(m.t, true); player?.playVideo?.(); follow(m.t); } },
        el('time', { textContent: clock(m.t) }), el('span', { textContent: m.text })))));
  });

  // the words
  if (!v.has_transcript) return;
  const all = await transcripts().catch(() => null);
  const t = all?.[v.id];
  if (!lines.isConnected) return;
  if (!t) { lines.replaceChildren(el('p', { className: 'note', textContent: 'The words didn’t load. The video still plays.' })); return; }
  const rows = t.snippets.map(s => {
    const text = s.text.replace(/\s+/g, ' ').trim();
    const copy = el('button', { type: 'button', className: 'copy', textContent: 'Copy', 'aria-label': `Copy the quote at ${clock(s.start)}` });
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(`“${text}” (${v.title}, ${clock(s.start)}) ${link(s.start)}`); copy.textContent = 'Copied'; } catch { copy.textContent = 'Can’t copy'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
    };
    const row = el('spoken-line', {},
      el('button', { type: 'button', className: 'jump', onclick: () => { player?.seekTo?.(s.start, true); player?.playVideo?.(); follow(s.start); } },
        el('time', { textContent: clock(s.start) }), el('span', { textContent: text })),
      copy);
    return { row, start: s.start };
  });
  lines.replaceChildren(...rows.map(r => r.row));
  // the person scrolled the words themselves: leave them be for a few seconds
  let reading = 0;
  lines.addEventListener('wheel', () => { reading = Date.now(); }, { passive: true });
  lines.addEventListener('touchmove', () => { reading = Date.now(); }, { passive: true });
  let lit = -1;
  follow = time => {
    let i = rows.findIndex(r => r.start > time) - 1;
    if (i < -1) i = rows.length - 1;
    if (i === lit || i < 0) return;
    rows[lit]?.row.removeAttribute('now');
    rows[i].row.setAttribute('now', '');
    lit = i;
    // scroll only the words (spoken-lines is positioned, so offsetTop is within it), never the page under the sheet
    if (Date.now() - reading > 4000) lines.scrollTo({ top: rows[i].row.offsetTop - lines.clientHeight / 3, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  follow(at);
}
