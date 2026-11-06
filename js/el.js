// The few helpers every part uses (the same el() as 4x4's surfaces/opening/steps/stage.js).
//   el('video-card', { tone: 2 }, kid, kid)   builds an element: properties are set, attributes for names with a dash
//                                              or that the element doesn't have; kids that are null or false are skipped
//   motion(node, frames, options)             a Web Animation that resolves when done, or at once with reduced motion
export const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k in e && !k.includes('-')) e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
};

export const still = matchMedia('(prefers-reduced-motion: reduce)');
export const glide = 'cubic-bezier(.2, .7, .2, 1)';
// Never waits longer than the animation should take: a hidden tab can hold animations still, and the page must not
// stop between two moments because nobody was watching
export const motion = (node, frames, options = {}) => {
  if (still.matches) return Promise.resolve();
  const o = { duration: 520, easing: glide, fill: 'both', ...options };
  const run = node.animate(frames, o);
  return Promise.race([run.finished.catch(() => {}), new Promise(r => setTimeout(r, o.duration + (o.delay || 0) + 150))])
    .then(() => run.finish?.());   // land on the last frame either way
};
export const pause = ms => new Promise(r => setTimeout(r, still.matches ? 0 : ms));

// "15:08" from 908 seconds; "1:02:03" past an hour
export const clock = s => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};

// a stable shuffle, so the same page looks the same on every visit (seeded by a word)
export function shuffled(list, seed = 'skool') {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
