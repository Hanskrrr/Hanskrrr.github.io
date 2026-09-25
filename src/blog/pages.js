// Blog pages: home (hero + article list by topic), article, thoughts, knowledge graph and about.
// Articles come from the vault via scripts/publish.mjs: metadata in content/articles.js,
// bodies as pre-rendered HTML in /data/articles/<slug>.html.
import { $, el, main, reducedMotion } from '../core/dom.js';
import { app } from '../core/router.js';
import { articles, topics } from '../content/articles.js';
import { thoughts } from '../content/thoughts.js';
import { profile } from '../content/profile.js';
import { attachHighlight, globalGraph, localGraph, neighbours, toneOf, topicOf } from './graph.js';
import { avatarSprite, pixelScene } from './pixel-art.js';
import { attachReadingProgress } from './progress.js';
import { enhance } from './rich.js';
import { animateScene } from './scene.js';

// '' = everything, 'math' = one genre, 'math/linear-algebra' = one sub-topic.
let topic = '';
let search = '';
let stopScene = () => {};
const bodies = new Map();
let stopToc = () => {};
const wideToc = matchMedia('(min-width: 1240px)');

export function setTopic(value) {
  topic = topics.some(genre => genre.id === value.split('/')[0]) ? value : '';
  if (app.view === 'blog') renderArticleList();
}
export function setSearch(value) { search = value; renderArticleList(); }

function tag(article) {
  const { genre, sub } = topicOf(article);
  return `<a class="tag tag-${toneOf(genre?.id)}" href="/?view=blog" data-topic="${escapeHtml(article.topic)}">${escapeHtml(sub?.name || article.topic)}</a>`;
}
const date = value => `<time datetime="${value}">${value.replaceAll('-', '.')}</time>`;
const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

