// About: who made the drawings, what this is, and where to support him. Every count comes from the data.
import { el } from './el.js';
import { cat } from './catalog.js';
import { spanWords } from './tribute.js';

const dialog = el('dialog', { className: 'about', 'aria-label': 'About' });
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

export function openAbout() {
  if (!dialog.isConnected) document.body.append(dialog);
  const drawing = cat.drawing.get('wizard_sample_1') || cat.drawings[0];
  dialog.replaceChildren(el('about-sheet', {},
    drawing && el('img', { src: drawing.image_png, alt: drawing.description || drawing.name, width: 300, height: 300 }),
    el('h2', { innerHTML: 'Drawn by hand, by <em>Mark Wooding</em>' }),
    el('p', { textContent: 'After Skool sets lectures and conversations to whiteboard drawings that Mark Wooding makes by hand.' }),
    el('p', { textContent: `This is an independent, fan-made index of ${cat.videos.length} of those videos: ${cat.speakers.length} people (narrators and the thinkers they discuss), ${cat.topics.length} topics of ${cat.ideas.length / cat.topics.length} ideas each, ${cat.drawings.length} drawings cut from the videos, and ${cat.videos.filter(v => v.has_transcript).length} transcripts. It isn’t affiliated with or endorsed by After Skool. Every drawing is Mark’s, and every video plays from his channel.` }),
    el('p', { textContent: 'If one of them stays with you, watch it on YouTube and support him on Patreon.' }),
    el('about-links', {},
      el('a', { href: '#mark', textContent: `${spanWords()} of After Skool`, onclick: () => dialog.close() }),
      el('a', { href: 'https://www.youtube.com/@AfterSkool', target: '_blank', rel: 'noopener', textContent: 'After Skool on YouTube' }),
      el('a', { href: 'https://www.patreon.com/AfterSkool', target: '_blank', rel: 'noopener', className: 'warm', textContent: 'Support Mark on Patreon' })),
    el('button', { type: 'button', className: 'shut', 'aria-label': 'Close', textContent: '×', onclick: () => dialog.close() })));
  dialog.showModal();
}
