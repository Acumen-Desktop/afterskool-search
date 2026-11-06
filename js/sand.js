// Sand: every heading arrives as desert sand. Going from one moment to the next, the old heading blows away and its
// grains settle into the new one; on the first visit (or from far down a page) the grains blow in from the desert
// floor beyond the left edge. Grains with no place to land blow on, past the right edge and up into the sky.
// Adapted from 4x4's opening (4x4-tao surfaces/opening/steps/sand.js, 2026-11-05), where the dictionary page wears
// away into "The way is not paved."; here it ties After Skool's index back to the desert it stands in.
// It draws the real headings into a canvas with HTML in Canvas (Chrome 157 on: drawElementImage, then the pixels read
// back), so the sand is the page itself, in its own font and colour. Where the API is missing, the computer looks
// small (fewer than 4 cores), motion is reduced, or anything fails, it says no and the caller does its plain fade.
//   const played = await sand(from, to, layer, { duration })
//     from: the element that blows away, or null for sand blowing in from off the screen
//     to: the one that forms (in the page, laid out, invisible); layer: where the canvas goes (the whole window)
import { still } from './el.js';

// 4x4 lets only computers measured smooth run this (its 'glide' grade); this site has no meter, so cores stand in
const smooth = () => !still.matches && (navigator.hardwareConcurrency || 0) >= 4;

const MOST = 12000;   // grains at most
export const canSand = () => smooth() && 'drawElementImage' in CanvasRenderingContext2D.prototype && 'requestPaint' in HTMLCanvasElement.prototype;

// the element's pixels, read from a copy drawn by the browser inside a canvas
function picture(canvas, ctx, copies, w, h) {
  return new Promise(done => {
    const timer = setTimeout(() => done(null), 1500);   // no paint (a hidden tab): no sand
    canvas.addEventListener('paint', () => {
      clearTimeout(timer);
      try {
        done(copies.map(({ copy, x, y }) => {
          ctx.clearRect(0, 0, w, h);
          ctx.drawElementImage(copy, x, y);
          return ctx.getImageData(0, 0, w, h);
        }));
      } catch { done(null); }
    }, { once: true });
    canvas.requestPaint();
  });
}

// grains from a picture: a spaced grid of its visible pixels, each with its place and colour
function grains(img, w, h, solid) {
  const d = img.data, found = [];
  let step = 2, all;
  for (;;) {
    all = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > solid) all.push([x, y, d[i], d[i + 1], d[i + 2]]);
    }
    if (all.length <= MOST || step > 12) break;
    step++;
  }
  found.push(...all);
  return found;
}

const SAND = [205, 150, 96];   // the desert floor's colour (scene/): grains blowing in start as sand
const rand = (a, b) => a + Math.random() * (b - a);

