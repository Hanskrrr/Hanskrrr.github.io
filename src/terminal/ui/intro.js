// The start screen under the banner: the creature on the left and a short
// neofetch-style summary on the right. Seven text rows, matching the creature.
import { el } from '../../core/dom.js';
import { createCreature } from './creature.js';

export function createIntro({ articles, thoughts = 0, photos = 0, tracks = 0 }) {
  const info = el('pre', 'tty-info');
  const row = (...parts) => { info.append(...parts, '\n'); };
  const field = (key, value) => row(el('span', 'tty-key', key.padEnd(10)), el('span', 'tty-value', String(value)));
  row(el('span', 'tty-user', 'guest'), '@', el('span', 'tty-host', 'gallery'));
  row(el('span', 'tty-rule', '─'.repeat(13)));
  const fields = [['articles', articles], ['thoughts', thoughts], ['photos', photos], ['audio', tracks]].filter(([, count]) => count);
  fields.forEach(([key, count]) => field(key, count));
  // Keep seven rows, level with the creature.
  for (let i = fields.length; i < 4; i++) row('');
  info.append('Type ', el('span', 'tty-cmd', 'help'), ' for commands.');

  const intro = el('div', 'tty-intro');
  intro.append(createCreature(), info);
  return intro;
}
