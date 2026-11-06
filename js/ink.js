// Ink: a heading is written in by hand, the way Mark Wooding's pen draws on the whiteboard in every After Skool video.
// It uses HTML in Canvas (Chrome 157 on: the real heading drawn into a canvas with drawElementImage, its pixels read
// back; see 4x4-tao trail/ideas/html-in-canvas.md), so the ink is the page's own text, in its own font, colour and
// language. A pen nib scribbles down each line, left to right, hatching the letters in as it passes, like a marker
// filling a shape. Where the API is missing it wipes in left to right with a clip; with reduced motion it just shows.
//   await ink(heading)   the heading must be in the page and laid out; it stays real, readable text throughout
import { still, motion } from './el.js';

const canDraw = () => 'drawElementImage' in CanvasRenderingContext2D.prototype && 'requestPaint' in HTMLCanvasElement.prototype;

export async function ink(heading, { speed = 1 } = {}) {
  if (!heading?.isConnected || still.matches || document.hidden) return;   // a hidden tab draws nothing: just show it
  if (canDraw()) { try { if (await pen(heading, speed)) return; } catch { /* fall through to the wipe */ } }
  heading.style.opacity = '';
  await motion(heading, { clipPath: ['inset(-20% 100% -20% 0)', 'inset(-20% 0 -20% 0)'] }, { duration: 900 / speed, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'none' });
}

// the heading's pixels, drawn by the browser from a copy inside a drawable canvas
function picture(heading, w, h, pad) {
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.ceil(w * ratio); canvas.height = Math.ceil(h * ratio);
  canvas.setAttribute('layoutsubtree', '');   // the API's earlier name, for builds before 157
  canvas.setAttribute('content', 'drawable');
  canvas.setAttribute('aria-hidden', 'true');
  const box = heading.getBoundingClientRect();
  const copy = heading.cloneNode(true);
  copy.setAttribute('drawable', '');
  copy.removeAttribute('id');
  const css = getComputedStyle(heading);
  Object.assign(copy.style, {
    position: 'static', margin: '0', opacity: '1', clipPath: 'none', width: `${box.width}px`, height: `${box.height}px`,
    font: css.font, color: css.color, letterSpacing: css.letterSpacing, textAlign: css.textAlign, lineHeight: css.lineHeight,
    textWrap: css.textWrap, padding: css.padding, boxSizing: css.boxSizing,
  });
  canvas.append(copy);
  return new Promise(done => {
    const timer = setTimeout(() => done(null), 1200);   // no paint (a hidden tab): no pen
    canvas.addEventListener('paint', () => {
      clearTimeout(timer);
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.scale(ratio, ratio);
        ctx.drawElementImage(copy, pad, pad);
        done({ canvas, ctx, img: ctx.getImageData(0, 0, canvas.width, canvas.height), ratio, copy });
      } catch { done(null); }
    }, { once: true });
    canvas.requestPaint();
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;opacity:0`;
    document.body.append(canvas);
  });
}

async function pen(heading, speed) {
  const box = heading.getBoundingClientRect(), pad = 24;
  const W = box.width + pad * 2, H = box.height + pad * 2;
  heading.style.opacity = '0';
  const pic = await picture(heading, W, H, pad);
  if (!pic) return false;
  const { canvas, ctx, img, ratio, copy } = pic;
  copy.remove();
  const w = canvas.width, h = canvas.height, src = new Uint32Array(img.data.buffer);

  // the lines of writing: bands of rows with ink in them
  const rowInk = new Uint8Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src[y * w + x] >>> 24 > 40) { rowInk[y] = 1; break; }
  const lines = [];
  for (let y = 0; y < h; y++) {
    if (rowInk[y] && (y === 0 || !rowInk[y - 1])) lines.push({ top: y, bottom: y });
    if (rowInk[y]) lines[lines.length - 1].bottom = y;
  }
  // a band shorter than a third of the tallest is a descender or an accent of the line above: join it on
  const tall = Math.max(...lines.map(l => l.bottom - l.top), 1);
  const merged = [];
  for (const l of lines) {
    const last = merged[merged.length - 1];
    if (last && (l.bottom - l.top < tall / 3 || l.top - last.bottom < tall / 6)) last.bottom = l.bottom; else merged.push({ ...l });
  }
  if (!merged.length) { canvas.remove(); return false; }
  // each line's ink from left to right, so the pen skips the gaps between words
  for (const l of merged) {
    l.left = w; l.right = 0;
    for (let y = l.top; y <= l.bottom; y++) for (let x = 0; x < w; x++) if (src[y * w + x] >>> 24 > 40) { if (x < l.left) l.left = x; if (x > l.right) l.right = x; }
  }

  // the canvas goes where the heading is; what the pen has passed is copied from the picture, pixel by pixel, once
  const out = ctx.createImageData(w, h), dst = new Uint32Array(out.data.buffer);
  Object.assign(canvas.style, { position: 'fixed', left: `${box.left - pad}px`, top: `${box.top - pad}px`, opacity: '1', zIndex: '40' });
  const nib = document.createElement('ink-nib');
  nib.setAttribute('aria-hidden', 'true');
  document.body.append(nib);

  const r = Math.max(3, Math.round(tall / 7));          // the pen's reach either side of its tip, in canvas pixels
  const stride = r * 1.1;                                 // how far right it moves per stroke down or up
  const total = merged.reduce((n, l) => n + (l.right - l.left), 0);
  const DUR = Math.min(2600, 700 + total / ratio * 1.1) / speed;   // longer headings take longer, within reason
  let done = 0;                                          // pixels of line-width written so far
  const stamp = (cx, cy) => {
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      const dy = y - cy, span = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let x = Math.max(0, cx - span); x <= Math.min(w - 1, cx + span); x++) { const p = y * w + x; dst[p] = src[p]; }
    }
  };
  // the pen's tip at a distance along the writing: line by line, a zig-zag down and up the line's height
  const tip = along => {
    for (const l of merged) {
      const len = l.right - l.left;
      if (along <= len) {
        const stroke = along / stride, k = stroke % 2, t = k < 1 ? k : 2 - k;
        return { x: l.left + along, y: Math.round(l.top - r / 2 + t * (l.bottom - l.top + r)), l };
      }
      along -= len;
    }
    return null;
  };
  await new Promise(resolve => {
    setTimeout(resolve, DUR + 1500);   // the tab hidden mid-way stops the frames: show the real heading anyway
    const t0 = performance.now();
    const frame = now => {
      const T = Math.min(1, (now - t0) / DUR), eased = T < 1 ? 1 - (1 - T) ** 1.6 : 1;
      const goal = eased * total;
      // fill in every small step since the last frame, so a fast pen leaves no holes
      for (let a = done; a <= goal; a += 0.6) { const p = tip(a); if (p) stamp(Math.round(p.x), p.y); }
      done = goal;
      ctx.putImageData(out, 0, 0);
      const p = tip(Math.min(goal, total - 0.01));
      if (p) nib.style.translate = `${box.left - pad + p.x / ratio}px ${box.top - pad + p.y / ratio}px`;
      if (T < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  // the real heading takes over; the picture of it fades as it does
  heading.style.opacity = '';
  nib.animate({ opacity: [1, 0], scale: [1, 0.3] }, { duration: 260, fill: 'forwards' }).finished.then(() => nib.remove());
  canvas.animate({ opacity: [1, 0] }, { duration: 300, fill: 'forwards' }).finished.then(() => canvas.remove());
  return true;
}
