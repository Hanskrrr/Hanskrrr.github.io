// Build the static site into dist/ — the only folder GitHub Pages publishes.
//   src/     → dist/          (index.html is also written to dist/terminal/ for the /terminal/ route)
//   public/  → dist/          (copied as-is: fonts, media, vendor libraries, article bodies, encrypted data)
//   dist/articles/<slug>/index.html  one page per article: the app shell with the article prerendered,
//                                    so links, search engines and readers without JavaScript see it
//   dist/feed.xml                    RSS
// No bundling or transpiling: browsers load the same ES modules the tests import.
import { cp, mkdir, readdir, readFile, rm, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { articles, topics } from '../src/content/articles.js';

const SITE = 'https://hanskrrr.github.io';
const root = fileURLToPath(new URL('../', import.meta.url));
const src = join(root, 'src');
const pub = join(root, 'public');
const output = join(root, 'dist');
const escape = text => String(text).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

// src/ and public/ share the site root, so a name in both would silently overwrite.
const publicNames = new Set(await readdir(pub));
const clash = (await readdir(src)).filter(name => publicNames.has(name));
if (clash.length) throw new Error(`src/ and public/ both contain: ${clash.join(', ')}`);

await rm(output, { recursive: true, force: true });
await cp(src, output, { recursive: true });
await cp(pub, output, { recursive: true });
await mkdir(join(output, 'terminal'), { recursive: true });
await copyFile(join(src, 'index.html'), join(output, 'terminal/index.html'));

const shell = await readFile(join(src, 'index.html'), 'utf8');
for (const article of articles) {
  const url = `${SITE}/articles/${article.id}/`;
  const [genreId, subId] = article.topic.split('/');
  const genre = topics.find(item => item.id === genreId);
  const sub = genre?.subs.find(item => item.id === subId);
  const body = await readFile(join(pub, 'data/articles', `${article.id}.html`), 'utf8');
  const head = [
    `<meta name="description" content="${escape(article.summary)}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="article">',
    `<meta property="og:title" content="${escape(article.title)}">`,
    `<meta property="og:description" content="${escape(article.summary)}">`,
    `<meta property="og:url" content="${url}">`,
    ...(article.math ? ['<link rel="stylesheet" href="/vendor/katex/katex.min.css">'] : []),
  ].join('\n  ');
  const page = shell
    .replace(/<title>[^<]*<\/title>/, () => `<title>Hanskrrr · ${escape(article.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => head)
    // A function replacement, so "$" in article text is never read as a pattern.
    .replace(/(<main[^>]*>)[\s\S]*?(<\/main>)/, (_, open, close) => `${open}<article class="article-page"><div class="article-meta"><span>${escape(genre?.name ?? '')} / ${escape(sub?.name ?? '')}</span><time datetime="${article.date}">${article.date.replaceAll('-', '.')}</time></div><h1>${escape(article.title)}</h1><p class="article-lead muted">${escape(article.summary)}</p><div class="prose" data-article="${article.id}">${body}</div></article>${close}`);
  await mkdir(join(output, 'articles', article.id), { recursive: true });
  await writeFile(join(output, 'articles', article.id, 'index.html'), page);
}

const items = articles.map(article => `    <item>
      <title>${escape(article.title)}</title>
      <link>${SITE}/articles/${article.id}/</link>
      <guid>${SITE}/articles/${article.id}/</guid>
      <pubDate>${new Date(`${article.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(article.summary)}</description>
    </item>`).join('\n');
await writeFile(join(output, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hanskrrr</title>
    <link>${SITE}/</link>
    <description>Hanskrrr 的文章</description>
${items}
  </channel>
</rss>
`);
// Serve files as-is on GitHub Pages (no Jekyll processing).
await writeFile(join(output, '.nojekyll'), '');
console.log(`Static site built: ${output} (${articles.length} article pages)`);
