// Tokenization only: no expansions, substitution, redirects, pipes or evaluation.
export function parseCommand(line) {
  const tokens = [];
  let token = '', quote = '', escaped = false, started = false;
  for (const character of line.trim()) {
    if (escaped) { token += character; escaped = false; started = true; continue; }
    if (character === '\\' && quote !== "'") { escaped = true; started = true; continue; }
    if (quote) {
      if (character === quote) quote = '';
      else token += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; started = true; continue; }
    if (';|&<>`'.includes(character)) return { tokens, error: 'pipes, redirection and command lists are not supported' };
    if (/\s/.test(character)) {
      if (started) { tokens.push(token); token = ''; started = false; }
    } else { token += character; started = true; }
  }
  if (quote || escaped) return { tokens, error: 'unexpected EOF while looking for matching quote' };
  if (started) tokens.push(token);
  return { tokens };
}

/** Glob match supporting only * and ? (dynamic programming, no regex backtracking). */
export function matchesGlob(name, pattern) {
  const characters = [...name];
  let previous = [true, ...characters.map(() => false)];
  for (const token of pattern) {
    const next = Array(characters.length + 1).fill(false);
    if (token === '*') next[0] = previous[0];
    for (let index = 1; index <= characters.length; index++) {
      next[index] = token === '*'
        ? previous[index] || next[index - 1]
        : previous[index - 1] && (token === '?' || token === characters[index - 1]);
    }
    previous = next;
  }
  return previous[characters.length];
}
