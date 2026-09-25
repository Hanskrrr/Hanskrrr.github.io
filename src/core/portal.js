// The creature's secret path between the room (vault/room.js) and the homepage picture
// (blog/scene.js): walking out of the room's left wall lands it in the picture; walking out of
// the picture's right edge takes it back. vault/exhibit.js sets these while the room is kept.
export const portal = {
  /** True while the creature is visiting the homepage picture. */
  visitor: false,
  /** Goes back into the room (null when there is no room to go back to). */
  back: null,
};
