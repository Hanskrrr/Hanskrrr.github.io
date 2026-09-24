// Blog pages: home (hero + article list by topic), article, knowledge graph, projects and about.
// Articles come from the vault via scripts/publish.mjs: metadata in content/articles.js,
// bodies as pre-rendered HTML in /data/articles/<slug>.html.
import { $, el, main, reducedMotion } from '../core/dom.js';
import { app } from '../core/router.js';
import { articles, topics } from '../content/articles.js';
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
  link.innerHTML = `<div class="article-meta"><span class="tag tag-${toneOf(genre?.id)}">${escapeHtml(topicOf(article).sub?.name || '')}</span>${date(article.date)}<span>${article.minutes} 分钟</span></div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary)}</p>`;
  return link;
}
function renderArticleList() {
  if (!$('#article-list')) return;
  renderFilters();
  const query = search.trim().toLowerCase();
  const filtered = articles.filter(article => {
    if (topic && article.topic !== topic && !article.topic.startsWith(`${topic}/`)) return false;
    const { genre, sub } = topicOf(article);
    return `${article.title} ${article.summary} ${genre?.name} ${sub?.name}`.toLowerCase().includes(query);
  });
  $('#article-list').replaceChildren(...filtered.map(articleRow));
  if (!filtered.length) $('#article-list').append(el('p', 'empty-state', articles.length ? '没有匹配的文章。可以更换关键词或分类。' : '还没有公开的文章。'));
  $('.section-heading .count').textContent = String(filtered.length).padStart(2, '0');
}

async function articleBody(article) {
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
function renderArticle(article) {
  const fromTerminal = new URLSearchParams(location.search).get('from') === 'terminal';
  const { genre, sub } = topicOf(article);
  const container = el('article', 'article-page');
  container.innerHTML = `<a class="back-link" href="${fromTerminal ? '/terminal/' : '/?view=blog'}" data-nav="${fromTerminal ? 'terminal' : 'blog'}">← 返回${fromTerminal ? '终端' : '文章列表'}</a><div class="article-meta">${tag(article)}<span>${escapeHtml(genre?.name || '')} / ${escapeHtml(sub?.name || '')}</span>${date(article.date)}<span>${article.minutes} 分钟</span></div><h1>${escapeHtml(article.title)}</h1><p class="article-lead muted">${escapeHtml(article.summary)}</p>`;
  const prose = el('div', 'prose');
  prose.dataset.article = article.id;
  prose.setAttribute('aria-busy', 'true');
  const body = articleBody(article);
  container.append(prose);
  const links = linksSection(article);
  if (links) container.append(links);
  main.replaceChildren(container);
  attachReadingProgress(container, { reducedMotion: reducedMotion.matches });
  body.then(html => {
    if (!prose.isConnected) return;
    prose.innerHTML = html;
    prose.removeAttribute('aria-busy');
    enhance(prose);
  }, () => {
    if (prose.isConnected) prose.replaceChildren(el('p', 'empty-state', '文章加载失败，请检查网络后刷新页面。'));
  });
}
function renderGraph() {
  // Square on phones, so labels stay readable without sideways scrolling.
  const size = main.clientWidth < 600 ? { width: 440, height: 440 } : { width: 800, height: 560 };
  main.innerHTML = `${intro(`GRAPH / ${String(articles.length).padStart(2, '0')}`, '知识图谱', '小方块是文章，按主题挂在分类下；实线是文章之间的链接。点方块打开文章，点分类查看该分类的文章。')}<div class="graph-frame">${globalGraph(size)}</div><ul class="graph-legend">${topics.map(genre => `<li><a class="tag tag-${toneOf(genre.id)}" href="/?view=blog" data-topic="${genre.id}">${escapeHtml(genre.name)}</a></li>`).join('')}</ul>`;
  attachHighlight($('.knowledge-graph'));
}
function intro(kicker,title,description) {
  return `<div class="page-intro"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`;
}
function renderProjects() {
  main.innerHTML = `${intro('PROJECTS / 03','项目','当前演示中的三个组成部分。')}<div class="project-grid"><article class="project-card"><span>01 / BLOG</span><h2>技术博客</h2><p>文章分类、关键词搜索和独立阅读界面。</p><a class="small-link" href="/?view=blog" data-nav="blog">查看文章 <span aria-hidden="true">→</span></a></article><article class="project-card"><span>02 / TERMINAL</span><h2>交互终端</h2><p>通过指令浏览公开内容，支持历史记录和自动补全。</p><a class="small-link" href="/terminal/" data-nav="terminal">打开终端 <span aria-hidden="true">→</span></a></article><article class="project-card"><span>03 / APPEARANCE</span><h2>两种像素配色</h2><p>点右上角的方块，在夜空与纸页之间切换。</p><button class="small-link" data-action="toggle-theme">切换配色 <span aria-hidden="true">→</span></button></article></div>`;
}
function renderAbout() {
  main.innerHTML = `${intro('ABOUT / THIS SITE','关于本站','Hanskrrr 的个人网站设计演示。')}<div class="about-body"><p>这个网站以技术博客作为常规入口，并提供一个可以执行指令的终端。内容形式包括文章、图片和音频。</p><div class="about-list"><div><strong>视觉风格</strong><span>像素风格，以靛蓝与紫色为主，淡黄与薄荷绿点缀；正文保留清晰的系统字体。可在右上角切换两种配色。</span></div><div><strong>内容状态</strong><span>当前文章、图片与音频均为示例，供检查布局和交互。</span></div><div><strong>浏览方式</strong><span>使用顶部导航阅读文章和项目；在页脚进入终端，输入 help 查看公开指令。</span></div></div></div>`;
}

export const blogPages = {
  blog: { title: '技术博客', render: renderBlog },
  article: { render: article => article && renderArticle(article) },
  graph: { title: '知识图谱', render: renderGraph },
  projects: { title: '项目', render: renderProjects },
  about: { title: '关于', render: renderAbout },
};
