/**
 * Repeatable bookcase dimensions and placement for the square Alexandrpedia room.
 * The four wall pairs sit side by side with their backs against the walls.
 * Only the central AI pair uses the separate back-to-back arrangement.
 */
export const ORIGINAL_BOOKCASE_DIMENSIONS = Object.freeze({
  width: 0.8,
  depth: 0.34,
  height: 2.2,
});

export const WALL_BOOKCASE_GAP = 0.06;

/**
 * Get a wall-mounted bookcase's world position. sourceIndex 0 is Wikipedia
 * (left when looking toward the wall); sourceIndex 1 is Grokipedia (right).
 * Both fronts face inward, and the back edge is exactly tangent to the wall.
 */
export function wallCasePlacement({
  roomHalf,
  bay,
  sourceIndex,
  width = ORIGINAL_BOOKCASE_DIMENSIONS.width,
  depth = ORIGINAL_BOOKCASE_DIMENSIONS.depth,
  gap = WALL_BOOKCASE_GAP,
}) {
  if (!Number.isFinite(roomHalf) || roomHalf <= 0) {
    throw new RangeError('roomHalf must be a positive number.');
  }
  if (!bay || !Number.isFinite(bay.x) || !Number.isFinite(bay.z) || !Number.isFinite(bay.turn)) {
    throw new TypeError('bay must contain finite x, z, and turn values.');
  }
  if (sourceIndex !== 0 && sourceIndex !== 1) {
    throw new RangeError('sourceIndex must be 0 (Wikipedia) or 1 (Grokipedia).');
  }
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(depth) && depth > 0 && Number.isFinite(gap) && gap >= 0)) {
    throw new RangeError('bookcase dimensions and gap must be valid positive values.');
  }

  const wallDistance = roomHalf - Math.hypot(bay.x, bay.z);
  if (wallDistance < depth / 2) {
    throw new RangeError('The bay is too close to the wall for this bookcase depth.');
  }

  const localX = (sourceIndex === 0 ? -1 : 1) * (width + gap) / 2;
  const localZ = -(wallDistance - depth / 2);
  const cosine = Math.cos(bay.turn);
  const sine = Math.sin(bay.turn);

  return Object.freeze({
    x: bay.x + localX * cosine + localZ * sine,
    z: bay.z - localX * sine + localZ * cosine,
    rotationY: bay.turn,
    localX,
    localZ,
    width,
    depth,
    height: ORIGINAL_BOOKCASE_DIMENSIONS.height,
  });
}


export const CENTER_LONG_TABLE_DIMENSIONS = Object.freeze({ width: 2.4, depth: 0.9 });
export const CORNER_READING_TABLE_DIMENSIONS = Object.freeze({ width: 0.82, depth: 0.64 });
export const CORNER_TABLE_SETBACK = 2.1;
/**
 * Seated figures' knees reach about 0.5 m forward of the seat, so each chair's middle stands
 * this far from the table's edge (the desk's drawers are at that edge), not right beside it.
 */
export const SEATED_KNEE_CLEARANCE = 0.6;
// A corner table's corner lies about 0.52 m from its middle along the diagonal the chairs stand on.
export const CORNER_CHAIR_DISTANCE = 0.52 + SEATED_KNEE_CLEARANCE;
/**
 * Seat and table heights, in metres, sized to the human model (people/human): with his feet on the
 * floor, a seated reader's buttocks rest between 0.45 m (her) and 0.50 m (his). The engine's chairs use
 * this seat height by default. A desk stands about 0.30 m above the seat.
 */
export const SEAT_HEIGHT = 0.47;
export const TABLE_HEIGHT = 0.77;
export const CENTER_CHAIR_DIMENSIONS = Object.freeze({ depth: 0.44 });
/** The two chairs sit this far either side of the middle of a long table's outer side. */
export const CENTER_CHAIR_SPACING = 0.6;

/**
 * Two dining chairs on the outer long side of a central table, facing it. The inner side is kept
 * clear so the aisle to the back-to-back shelves stays open. `seat` is the middle of the pair.
 */
export function centerLongTableChairs({ side, offset = 1.75 } = {}) {
  const table = centerLongTablePlacement({ side, offset });
  const outward = side === 'left' ? -1 : 1;
  const x = table.x + outward * (table.depth / 2 + SEATED_KNEE_CLEARANCE);
  const rotationY = Math.atan2(-outward, 0); // the chair's front (+z) turns toward the table
  const chairs = [-1, 1].map((sign) => Object.freeze({ x, z: sign * CENTER_CHAIR_SPACING, rotationY }));
  return Object.freeze({
    chairs: Object.freeze(chairs),
    seat: Object.freeze({ x, z: 0 }),
  });
}

