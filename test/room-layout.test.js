import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTER_CHAIR_SPACING,
  SEATED_KNEE_CLEARANCE,
  CENTER_LONG_TABLE_DIMENSIONS,
  CORNER_READING_TABLE_DIMENSIONS,
  WALL_READING_CORNERS,
  centerLongTableChairs,
  centerLongTablePlacement,
  cornerReadingNookPlacement,
  readingOrientation,
  wallReadingNookPlacement,
} from '../src/room-layout.js';
import { WALL_SIGN_FRAME_CLEARANCE, WALL_SIGN_FRAME_EXTRA, SEAT_HEIGHT, TABLE_HEIGHT } from '../src/room-layout.js';
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


const ROOM_HALF = 7.2;

test('two long tables flank the central AI shelves with open front aisles', () => {
  const left = centerLongTablePlacement({ side: 'left' });
  const right = centerLongTablePlacement({ side: 'right' });
  assert.equal(left.x, -1.75);
  assert.equal(right.x, 1.75);
  assert.equal(left.rotationY, Math.PI / 2);
  assert.equal(right.rotationY, Math.PI / 2);
  assert.deepEqual(CENTER_LONG_TABLE_DIMENSIONS, { width: 2.4, depth: 0.9 });
  const innerEdge = 1.75 - left.depth / 2;
  assert.ok(innerEdge - ORIGINAL_BOOKCASE_DIMENSIONS.width / 2 >= 0.8);
});

test('four corner nooks put a compact table near each corner with a chair facing it', () => {
  const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const nooks = corners.map(([cornerX, cornerZ]) =>
    cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX, cornerZ }),
  );
  assert.equal(nooks.length, 4);
  assert.deepEqual(CORNER_READING_TABLE_DIMENSIONS, { width: 0.82, depth: 0.64 });
  for (const nook of nooks) {
    assert.ok(Math.abs(nook.table.x) > 5.0 && Math.abs(nook.table.z) > 5.0);
    assert.ok(Math.abs(nook.chair.x) < ROOM_HALF && Math.abs(nook.chair.z) < ROOM_HALF);
    const vx = nook.table.x - nook.chair.x;
    const vz = nook.table.z - nook.chair.z;
    const facing = { x: Math.sin(nook.chair.rotationY), z: Math.cos(nook.chair.rotationY) };
    assert.ok(vx * facing.x + vz * facing.z > 0.9);
  }
});

test('wall/source book reading positions map to the adjacent corner tables', () => {
  const expected = {
    history: [[-1, -1], [1, -1]],
    science: [[1, -1], [1, 1]],
    entertainment: [[1, 1], [-1, 1]],
    philosophy: [[-1, 1], [-1, -1]],
  };
  assert.deepEqual(Object.keys(WALL_READING_CORNERS), Object.keys(expected));
  for (const [sectionId, pairs] of Object.entries(expected)) {
    pairs.forEach(([cornerX, cornerZ], sourceIndex) => {
      const nook = wallReadingNookPlacement({ roomHalf: ROOM_HALF, sectionId, sourceIndex });
      assert.equal(Math.sign(nook.table.x), cornerX);
      assert.equal(Math.sign(nook.table.z), cornerZ);
    });
  }
});

test('corner tables are kept well clear of the central long tables', () => {
  const longTables = [
    centerLongTablePlacement({ side: 'left' }),
    centerLongTablePlacement({ side: 'right' }),
  ];
  for (const [cornerX, cornerZ] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const nook = cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX, cornerZ });
    for (const table of longTables) {
      assert.ok(Math.hypot(nook.table.x - table.x, nook.table.z - table.z) > 4.5);
    }
  }
});

test('invalid furniture placement arguments are rejected', () => {
  assert.throws(() => centerLongTablePlacement({ side: 'north' }), /side/);
  assert.throws(() => cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX: 0, cornerZ: 1 }), /cornerX/);
  assert.throws(() => wallReadingNookPlacement({ roomHalf: ROOM_HALF, sectionId: 'unknown', sourceIndex: 0 }), /Unknown wall section/);
});

