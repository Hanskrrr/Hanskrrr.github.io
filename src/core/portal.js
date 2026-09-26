// The creature's secret path between the room, the homepage picture and the pixel world
// (vault/exhibit.js sets these; blog/scene.js reads them).
export const portal = {
  /** 'right' or 'left': the side it walks into the homepage picture from; null when not visiting. */
  visitor: null,
  /** Goes back into the room (null when there is no room to go back to). */
  back: null,
  /** Goes on into the pixel world. */
  world: null,
};

// Once the letter at the end of the world has been read, it also lies on the room's desk (room.js).
// Only this flag is kept (in this browser); the letter itself stays inside the locked room.
export const letterRead = {
  get() { try { return localStorage.getItem('gallery-letter') === '1'; } catch { return false; } },
  set() { try { localStorage.setItem('gallery-letter', '1'); } catch { /* private mode: just this visit */ } },
};
