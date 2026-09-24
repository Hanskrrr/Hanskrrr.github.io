// Blog pages: home (hero + article list), article, projects and about.
import { $, el, main, reducedMotion } from '../core/dom.js';
import { articles } from '../content/articles.js';
import { monitorSprite, pixelScene } from './pixel-art.js';
import { animateScene } from './scene.js';

const categoryTone = { Web: 'blue', JavaScript: 'yellow', '安全': 'green', UI: 'purple' };
let category = '全部';
let search = '';
let stopScene = () => {};

export function setCategory(value) { category = value; renderArticleList(); }
export function setSearch(value) { search = value; renderArticleList(); }

function tag(category) {
  return `<span class="tag tag-${categoryTone[category] || 'blue'}">${category}</span>`;
}
function renderBlog() {
  const topics = Object.keys(categoryTone);
  main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">TECHNICAL BLOG<span class="slash">/</span>2026</div><h1>Hanskrrr<span>.</span></h1><h2>技术文章与开发记录</h2><p>前端开发、计算机基础与个人项目。</p><div class="hero-actions"><button class="button button-primary" data-action="browse">浏览文章 <span aria-hidden="true">↓</span></button><a class="button" href="/?view=projects" data-nav="projects">查看项目 <span aria-hidden="true">→</span></a></div></div><div class="hero-art">${pixelScene()}</div></section>
    <div class="content-grid"><section id="articles" aria-labelledby="articles-title"><div class="section-heading"><h2 id="articles-title">最新文章</h2><span class="count">04</span><span>INDEX 001-004</span></div><div class="article-tools"><div class="filters" aria-label="文章分类">${['全部', ...topics].map(value => `<button class="filter" data-filter="${value}" aria-pressed="${category === value}">${value}</button>`).join('')}</div><label class="search-field"><svg viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M5 1h5v1H5zM3 2h2v1H3zM10 2h2v1h-2zM2 3h1v2H2zM12 3h1v2h-1zM1 5h1v5H1zM13 5h1v5h-1zM2 10h1v2H2zM12 10h1v2h-1zM3 12h2v1H3zM10 12h2v1h-2zM5 13h5v1H5zM12 12h1v1h-1zM13 13h1v1h-1zM14 14h1v1h-1z"/></svg><input type="search" id="article-search" placeholder="搜索文章" aria-label="搜索文章"></label></div><div id="article-list"></div></section>
    <aside class="sidebar"><p class="aside-label">ABOUT</p><div class="profile-card">${monitorSprite()}<h3>一个个人网站</h3><p>以博客为入口，展示文章、项目、图片和音频。</p><a href="/?view=about" data-nav="about" class="small-link">关于本站 <span aria-hidden="true">→</span></a></div><div class="topic-list"><p class="aside-label">TOPICS</p>${topics.map(value => `<button data-filter="${value}"><span>${value}</span><span>${String(articles.filter(article => article.category === value).length).padStart(2, '0')}</span></button>`).join('')}</div><p class="aside-note">当前文章与媒体均为演示内容。</p></aside></div>`;
  $('#article-search').value = search;
  renderArticleList();
  stopScene();
  stopScene = animateScene($('.pixel-scene'), { reducedMotion: reducedMotion.matches });
}
function articleRow(article) {
  const link = el('a', 'article-row');
  link.href = `/?article=${article.id}`;
  link.dataset.article = article.id;
  link.innerHTML = `<div class="article-meta">${tag(article.category)}<time datetime="2026-09-23">2026.09.23</time><span>示例文章 · ${article.minutes} 分钟</span></div><h3>${article.title}</h3><p>${article.description}</p>`;
  return link;
}
function renderArticleList() {
  const filtered = articles.filter(article => (category === '全部' || article.category === category) && `${article.title} ${article.description} ${article.category}`.toLowerCase().includes(search.toLowerCase()));
  $('#article-list').replaceChildren(...filtered.map(articleRow));
  if (!filtered.length) $('#article-list').append(el('p','empty-state','没有匹配的文章。可以更换关键词或分类。'));
  $('.section-heading .count').textContent = String(filtered.length).padStart(2,'0');
  document.querySelectorAll('.filter').forEach(button => button.setAttribute('aria-pressed', button.dataset.filter === category));
}
function renderArticle(article) {
  const fromTerminal = new URLSearchParams(location.search).get('from') === 'terminal';
  const container = el('article','article-page');
  container.innerHTML = `<a class="back-link" href="${fromTerminal ? '/terminal/' : '/?view=blog'}" data-nav="${fromTerminal ? 'terminal' : 'blog'}">← 返回${fromTerminal ? '终端' : '文章列表'}</a><div class="article-meta">${tag(article.category)}<span>示例文章 · ${article.minutes} 分钟</span></div><h1>${article.title}</h1><p class="article-lead muted">${article.description}</p>`;
  const prose = el('div','prose');
  article.sections.forEach(([title,body]) => prose.append(el('h2','',title), el('p','',body)));
  container.append(prose, el('div','article-footnote','本文为网站布局与交互的示例内容，可在正式开发时替换。'));
  main.replaceChildren(container);
}
function intro(kicker,title,description) {
  return `<div class="page-intro"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`;
}
function renderProjects() {
  main.innerHTML = `${intro('PROJECTS / 03','项目','当前演示中的三个组成部分。')}<div class="project-grid"><article class="project-card"><span>01 / BLOG</span><h2>技术博客</h2><p>文章分类、关键词搜索和独立阅读界面。</p><a class="small-link" href="/?view=blog" data-nav="blog">查看文章 <span aria-hidden="true">→</span></a></article><article class="project-card"><span>02 / TERMINAL</span><h2>交互终端</h2><p>通过指令浏览公开内容，支持历史记录和自动补全。</p><a class="small-link" href="/terminal/" data-nav="terminal">打开终端 <span aria-hidden="true">→</span></a></article><article class="project-card"><span>03 / APPEARANCE</span><h2>两种像素配色</h2><p>切换夜空与纸页，也可以调整本机默认入口。</p><button class="small-link" data-action="settings">界面设置 <span aria-hidden="true">→</span></button></article></div>`;
}
function renderAbout() {
  main.innerHTML = `${intro('ABOUT / THIS SITE','关于本站','Hanskrrr 的个人网站设计演示。')}<div class="about-body"><p>这个网站以技术博客作为常规入口，并提供一个可以执行指令的终端。内容形式包括文章、图片和音频。</p><div class="about-list"><div><strong>视觉风格</strong><span>像素风格，以靛蓝与紫色为主，淡黄与薄荷绿点缀；正文保留清晰的系统字体。可在右上角切换两种配色。</span></div><div><strong>内容状态</strong><span>当前文章、图片与音频均为示例，供检查布局和交互。</span></div><div><strong>浏览方式</strong><span>使用顶部导航阅读文章和项目；在页脚进入终端，输入 help 查看公开指令。</span></div></div></div>`;
}

export const blogPages = {
  blog: { title: '技术博客', render: renderBlog },
  article: { render: article => article && renderArticle(article) },
  projects: { title: '项目', render: renderProjects },
  about: { title: '关于', render: renderAbout },
};