function sidebar() {
  const links = profile.links.map(link => `<a class="small-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a>`).join('');
  const now = profile.now?.items?.length
    ? `<section class="now-box" aria-labelledby="now-title"><p class="aside-label" id="now-title">NOW<span>${escapeHtml(profile.now.updated || '')}</span></p><dl>${profile.now.items.map(([label, text]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`).join('')}</dl></section>`
    : '';
  return `<aside class="sidebar"><div class="profile-card"><div class="avatar-tile">${avatarSprite(profile.avatar)}</div><h3>${escapeHtml(profile.handle)}</h3><ul class="focus-list">${profile.focus.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><div class="profile-links">${links}<a class="small-link" href="/?view=about" data-nav="about">关于 <span aria-hidden="true">→</span></a></div></div>${now}<p class="aside-note">当前文章与媒体均为演示内容。</p></aside>`;
}

function renderBlog() {
  main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">PERSONAL SITE<span class="slash">/</span>2026</div><h1>${escapeHtml(profile.handle)}<span>.</span></h1><h2>${escapeHtml(profile.tagline)}</h2><p>${escapeHtml(profile.intro)}</p><div class="hero-actions"><button class="button button-primary" data-action="browse">浏览文章 <span aria-hidden="true">↓</span></button><a class="button" href="/?view=graph" data-nav="graph">知识图谱 <span aria-hidden="true">→</span></a></div><a class="terminal-hint" href="/terminal/" data-nav="terminal"><span aria-hidden="true">›_</span> terminal</a></div><div class="hero-art">${pixelScene()}</div></section>
    <div class="content-grid"><section id="articles" aria-labelledby="articles-title"><div class="section-heading"><h2 id="articles-title">文章</h2><span class="count">00</span></div><div class="article-tools"><div class="topic-filters"><div class="filters" id="genre-filters" aria-label="文章分类"></div><div class="filters sub-filters" id="sub-filters" aria-label="子分类"></div></div><label class="search-field"><svg viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M5 1h5v1H5zM3 2h2v1H3zM10 2h2v1h-2zM2 3h1v2H2zM12 3h1v2h-1zM1 5h1v5H1zM13 5h1v5h-1zM2 10h1v2H2zM12 10h1v2h-1zM3 12h2v1H3zM10 12h2v1h-2zM5 13h5v1H5zM12 12h1v1h-1zM13 13h1v1h-1zM14 14h1v1h-1z"/></svg><input type="search" id="article-search" placeholder="搜索文章" aria-label="搜索文章"></label></div><div id="article-list"></div></section>
    ${sidebar()}</div>`;
  $('#article-search').value = search;
  renderArticleList();
  stopScene();
  stopScene = animateScene($('.pixel-scene'), { reducedMotion: reducedMotion.matches });
}
function filterButton(value, label, pressed) {
  return `<button class="filter" data-topic="${escapeHtml(value)}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
}
function renderFilters() {
  const [genreId] = topic.split('/');
  $('#genre-filters').innerHTML = [filterButton('', '全部', !topic), ...topics.map(genre => filterButton(genre.id, genre.name, genreId === genre.id))].join('');
  const genre = topics.find(item => item.id === genreId);
  $('#sub-filters').hidden = !genre || genre.subs.length < 2;
  $('#sub-filters').innerHTML = genre ? [filterButton(genre.id, '全部', topic === genre.id), ...genre.subs.map(sub => filterButton(`${genre.id}/${sub.id}`, sub.name, topic === `${genre.id}/${sub.id}`))].join('') : '';
}
function articleRow(article) {
  const link = el('a', 'article-row');
  link.href = `/articles/${article.id}/`;
  link.dataset.article = article.id;
  const { genre } = topicOf(article);
  const length = article.type === 'series' ? `${article.chapters.length} 章` : `${article.minutes} 分钟`;
  link.innerHTML = `<div class="article-meta"><span class="tag tag-${toneOf(genre?.id)}">${escapeHtml(topicOf(article).sub?.name || '')}</span>${date(article.updated || article.date)}<span>${length}</span></div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary)}</p>`;
  return link;
}
// Chapters are reached through their series, not listed on their own.
const listed = () => articles.filter(article => !article.series)
  .sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));
function renderArticleList() {
  if (!$('#article-list')) return;
  renderFilters();
  const query = search.trim().toLowerCase();
  const filtered = listed().filter(article => {
    if (topic && article.topic !== topic && !article.topic.startsWith(`${topic}/`)) return false;
    const { genre, sub } = topicOf(article);
    return `${article.title} ${article.summary} ${genre?.name} ${sub?.name}`.toLowerCase().includes(query);
  });
  $('#article-list').replaceChildren(...filtered.map(articleRow));
  if (!filtered.length) $('#article-list').append(el('p', 'empty-state', listed().length ? '没有匹配的文章。可以更换关键词或分类。' : '还没有公开的文章。'));
  $('.section-heading .count').textContent = String(filtered.length).padStart(2, '0');
}

export async function articleBody(article) {
  if (!bodies.has(article.id)) {
    // A prerendered page (/articles/<slug>/) already carries the body.
    const prerendered = document.querySelector(`.prose[data-article="${article.id}"]`);
    bodies.set(article.id, prerendered ? Promise.resolve(prerendered.innerHTML)
      : fetch(`/data/articles/${article.id}.html`).then(response => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      }).catch(error => { bodies.delete(article.id); throw error; }));
  }
  return bodies.get(article.id);
}
function linksSection(article) {
  const { outgoing, incoming } = neighbours(article);
  if (!outgoing.length && !incoming.length) return null;
  const list = (label, items) => items.length ? `<div><h3>${label}</h3><ul>${items.map(item => `<li><a href="/articles/${item.id}/" data-article="${item.id}">${escapeHtml(item.title)}</a></li>`).join('')}</ul></div>` : '';
  const section = el('section', 'article-links');
  section.setAttribute('aria-labelledby', 'links-title');
  section.innerHTML = `<h2 id="links-title">关联</h2><div class="article-links-body">${localGraph(article)}<div class="article-links-lists">${list('本文链接到', outgoing)}${list('链接到本文', incoming)}</div></div>`;
  attachHighlight(section.querySelector('svg'));
  return section;
}
/** Outline of ## and ### headings: a sticky sidebar on wide screens, a folded 目录 otherwise. */
function tableOfContents(prose) {
  const headings = [...prose.querySelectorAll('h2[id], h3[id]')];
  if (headings.length < 3) return null;
  const label = heading => {
    const copy = heading.cloneNode(true);
    copy.querySelectorAll('.katex-mathml').forEach(node => node.remove());
    return copy.textContent.trim();
  };
  const nav = el('nav', 'article-toc');
  nav.setAttribute('aria-label', '目录');
  nav.innerHTML = `<details><summary>目录</summary><ol>${headings.map(heading => `<li class="toc-${heading.localName}"><a href="#${encodeURIComponent(heading.id)}">${escapeHtml(label(heading))}</a></li>`).join('')}</ol></details>`;
  const details = nav.querySelector('details');
  const links = [...nav.querySelectorAll('a')];
  const sync = () => { details.open = wideToc.matches; };
  sync();
  wideToc.addEventListener('change', sync);
  nav.addEventListener('click', event => { if (event.target.closest('a') && !wideToc.matches) details.open = false; });
  // The current section is the last heading in the top 15% of the screen or above it.
  const update = () => {
    if (!prose.isConnected) return stopToc();
    let current = 0;
    headings.forEach((heading, index) => { if (heading.getBoundingClientRect().top < innerHeight * 0.15) current = index; });
    links.forEach((link, index) => index === current ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
    // Keep the current entry visible in a long sidebar.
    const active = links[current];
    if (wideToc.matches && (active.offsetTop < details.scrollTop || active.offsetTop + active.offsetHeight > details.scrollTop + details.clientHeight)) {
      details.scrollTop = active.offsetTop - details.clientHeight / 3;
    }
  };
  const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -85% 0px' });
  headings.forEach(heading => observer.observe(heading));
  stopToc = () => { observer.disconnect(); wideToc.removeEventListener('change', sync); };
  update();
  return nav;
}
const byId = id => articles.find(item => item.id === id);
const articleLink = (item, text = item.title) => `<a href="/articles/${item.id}/" data-article="${item.id}">${escapeHtml(text)}</a>`;

/** A series page lists its chapters; a chapter links back and to its neighbours. */
function seriesSection(article) {
  if (article.type === 'series') {
    const section = el('section', 'series-chapters');
    section.setAttribute('aria-labelledby', 'chapters-title');
    const chapters = article.chapters.map(byId).filter(Boolean);
    section.innerHTML = `<h2 id="chapters-title">目录</h2>${chapters.length ? `<ol>${chapters.map(item => `<li><span class="chapter-no">${String(item.chapter).padStart(2, '0')}</span>${articleLink(item)}${date(item.date)}</li>`).join('')}</ol>` : '<p class="empty-state">还没有公开的章节。</p>'}`;
    return section;
  }
  const series = byId(article.series);
  if (!series) return null;
  const at = series.chapters.indexOf(article.id);
  const [previous, next] = [byId(series.chapters[at - 1]), byId(series.chapters[at + 1])];
  const nav = el('nav', 'chapter-nav');
  nav.setAttribute('aria-label', '章节');
  nav.innerHTML = `${previous ? articleLink(previous, `← ${previous.title}`) : '<span></span>'}${articleLink(series, '目录')}${next ? articleLink(next, `${next.title} →`) : '<span></span>'}`;
  return nav;
}
function renderArticle(article) {
  stopToc();
  const fromTerminal = new URLSearchParams(location.search).get('from') === 'terminal';
  const { genre, sub } = topicOf(article);
  const series = article.series && byId(article.series);
  const container = el('article', 'article-page');
  const length = article.type === 'series' ? `${article.chapters.length} 章` : `${article.minutes} 分钟`;
  const kicker = series ? `<p class="series-kicker">${articleLink(series, `《${series.title}》`)} · 第 ${article.chapter} 章</p>` : '';
  container.innerHTML = `<a class="back-link" href="${fromTerminal ? '/terminal/' : '/?view=blog'}" data-nav="${fromTerminal ? 'terminal' : 'blog'}">← 返回${fromTerminal ? '终端' : '文章列表'}</a><div class="article-meta">${tag(article)}<span>${escapeHtml(genre?.name || '')} / ${escapeHtml(sub?.name || '')}</span>${date(article.date)}<span>${length}</span></div>${kicker}<h1>${escapeHtml(article.title)}</h1>${article.summary ? `<p class="article-lead muted">${escapeHtml(article.summary)}</p>` : ''}`;
  const prose = el('div', 'prose');
  prose.dataset.article = article.id;
  prose.setAttribute('aria-busy', 'true');
  const body = articleBody(article);
  const column = el('div', 'article-main');
  column.append(prose);
  container.append(column);
  const chapters = (article.type === 'series' || series) && seriesSection(article);
  if (chapters) container.append(chapters);
  const links = linksSection(article);
  if (links) container.append(links);
  main.replaceChildren(container);
  attachReadingProgress(container, { reducedMotion: reducedMotion.matches });
  body.then(html => {
    if (!prose.isConnected) return;
    prose.innerHTML = html;
    prose.removeAttribute('aria-busy');
    const settled = enhance(prose);
    const toc = tableOfContents(prose);
    if (toc) column.prepend(toc);
    // A #section link: jump now, and again once math fonts and diagrams have changed the layout.
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      target.scrollIntoView({ behavior: 'instant' });
      settled.then(() => { if (target.isConnected) target.scrollIntoView({ behavior: 'instant' }); });
    }
  }, () => {
    if (prose.isConnected) prose.replaceChildren(el('p', 'empty-state', '文章加载失败，请检查网络后刷新页面。'));
  });
}
function renderThoughts() {
  main.innerHTML = `${intro(`THOUGHTS / ${String(thoughts.length).padStart(2, '0')}`, '随想', '随手记下的句子和段落。')}<div class="thought-list"></div>`;
  const list = $('.thought-list');
  if (!thoughts.length) { list.append(el('p', 'empty-state', '还没有公开的随想。')); return; }
  for (const thought of thoughts) {
    const item = el('article', 'thought');
    item.id = `t-${thought.id}`;
    item.innerHTML = `<a class="thought-date" href="#t-${thought.id}"><time datetime="${thought.date.replace(' ', 'T')}">${thought.date.replaceAll('-', '.')}</time></a><div class="prose">${thought.html}</div>`;
    list.append(item);
    enhance(item);
  }
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  target?.scrollIntoView({ behavior: 'instant' });
}
function renderGraph() {
  // Square on phones, so labels stay readable without sideways scrolling.
  const size = main.clientWidth < 600 ? { width: 440, height: 440 } : { width: 800, height: 560 };
  main.innerHTML = `${intro(`GRAPH / ${String(articles.length).padStart(2, '0')}`, '知识图谱(still working on it...)', '点一下试试')}<div class="graph-frame">${globalGraph(size)}</div><ul class="graph-legend">${topics.map(genre => `<li><a class="tag tag-${toneOf(genre.id)}" href="/?view=blog" data-topic="${genre.id}">${escapeHtml(genre.name)}</a></li>`).join('')}</ul>`;
  attachHighlight($('.knowledge-graph'));
}
function intro(kicker,title,description) {
  return `<div class="page-intro"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`;
}
function renderAbout() {
  main.innerHTML = `${intro('ABOUT / THIS SITE','关于本站','Hanskrrr的个人网站')}<div class="about-body"><p>一个普通的知识/技术记录博客。</p><div class="about-list"><div><strong>我是谁</strong><span>尝试把知识拼凑成完整故事的人</span></div><div><strong>会看到什么</strong><span>对知识的反刍，一些想法，还有可能存在的角落</span></div></div></div>`;
}

export const blogPages = {
  blog: { title: '技术博客', render: renderBlog },
  article: { render: article => article && renderArticle(article) },
  graph: { title: '知识图谱', render: renderGraph },
  thoughts: { title: '随想', render: renderThoughts },
  about: { title: '关于', render: renderAbout },
};
