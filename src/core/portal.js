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