test('the two wall plaque frames have a visible gap and cannot overlap', () => {
  assert.equal(WALL_SIGN_FRAME_EXTRA, 0.02);
  assert.ok(WALL_SIGN_FRAME_CLEARANCE > 0);
  assert.ok(Math.abs(WALL_SIGN_FRAME_CLEARANCE - 0.04) < 1e-9);
});

test('each central long table has two chairs on its outer side, facing it, leaving the aisle open', () => {
  for (const side of ['left', 'right']) {
    const table = centerLongTablePlacement({ side });
    const { chairs, seat } = centerLongTableChairs({ side });
    assert.equal(chairs.length, 2);
    const outward = side === 'left' ? -1 : 1;
    for (const chair of chairs) {
      assert.ok(Math.sign(chair.x - table.x) === outward, `${side}: chair must be on the outer side`);
      assert.ok(Math.abs(Math.abs(chair.x - table.x) - (table.depth / 2 + SEATED_KNEE_CLEARANCE)) < 1e-9);
      assert.ok(Math.abs(Math.abs(chair.z) - CENTER_CHAIR_SPACING) < 1e-9);
      // The chair's front (+z) turns toward the table: the table lies along +x or -x from it.
      assert.ok(Math.abs(Math.sin(chair.rotationY) - (-outward)) < 1e-9);
    }
    assert.ok(Math.abs(chairs[0].z - -chairs[1].z) < 1e-9, 'the pair is centred on the table');
    assert.ok(Math.abs(seat.z) < 1e-9 && Math.sign(seat.x - table.x) === outward);
  }
});

test('each corner has four chairs spaced well apart and clear of the walls', () => {
  for (const [cornerX, cornerZ] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const { chairs, table } = cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX, cornerZ });
    assert.equal(chairs.length, 4);
    for (let i = 0; i < chairs.length; i++) {
      for (let j = i + 1; j < chairs.length; j++) {
        const gap = Math.hypot(chairs[i].x - chairs[j].x, chairs[i].z - chairs[j].z);
        assert.ok(gap > 1.3, `chairs ${i} and ${j} at one corner are ${gap.toFixed(2)} m apart`);
      }
      // A chair's footprint reaches about 0.4 m from its middle, so keep its middle 1.2 m from each wall.
      assert.ok(ROOM_HALF - Math.abs(chairs[i].x) >= 1.2, 'chair too close to the x wall');
      assert.ok(ROOM_HALF - Math.abs(chairs[i].z) >= 1.2, 'chair too close to the z wall');
      const facing = { x: Math.sin(chairs[i].rotationY), z: Math.cos(chairs[i].rotationY) };
      const toTable = { x: table.x - chairs[i].x, z: table.z - chairs[i].z };
      assert.ok(toTable.x * facing.x + toTable.z * facing.z > 0.9, `chair ${i} must face its table`);
    }
  }
});

test('a book lies with its head away from the reader and the camera stands on the reader\'s side', () => {
  const center = centerLongTablePlacement({ side: 'left' });
  const { seat } = centerLongTableChairs({ side: 'left' });
  const { bookYaw, cameraYaw } = readingOrientation({ table: center, seat });
  // Head (+z) points toward the far side of the table, which is +x for the left table.
  assert.ok(Math.abs(Math.sin(bookYaw) - 1) < 1e-9);
  // The camera stands on the outer side, at -x, which is where the reader sits.
  assert.ok(Math.abs(Math.sin(cameraYaw) + 1) < 1e-9);
  const corner = cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX: -1, cornerZ: -1 });
  const cornerView = readingOrientation({ table: corner.table, seat: corner.chair });
  // Seated at the inward chair, the camera looks in from the corner's own diagonal.
  assert.ok(Math.abs(cornerView.cameraYaw - Math.PI / 4) < 1e-9);
});

test('seats and tables are sized for a seated reader: the desk stands about 0.27 m above the seat', () => {
  assert.ok(SEAT_HEIGHT >= 0.48 && SEAT_HEIGHT <= 0.52, 'seat height matches the measured buttock height');
  const clearance = TABLE_HEIGHT - SEAT_HEIGHT;
  assert.ok(clearance >= 0.25 && clearance <= 0.3, `desk clearance ${clearance.toFixed(2)} m`);
});
