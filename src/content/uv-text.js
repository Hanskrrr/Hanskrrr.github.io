// The page's words under the uv style (unlocked in the terminal with `theme uv`).
// Edit freely. A missing key keeps the normal text. `mood` in config.js picks the set;
// only `cyber` is live, `creepy` and `mirror` are there to try out.
// `reverse: true` reads every normal line backwards, unless the key is given here.
export const uvText = {
  cyber: {
    unlock: 'UV ON。回到博客，把光照在字上。',
    brand: 'Z3SP3J0',
    brandSub: '/ UV://',
    navBlog: '表层',
    navGraph: '连接',
    navAbout: '身份',
    handle: 'Z3SP3J0',
    tagline: 'Signal · Noise · Something Underneath',
    intro: '一些像素实验和笔记。还有一些，写在光照不到的地方。',
    footer: '© 2026 Zespejo · 你正在用紫外线看这一页',
    lostEyebrow: '404 // 信号丢失',
    lostTitle: '这里什么都没有',
    lostText: '本来什么都没有。但你现在开着灯，不妨多等一会儿。',
    lostButton: '回到表层',
    creature: ['你身上有紫色的光。', '墙上的字……以前就在那里吗？', '别关灯。', '我好像能看见你了。'],
  },
  creepy: {
    unlock: '……灯坏了。回去看看吧。',
    brand: 'Zespejo?',
    navAbout: '关于谁',
    handle: 'ZESPEJ0',
    tagline: 'Knowledge · Inspiration · You Are Not Alone Here',
    intro: '一些像素实验和笔记，和一个一直在看的东西。',
    footer: '© 2026 Zespejo · 你来过这里',
    lostEyebrow: '404',
    lostTitle: '你不该在这里',
    lostText: '这个地址不存在。那你是怎么走到这里的？',
    lostButton: '快回去',
    creature: ['……你也看到了吗？', '昨晚有人敲窗。', '不要回头。', '我数过，这里本来有八本书。'],
  },
  mirror: {
    reverse: true,
    unlock: '。子镜看看去回',
    creature: ['。你是我', '？边一哪在你', '。的反是都字的里这'],
  },
};