/** Two long shared tables flank the central AI cases without blocking either front aisle. */
export function centerLongTablePlacement({ side, offset = 1.75 } = {}) {
  if (side !== 'left' && side !== 'right') {
    throw new RangeError("side must be 'left' or 'right'.");
  }
  if (!Number.isFinite(offset) || offset < 0.9) {
    throw new RangeError('offset must leave clearance beside the central bookcases.');
  }
  return Object.freeze({
    side,
    x: side === 'left' ? -offset : offset,
    z: 0,
    rotationY: Math.PI / 2,
    ...CENTER_LONG_TABLE_DIMENSIONS,
  });
}

/** A compact table and chair tucked into one of the four open corners. */
export function cornerReadingNookPlacement({
  roomHalf,
  cornerX,
  cornerZ,
  setback = CORNER_TABLE_SETBACK,
  chairDistance = CORNER_CHAIR_DISTANCE,
}) {
  if (!Number.isFinite(roomHalf) || roomHalf <= 0) {
    throw new RangeError('roomHalf must be a positive number.');
  }
  if (![-1, 1].includes(cornerX) || ![-1, 1].includes(cornerZ)) {
    throw new RangeError('cornerX and cornerZ must each be -1 or 1.');
  }
  if (!Number.isFinite(setback) || setback <= 0 || setback >= roomHalf) {
    throw new RangeError('setback must be positive and smaller than roomHalf.');
  }
  if (!Number.isFinite(chairDistance) || chairDistance <= 0) {
    throw new RangeError('chairDistance must be positive.');
  }

  const table = {
    x: cornerX * (roomHalf - setback),
    z: cornerZ * (roomHalf - setback),
  };
  const inward = { x: -cornerX / Math.SQRT2, z: -cornerZ / Math.SQRT2 };

  // Four chairs stand on the table's diagonals, one per side of the corner. The first is
  // the inward chair, facing the room; the others sit beside it, all clear of the walls.
  const diagonals = [
    inward,
    { x: inward.z, z: -inward.x },
    { x: -inward.z, z: inward.x },
    { x: -inward.x, z: -inward.z },
  ];
  const chairs = diagonals.map((d) => Object.freeze({
    x: table.x + d.x * chairDistance,
    z: table.z + d.z * chairDistance,
    rotationY: Math.atan2(-d.x, -d.z),
  }));

  return Object.freeze({
    table: Object.freeze({
      ...table,
      rotationY: Math.atan2(inward.x, inward.z),
    }),
    chair: chairs[0],
    chairs: Object.freeze(chairs),
    ...CORNER_READING_TABLE_DIMENSIONS,
  });
}

/**
 * Which way a book on a table should lie, and where the camera should stand to read it. As in the
 * engine's hand-held book, the book's +z points toward the reader, so the first page is on the reader's left.
 * Both are yaw angles: the book's about +y, the camera's measured from +z as `view` uses it.
 */
export function readingOrientation({ table, seat }) {
  const toward = { x: seat.x - table.x, z: seat.z - table.z };
  return Object.freeze({
    bookYaw: Math.atan2(toward.x, toward.z),
    cameraYaw: Math.atan2(toward.x, toward.z),
  });
}

export const WALL_READING_CORNERS = Object.freeze({
  history: Object.freeze([
    Object.freeze({ cornerX: -1, cornerZ: -1 }),
    Object.freeze({ cornerX: 1, cornerZ: -1 }),
  ]),
  entertainment: Object.freeze([
    Object.freeze({ cornerX: 1, cornerZ: 1 }),
    Object.freeze({ cornerX: -1, cornerZ: 1 }),
  ]),
  philosophy: Object.freeze([
    Object.freeze({ cornerX: -1, cornerZ: 1 }),
    Object.freeze({ cornerX: -1, cornerZ: -1 }),
  ]),
});

/** Resolve a wall/source pair to the nearest shared corner reading nook. */
export function wallReadingNookPlacement({ roomHalf, sectionId, sourceIndex }) {
  const corners = WALL_READING_CORNERS[sectionId];
  if (!corners) throw new RangeError('Unknown wall section: ' + sectionId);
  if (sourceIndex !== 0 && sourceIndex !== 1) {
    throw new RangeError('sourceIndex must be 0 (Wikipedia) or 1 (Grokipedia).');
  }
  return cornerReadingNookPlacement({ roomHalf, ...corners[sourceIndex] });
}

export const WALL_SIGN_FRAME_EXTRA = 0.02;
export const WALL_SIGN_FRAME_CLEARANCE = WALL_BOOKCASE_GAP - WALL_SIGN_FRAME_EXTRA;
