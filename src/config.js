// The site-wide root entry. Explicit /terminal/ and ?view=blog links always win.
window.GALLERY_CONFIG = Object.freeze({
  defaultView: 'blog',
  theme: 'night',
  terminalTheme: 'blue',
  // The hidden uv style's mood: cyber (live), creepy or mirror (words in content/uv-text.js).
  mood: 'cyber',
});
