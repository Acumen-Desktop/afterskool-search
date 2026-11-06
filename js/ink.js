// Ink: a heading wipes in from the left, as if written. It's what a browser without HTML in Canvas gets in place of
// the sand (sand.js); with reduced motion, or in a hidden tab, the heading just shows.
// (2026-11-05: this was a pen hatching the heading in, a dot scribbling along it, drawn with HTML in Canvas. James
// preferred the sand, so the sand does every heading now and this is only the fallback.)
//   await ink(heading)   the heading must be in the page and laid out; it stays real, readable text throughout
import { still, motion } from './el.js';

export async function ink(heading, { speed = 1 } = {}) {
  if (!heading?.isConnected || still.matches || document.hidden) return;
  heading.style.opacity = '';
  await motion(heading, { clipPath: ['inset(-20% 100% -20% 0)', 'inset(-20% 0 -20% 0)'] }, { duration: 900 / speed, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'none' });
}
