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
