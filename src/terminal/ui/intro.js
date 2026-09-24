// The start screen under the banner: the creature on the left and a short
// neofetch-style summary on the right. Seven text rows, matching the creature.
import { el } from '../../core/dom.js';
import { createCreature } from './creature.js';

export function createIntro({ articles, photos, tracks }) {
  const info = el('pre', 'tty-info');
  const row = (...parts) => { info.append(...parts, '\n'); };
  const field = (key, value) => row(el('span', 'tty-key', key.padEnd(10)), el('span', 'tty-value', String(value)));
  row(el('span', 'tty-user', 'guest'), '@', el('span', 'tty-host', 'gallery'));
  row(el('span', 'tty-rule', '─'.repeat(13)));
  field('articles', articles);
  field('photos', photos);
  field('audio', tracks);
  row('');
  info.append('Type ', el('span', 'tty-cmd', 'help'), ' for commands.');

  const intro = el('div', 'tty-intro');
  intro.append(createCreature(), info);
  return intro;
}
