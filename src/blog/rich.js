// What rendered article HTML needs in the browser, loaded only when a page uses it:
// KaTeX's stylesheet and fonts for math (the math itself is rendered at publish time),
// and Mermaid for ```mermaid diagrams (drawn here, coloured from the site theme).
const loaded = new Map();

function once(key, create) {
  if (!loaded.has(key)) loaded.set(key, new Promise((resolve, reject) => {
    const node = create();
    node.onload = resolve;
    node.onerror = () => { loaded.delete(key); node.remove(); reject(new Error(`Could not load ${key}`)); };
    document.head.append(node);
  }));
  return loaded.get(key);
}

export function loadMathStyles() {
  return once('katex', () => Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/katex/katex.min.css' }));
}

function loadMermaid() {
  return once('mermaid', () => Object.assign(document.createElement('script'), { src: '/vendor/mermaid/mermaid.min.js' }));
}

async function drawDiagrams(nodes) {
  await loadMermaid();
  const css = getComputedStyle(document.documentElement);
  const color = name => css.getPropertyValue(name).trim();
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: color('--sans') || 'sans-serif',
    themeVariables: {
      darkMode: document.documentElement.dataset.theme === 'night',
      background: color('--bg'),
      primaryColor: color('--surface-2'),
      primaryTextColor: color('--ink'),
      primaryBorderColor: color('--line'),
      secondaryColor: color('--surface'),
      tertiaryColor: color('--bg-deep'),
      lineColor: color('--muted'),
      textColor: color('--ink'),
      edgeLabelBackground: color('--bg'),
    },
  });
  await window.mermaid.run({ nodes, suppressErrors: true });
}

/**
 * Load what `container`'s rendered markdown needs. Safe to call more than once.
 * Resolves when math styles, fonts and diagrams have settled (layout is final).
 */
export function enhance(container) {
  const work = [];
  if (container.querySelector('.katex')) work.push(loadMathStyles().catch(() => {}));
  const diagrams = [...container.querySelectorAll('pre.mermaid:not([data-processed])')];
  if (diagrams.length) work.push(drawDiagrams(diagrams).catch(() => diagrams.forEach(node => node.classList.add('mermaid-failed'))));
  return Promise.all(work).then(() => document.fonts.ready);
}
