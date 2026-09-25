// Third-party players allowed in the room (films and music): a link to a video or song
// page becomes that site's embed URL at publish time; the browser only frames these hosts,
// and only after the visitor asks to load the player.
const HOSTS = {
  'player.bilibili.com': { path: /^\/player\.html$/, aspect: '16 / 9' },
  'www.youtube-nocookie.com': { path: /^\/embed\/[\w-]+$/, aspect: '16 / 9' },
  'music.163.com': { path: /^\/outchain\/player$/, height: 86 },
  'open.spotify.com': { path: /^\/embed\/(track|album|playlist|episode)\/\w+$/, height: 152 },
  'embed.music.apple.com': { path: /^\//, height: 175 },
};

export function isAllowedEmbed(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Object.hasOwn(HOSTS, parsed.hostname) && HOSTS[parsed.hostname].path.test(parsed.pathname);
  } catch { return false; }
}

/** Frame size for an allowed embed: { aspect } for video, { height } for audio players. */
export function embedSize(url) {
  const { hostname, pathname } = new URL(url);
  if (hostname === 'open.spotify.com' && !/\/embed\/(track|episode)\//.test(pathname)) return { height: 352 };
  if (hostname === 'music.163.com' && !/[?&]type=2(&|$)/.test(url)) return { height: 450 };
  if (hostname === 'embed.music.apple.com' && !/[?&]i=/.test(url)) return { height: 450 };
  const { aspect, height } = HOSTS[hostname];
  return aspect ? { aspect } : { height };
}

/** A page link (bilibili, YouTube, NetEase Cloud Music, Spotify, Apple Music) → embed URL, or null. */
export function toEmbed(link) {
  let url;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (isAllowedEmbed(url.href.replace(/^http:/, 'https:'))) return url.href.replace(/^http:/, 'https:');
  const host = url.hostname.replace(/^(www|m)\./, '');
  if (host === 'bilibili.com' || host === 'b23.tv') {
    const bv = /\/video\/(BV[0-9A-Za-z]+)/.exec(url.pathname)?.[1];
    const av = /\/video\/av(\d+)/.exec(url.pathname)?.[1];
    if (bv) return `https://player.bilibili.com/player.html?bvid=${bv}&autoplay=0`;
    if (av) return `https://player.bilibili.com/player.html?aid=${av}&autoplay=0`;
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || /\/(?:embed|shorts)\/([\w-]+)/.exec(url.pathname)?.[1];
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === 'music.163.com') {
    // Links look like https://music.163.com/#/song?id=123 (the id sits in the hash).
    const route = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), 'https://music.163.com') : url;
    const id = route.searchParams.get('id');
    const type = { '/song': 2, '/album': 1, '/playlist': 0 }[route.pathname];
    if (id && /^\d+$/.test(id) && type !== undefined) return `https://music.163.com/outchain/player?type=${type}&id=${id}&auto=0&height=${type === 2 ? 66 : 430}`;
  }
  if (host === 'open.spotify.com') {
    const match = /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([0-9A-Za-z]+)/.exec(url.pathname);
    if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  if (host === 'music.apple.com') return `https://embed.music.apple.com${url.pathname}${url.search}`;
  return null;
}
