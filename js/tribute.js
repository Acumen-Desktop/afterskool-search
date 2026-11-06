// For Mark: After Skool's years as a trail across the desert, each year a fan of the videos he drew that year. It's
// the index's thank-you, and the one page that's about him rather than about finding a video. The span, the counts
// and the pictures all come from the data; the mission line is After Skool's own (afterskool.net).
import { el } from './el.js';
import { cat, thumb, waysIn } from './catalog.js';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];

const yearsOf = () => [...new Set(cat.videos.map(v => v.year).filter(Boolean))].sort();
// "Ten years": from the first year in the data to the last
export function spanWords() {
  const years = yearsOf(), span = years.length ? years[years.length - 1] - years[0] : 0;
  return `${WORDS[span] || span} years`;
}

export function tribute() {
  const years = yearsOf();
  return el('door-moment', { door: 'mark' },
    el('h2', { innerHTML: `${spanWords()} of <em>drawing ideas</em>` }),
    // only what the data shows: the years of the videos indexed here, not when the channel began
    el('p', { className: 'lead', textContent: `${cat.videos.length} videos from ${years[0]} to ${years[years.length - 1]}, every drawing in them by Mark Wooding’s hand. In After Skool’s own words, the mission is “to enhance profound ideas through art.”` }),
    el('year-trail', {}, ...years.map(y => {
      const list = waysIn.year(y);
      return el('a', { className: 'year', href: `#videos?year=${y}`, 'aria-label': `${y}: ${list.length} videos` },
        el('year-fan', { 'aria-hidden': 'true' }, ...list.filter(v => v.still).slice(0, 5).map((v, i) =>
          el('img', { src: thumb(v), alt: '', loading: 'lazy', decoding: 'async', style: `--i:${i - 2}` }))),
        el('b', { textContent: y }),
        el('small', { textContent: `${list.length} ${list.length === 1 ? 'video' : 'videos'}` }));
    })),
    el('thank-you', {},
      el('p', { textContent: 'Thank you, Mark.' }),
      el('a', { href: 'https://www.youtube.com/@AfterSkool', target: '_blank', rel: 'noopener', textContent: 'Watch After Skool' }),
      el('a', { href: 'https://www.patreon.com/AfterSkool', target: '_blank', rel: 'noopener', className: 'warm', textContent: 'Support Mark on Patreon' })));
}