export async function sand(from, to, layer, { duration = 2400 } = {}) {
  if (!canSand() || (from && !from.isConnected) || !to?.isConnected || !layer) return false;
  const box = layer.getBoundingClientRect(), w = Math.round(box.width), h = Math.round(box.height);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.setAttribute('layoutsubtree', '');   // the API's earlier name, for Chrome builds before 157
  canvas.setAttribute('content', 'drawable');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: `${w}px`, height: `${h}px`, zIndex: 2, pointerEvents: 'none' });
  // copies of the headings, laid out at their own size, drawn where the originals are
  const copies = [from, to].filter(Boolean).map(node => {
    const r = node.getBoundingClientRect(), copy = node.cloneNode(true), css = getComputedStyle(node);
    // inside the canvas the page's selectors don't reach the copy, so it takes its own look along
    Object.assign(copy.style, { font: css.font, color: css.color, letterSpacing: css.letterSpacing, textAlign: css.textAlign, lineHeight: css.lineHeight, textWrap: css.textWrap, textShadow: css.textShadow, padding: css.padding, boxSizing: css.boxSizing });
    copy.setAttribute('drawable', '');
    copy.removeAttribute('id');
    Object.assign(copy.style, { position: 'static', translate: 'none', left: 'auto', top: 'auto', margin: '0', opacity: '1', clipPath: 'none', visibility: 'visible', width: `${r.width}px`, height: `${r.height}px`, maxHeight: 'none', overflow: 'hidden' });
    canvas.append(copy);
    return { copy, x: r.left - box.left, y: r.top - box.top };
  });
  layer.append(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pics = ctx && await picture(canvas, ctx, copies, w, h);
  copies.forEach(c => c.copy.remove());
  if (!pics) { canvas.remove(); return false; }
  const end = grains(pics[pics.length - 1], w, h, 140);
  // blowing in: as many grains as the new heading needs, out on the desert floor past the left edge, sand-coloured
  const start = from ? grains(pics[0], w, h, 8) : end.map(() => [rand(-0.45, -0.02) * w, rand(0.55, 1) * h, ...SAND]);
  if (!start.length || !end.length) { canvas.remove(); return false; }
  // a longer new heading than the old: the rest of its grains blow in from the desert floor too, so it forms whole
  const own = from ? start.length : 0;
  while (start.length < end.length) start.push([rand(-0.45, -0.02) * w, rand(0.55, 1) * h, ...SAND]);

  // each grain: from where it is, through a gust (the wind blows left to right and lifts), to its place in the new
  // heading. With a heading to blow away, the wind crosses it in its first 30%: the part not yet reached is still the
  // real page (clipped, so its blur and all stay), wearing away from the left. Blowing in, the grains set off over
  // the first 40% of the time, so they arrive as a stream rather than all at once
  let left = Infinity, right = -Infinity;
  for (const [x] of start.slice(0, own || start.length)) { if (x < left) left = x; if (x > right) right = x; }
  const across = Math.max(1, right - left), FRONT = 0.3;
  const n = start.length, gx = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const [x, y] = start[i], t = i < end.length ? end[(i * 7919) % end.length] : null;
    const tx = t ? t[0] : w + rand(80, 0.4 * w), ty = t ? t[1] : y - rand(0.2, 0.7) * h;   // no place: off past the right, up
    gx.set([x, y,
      (x + tx) / 2 + rand(80, 420), Math.max(rand(0.03, 0.12) * h, Math.min(y, ty) - rand(120, 0.45 * h)),   // the gust: high over the way between, never off the top
      tx, ty,
      i < own ? ((x - left) / across) * FRONT + rand(0, 0.03) : rand(0, 0.4),
      t ? 1 : 0], i * 8);
  }
  const ink = start.map(([, , r, g, b], i) => [r, g, b, ...(i < end.length ? end[(i * 7919) % end.length].slice(2) : [r, g, b])]);
  const frame = ctx.createImageData(w, h), px = new Uint32Array(frame.data.buffer);
  const fromLeft = from ? from.getBoundingClientRect().left - box.left : 0;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const FLIGHT = from ? 0.65 : 0.6;   // the share of the time one grain is in the air
  to.style.opacity = '0';
  await new Promise(done => {
    setTimeout(done, duration + 1500);   // a hidden tab stops the frames: finish anyway
    const t0 = performance.now();
    const step = now => {
      const T = Math.min(1, (now - t0) / duration);
      px.fill(0);
      for (let i = 0; i < n; i++) {
        const o = i * 8, k = Math.max(0, Math.min(1, (T - gx[o + 6]) / FLIGHT)), e = ease(k), u = 1 - e;
        if (k === 0) continue;   // not reached by the wind yet: still part of the page, or still out on the floor
        // a curve through the gust: start, gust, end
        const x = u * u * gx[o] + 2 * u * e * gx[o + 2] + e * e * gx[o + 4], y = u * u * gx[o + 1] + 2 * u * e * gx[o + 3] + e * e * gx[o + 5];
        const X = x | 0, Y = y | 0;
        if (X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1) continue;
        const c = ink[i], m = gx[o + 7] ? e * e * e : 0;   // a grain keeps its colour most of the way, taking the new one as it lands
        const a = gx[o + 7] ? 255 : Math.round(255 * (1 - k * 0.7));
        const r = c[0] + (c[3] - c[0]) * m, g = c[1] + (c[4] - c[1]) * m, b = c[2] + (c[5] - c[2]) * m;
        const v = (a << 24) | (b << 16) | (g << 8) | r;
        const p = Y * w + X;
        px[p] = px[p + 1] = px[p + w] = px[p + w + 1] = v;
      }
      ctx.putImageData(frame, 0, 0);
      if (from) {
        // what the wind hasn't reached yet: the real page, cut back to the right of the front
        const front = left + across * Math.min(1, T / FRONT);
        if (front >= right) from.style.visibility = 'hidden';
        else from.style.clipPath = `inset(0 0 0 ${Math.max(0, front - fromLeft)}px)`;
      }
      // the real line comes up under the last of the grains
      if (T > 0.82) to.style.opacity = String((T - 0.82) / 0.18);
      if (T < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  to.style.opacity = '';
  canvas.animate({ opacity: [1, 0] }, { duration: 300 }).finished.then(() => canvas.remove(), () => canvas.remove());
  return true;
}
