// Drawn in: each of Mark's drawings draws itself the first time it comes into view, the way it appears on his
// whiteboard. The black line work goes down first, behind a pen sweeping across with a wobble, then the colour washes
// in from the top. It's the real picture in a canvas over the image (same-origin, so a plain 2D canvas can read it,
// no HTML in Canvas needed), so it works in every browser. With reduced motion, the drawings are just there.
//   drawIn(img)   when the image is on screen and loaded: the canvas over it, the image hidden until the end
//   watch(root)   every img[drawn] inside root draws in as it scrolls into view, a few at a time
import { still } from './el.js';

const done = new Set();   // pictures already drawn on this visit: a drawing draws itself once, then just is
const INK = 110;          // how dark a pixel must be (0-255, lightness) to count as line work

// where an object-fit: contain image actually sits in its box
function fitted(img) {
  const box = img.getBoundingClientRect(), k = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  return { w, h, x: (box.width - w) / 2, y: (box.height - h) / 2 };
}

export async function drawIn(img, { duration = 1700 } = {}) {
  if (still.matches || done.has(img.src) || typeof OffscreenCanvas === 'undefined') return;
  done.add(img.src);
  try { await img.decode(); } catch { return; }
  const { w, h, x, y } = fitted(img);
  if (w < 20 || h < 20) return;
  const ratio = Math.min(2, devicePixelRatio || 1), W = Math.round(w * ratio), H = Math.round(h * ratio);

  // the full picture, and its line work alone (dark pixels kept, the rest made clear)
  const full = new OffscreenCanvas(W, H), f = full.getContext('2d', { willReadFrequently: true });
  f.drawImage(img, 0, 0, W, H);
  const lines = new OffscreenCanvas(W, H), l = lines.getContext('2d');
  const px = f.getImageData(0, 0, W, H), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const light = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (light > INK) d[i + 3] = 0; else { d[i] = d[i + 1] = d[i + 2] = Math.min(light, 40); }   // ink is ink-black
  }
  l.putImageData(px, 0, 0);

  // the canvas takes the image's place, blended onto the paper the same way the image is
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'drawing-in';
  canvas.style.cssText = `position:absolute;left:${img.offsetLeft + x}px;top:${img.offsetTop + y}px;width:${w}px;height:${h}px;mix-blend-mode:multiply;pointer-events:none`;
  const nib = document.createElement('ink-nib');
  nib.style.cssText = 'position:absolute;translate:none;z-index:2';
  img.offsetParent?.append(canvas, nib);
  img.style.opacity = '0';
  const ctx = canvas.getContext('2d');

  // the pen: a front sweeping left to right, wobbling a little row by row, while its tip zig-zags up and down
  const wobble = Array.from({ length: 24 }, () => (Math.random() - 0.5) * 0.08 * W);
  const front = (t, yy) => t * (W * 1.12) - W * 0.06 + wobble[Math.floor((yy / H) * 23.99)];
  const LINES = 0.62;   // the share of the time the line work takes; the colour has the rest
  await new Promise(resolve => {
    const t0 = performance.now();
    setTimeout(resolve, duration + 1500);   // a hidden tab stops the frames: show the picture anyway
    const frame = now => {
      const T = Math.min(1, (now - t0) / duration);
      ctx.clearRect(0, 0, W, H);
      const t = Math.min(1, T / LINES);
      // the line work, as far as the pen has come
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let r = 0; r <= 24; r++) { const yy = (r / 24) * H; ctx.lineTo(Math.max(0, front(t, Math.min(yy, H - 1))), yy); }
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(lines, 0, 0);
      ctx.restore();
      // the colour, washing down from the top once the lines are in
      if (T > LINES) {
        const c = (T - LINES) / (1 - LINES), edge = c * H * 1.3;
        const wash = ctx.createLinearGradient(0, edge - H * 0.3, 0, edge);
        wash.addColorStop(0, '#000'); wash.addColorStop(1, 'transparent');
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const tmp = colour(full, W, H, wash);
        ctx.drawImage(tmp, 0, 0);
        ctx.restore();
      }
      // the pen's tip on the front, scribbling up and down
      if (t < 1) {
        const yy = (Math.abs(((now - t0) / 90) % 2 - 1)) * H;
        nib.style.left = `${img.offsetLeft + x + Math.max(0, front(t, yy)) / ratio}px`;
        nib.style.top = `${img.offsetTop + y + yy / ratio}px`;
      } else nib.style.opacity = '0';
      if (T < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  img.style.opacity = '';
  nib.remove();
  canvas.animate({ opacity: [1, 0] }, { duration: 250, fill: 'forwards' }).finished.then(() => canvas.remove(), () => canvas.remove());
}

// the full picture seen through a top-down mask: one reusable scratch canvas
let scratch = null;
function colour(full, W, H, mask) {
  if (!scratch || scratch.width !== W || scratch.height !== H) scratch = new OffscreenCanvas(W, H);
  const s = scratch.getContext('2d');
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, W, H);
  s.fillStyle = mask;
  s.fillRect(0, 0, W, H);
  s.globalCompositeOperation = 'source-in';
  s.drawImage(full, 0, 0);
  return scratch;
}

// a few at a time, in the order they come into view, so a shelf of them draws like a hand working along it
const queue = [];
let busy = 0;
const MOST = 3;
function next() {
  while (busy < MOST && queue.length) {
    const img = queue.shift();
    if (!img.isConnected) continue;
    busy++;
    drawIn(img).finally(() => { busy--; setTimeout(next, 120); });
  }
}
const seen = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { seen.unobserve(e.target); queue.push(e.target); }
  next();
}, { threshold: 0.4 });

export function watch(root) {
  if (still.matches || !seen) return;
  for (const img of root.querySelectorAll('img[drawn]')) if (!done.has(img.src)) seen.observe(img);
}
