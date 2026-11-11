/**
 * The room as readers walk it: where they sit, and what is in their way. Built from the same layout numbers the
 * furniture is placed with (room-layout.js), so the two cannot drift apart.
 */

import {
  CENTER_LONG_TABLE_DIMENSIONS,
  CORNER_READING_TABLE_DIMENSIONS,
  ORIGINAL_BOOKCASE_DIMENSIONS,
  centerLongTableChairs,
  centerLongTablePlacement,
  cornerReadingNookPlacement,
} from './room-layout.js';

/** The four corner nooks, in the order the room builds them. */
export const NOOK_CORNERS = Object.freeze([
  Object.freeze({ cornerX: -1, cornerZ: -1 }),
  Object.freeze({ cornerX: 1, cornerZ: -1 }),
  Object.freeze({ cornerX: 1, cornerZ: 1 }),
  Object.freeze({ cornerX: -1, cornerZ: 1 }),
]);

/** How far in front of a chair a reader stands, facing the table, before sitting back onto it. */
export const SEAT_STAND = 0.38;
/** The room a walker keeps from a bookcase or a table (a chair is walked right up to). */
export const WALK_PAD = 0.18;
const CHAIR_PAD = 0.05;

/** Every place to sit in the corner nooks: `{ key, x, z, yaw, stand }`, `yaw` being the way the sitter faces. */
export function readerSeats({ roomHalf }) {
  return NOOK_CORNERS.flatMap((corner, cornerIndex) => {
    const nook = cornerReadingNookPlacement({ roomHalf, ...corner });
    return nook.chairs.map((spot, chairIndex) => ({
      key: `${cornerIndex}:${chairIndex}`,
      x: spot.x,
      z: spot.z,
      yaw: spot.rotationY,
      stand: { x: spot.x + Math.sin(spot.rotationY) * SEAT_STAND, z: spot.z + Math.cos(spot.rotationY) * SEAT_STAND },
    }));
  });
}

/**
 * What readers walk round: the bookcases (`cases`: `{ x, z, rotation }` each), the two long tables and the corner
 * tables, and every chair. Rectangles for `createNavigator`.
 */
export function walkObstacles({ roomHalf, cases }) {
  const out = [];
  for (const shelf of cases) {
    out.push({ x: shelf.x, z: shelf.z, hw: ORIGINAL_BOOKCASE_DIMENSIONS.width / 2, hd: ORIGINAL_BOOKCASE_DIMENSIONS.depth / 2, rotation: shelf.rotation, pad: WALK_PAD });
  }
  for (const side of ['left', 'right']) {
    const table = centerLongTablePlacement({ side });
    out.push({ x: table.x, z: table.z, hw: CENTER_LONG_TABLE_DIMENSIONS.width / 2, hd: CENTER_LONG_TABLE_DIMENSIONS.depth / 2, rotation: table.rotationY, pad: WALK_PAD });
    for (const spot of centerLongTableChairs({ side }).chairs) {
      out.push({ x: spot.x, z: spot.z, hw: 0.24, hd: 0.24, rotation: spot.rotationY, pad: CHAIR_PAD });
    }
  }
  for (const corner of NOOK_CORNERS) {
    const nook = cornerReadingNookPlacement({ roomHalf, ...corner });
    out.push({ x: nook.table.x, z: nook.table.z, hw: CORNER_READING_TABLE_DIMENSIONS.width / 2, hd: CORNER_READING_TABLE_DIMENSIONS.depth / 2, rotation: nook.table.rotationY, pad: WALK_PAD });
    for (const spot of nook.chairs) {
      out.push({ x: spot.x, z: spot.z, hw: 0.3, hd: 0.28, rotation: spot.rotationY, pad: CHAIR_PAD });
    }
  }
  return out;
}
