import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGINAL_BOOKCASE_DIMENSIONS,
  WALL_BOOKCASE_GAP,
  wallCasePlacement,
} from '../src/room-layout.js';

const HALF = 7.2;
const bays = [
  { name: 'north', bay: { x: 0, z: -4.35, turn: 0 }, wall: 'north' },
  { name: 'east', bay: { x: 4.35, z: 0, turn: -Math.PI / 2 }, wall: 'east' },
  { name: 'south', bay: { x: 0, z: 4.35, turn: Math.PI }, wall: 'south' },
  { name: 'west', bay: { x: -4.35, z: 0, turn: Math.PI / 2 }, wall: 'west' },
];

test('wall bookcases preserve the original engine dimensions', () => {
  assert.deepEqual(ORIGINAL_BOOKCASE_DIMENSIONS, { width: 0.8, depth: 0.34, height: 2.2 });
  assert.equal(WALL_BOOKCASE_GAP, 0.06);
});

test('each wall pair is side by side with both fronts facing into the room', () => {
  for (const { name, bay } of bays) {
    const wikipedia = wallCasePlacement({ roomHalf: HALF, bay, sourceIndex: 0 });
    const grokipedia = wallCasePlacement({ roomHalf: HALF, bay, sourceIndex: 1 });
    assert.equal(wikipedia.rotationY, bay.turn, `${name}: Wikipedia must face inward`);
    assert.equal(grokipedia.rotationY, bay.turn, `${name}: Grokipedia must face inward`);
    assert.ok(Math.abs(Math.hypot(wikipedia.x - grokipedia.x, wikipedia.z - grokipedia.z) - 0.86) < 1e-9);
    assert.ok(Math.abs(wikipedia.width - 0.8) < 1e-9);
    assert.ok(Math.abs(grokipedia.depth - 0.34) < 1e-9);
  }
});

test('each wall case back sits exactly on the wall plane', () => {
  for (const { name, bay, wall } of bays) {
    for (const sourceIndex of [0, 1]) {
      const p = wallCasePlacement({ roomHalf: HALF, bay, sourceIndex });
      const rear = {
        x: p.x - Math.sin(p.rotationY) * p.depth / 2,
        z: p.z - Math.cos(p.rotationY) * p.depth / 2,
      };
      const coordinate = wall === 'north' || wall === 'south' ? rear.z : rear.x;
      const expected = wall === 'north' || wall === 'west' ? -HALF : HALF;
      assert.ok(Math.abs(coordinate - expected) < 1e-9, `${name}: bookcase back should touch wall`);
    }
  }
});

test('bookcases are separated by the requested gap without overlapping', () => {
  const [left, right] = [0, 1].map((sourceIndex) =>
    wallCasePlacement({ roomHalf: HALF, bay: bays[0].bay, sourceIndex }),
  );
  const centers = [left, right].sort((a, b) => a.localX - b.localX);
  const actualGap = centers[1].localX - centers[0].localX - centers[0].width;
  assert.ok(Math.abs(actualGap - WALL_BOOKCASE_GAP) < 1e-9);
});

test('invalid room and source parameters are rejected', () => {
  assert.throws(() => wallCasePlacement({ roomHalf: 0, bay: bays[0].bay, sourceIndex: 0 }), /roomHalf/);
  assert.throws(() => wallCasePlacement({ roomHalf: HALF, bay: bays[0].bay, sourceIndex: 2 }), /sourceIndex/);
  assert.throws(() => wallCasePlacement({ roomHalf: HALF, bay: null, sourceIndex: 0 }), /bay/);
});
