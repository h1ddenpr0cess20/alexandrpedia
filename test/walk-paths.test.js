import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavigator, rectContains, segmentCrosses } from '../src/walk-paths.js';
import { SEAT_STAND, WALK_PAD, readerSeats, walkObstacles } from '../src/room-plan.js';
import { ORIGINAL_BOOKCASE_DIMENSIONS, wallCasePlacement } from '../src/room-layout.js';

const HALF = 7.2;

test('a rectangle is tested in its own turned frame', () => {
  const box = { x: 2, z: 1, hw: 1, hd: 0.25, rotation: Math.PI / 2 };
  // Turned a quarter turn, its long side runs along z.
  assert.equal(rectContains(box, 2, 1.9), true);
  assert.equal(rectContains(box, 2.9, 1), false);
  assert.equal(rectContains(box, 2.4, 1), false);
  assert.equal(rectContains(box, 2.4, 1, 0.2), true, 'padding grows it');
});

test('a segment crosses a rectangle only where it goes through it', () => {
  const box = { x: 0, z: 0, hw: 1, hd: 1, rotation: 0.4 };
  assert.equal(segmentCrosses(box, { x: -3, z: 0 }, { x: 3, z: 0 }), true);
  assert.equal(segmentCrosses(box, { x: -3, z: 3 }, { x: 3, z: 3 }), false);
  assert.equal(segmentCrosses(box, { x: -3, z: 0 }, { x: -2, z: 0 }), false, 'stopping short');
  assert.equal(segmentCrosses(box, { x: 0, z: -3 }, { x: 0, z: 3 }), true);
});

test('a clear way is one straight step', () => {
  const nav = createNavigator({ half: 5, obstacles: [{ x: 3, z: 3, hw: 0.5, hd: 0.5 }] });
  assert.deepEqual(nav.path({ x: -3, z: -3 }, { x: 0, z: -3 }), [{ x: 0, z: -3 }]);
});

test('a route goes round what is in the way, clear all the way', () => {
  const wall = { x: 0, z: 0, hw: 0.2, hd: 2, rotation: 0, pad: 0.18 };
  const nav = createNavigator({ half: 5, obstacles: [wall] });
  const from = { x: -2, z: 0 }, to = { x: 2, z: 0 };
  const route = nav.path(from, to);
  assert.ok(route && route.length >= 2, 'it has to turn a corner');
  assert.deepEqual(route.at(-1), to);
  let at = from;
  for (const point of route) {
    assert.ok(nav.clear(at, point), `from ${JSON.stringify(at)} to ${JSON.stringify(point)}`);
    at = point;
  }
  const length = route.reduce((sum, p, i) => sum + Math.hypot(p.x - (route[i - 1] ?? from).x, p.z - (route[i - 1] ?? from).z), 0);
  assert.ok(length < 4 + 2 * 2.5, `a sensible detour (${length.toFixed(2)} m)`);
});

test('there is no route into a place that is walled off', () => {
  const ring = [
    { x: 0, z: 1, hw: 1.2, hd: 0.2 }, { x: 0, z: -1, hw: 1.2, hd: 0.2 },
    { x: 1, z: 0, hw: 0.2, hd: 1.2 }, { x: -1, z: 0, hw: 0.2, hd: 1.2 },
  ];
  const nav = createNavigator({ half: 5, obstacles: ring });
  assert.equal(nav.path({ x: 3, z: 3 }, { x: 0, z: 0 }), null);
});

// The real room: the same placements the app furnishes it with.
const cases = [];
{
  const depth = ORIGINAL_BOOKCASE_DIMENSIONS.depth;
  cases.push({ x: 0, z: depth / 2, rotation: 0 }, { x: 0, z: -depth / 2, rotation: Math.PI });
  for (const bay of [{ x: 0, z: -4.35, turn: 0 }, { x: 0, z: 4.35, turn: Math.PI }, { x: -4.35, z: 0, turn: Math.PI / 2 }]) {
    for (const sourceIndex of [0, 1]) {
      const placement = wallCasePlacement({ roomHalf: HALF, bay, sourceIndex });
      cases.push({ x: placement.x, z: placement.z, rotation: placement.rotationY });
    }
  }
}
const obstacles = walkObstacles({ roomHalf: HALF, cases });
const room = createNavigator({ half: HALF, obstacles });
const door = { x: HALF - 0.5, z: 0 };

test('the room has a seat at every corner chair, with room to stand before it', () => {
  const seats = readerSeats({ roomHalf: HALF });
  assert.equal(seats.length, 16);
  assert.equal(new Set(seats.map((seat) => seat.key)).size, 16);
  for (const seat of seats) {
    assert.ok(Math.abs(Math.hypot(seat.stand.x - seat.x, seat.stand.z - seat.z) - SEAT_STAND) < 1e-9);
    assert.ok(room.inRoom(seat.stand.x, seat.stand.z), `${seat.key} stands in the room`);
    // They stand in front of the chair, facing the way they will sit.
    assert.ok(Math.abs(seat.stand.x - seat.x - Math.sin(seat.yaw) * SEAT_STAND) < 1e-9);
  }
});

test('from the door there is a clear walk to a place to sit, and back out again', () => {
  for (const seat of readerSeats({ roomHalf: HALF })) {
    for (const [from, to] of [[door, seat.stand], [seat.stand, door]]) {
      const route = room.path(from, to);
      assert.ok(route, `${seat.key}: a route exists`);
      assert.deepEqual(route.at(-1), { x: to.x, z: to.z });
      // The margin is a comfort, not a wall: a step may graze the corner of one, but never closer than half of it.
      let at = from;
      for (const point of route) {
        for (const o of obstacles) {
          assert.equal(segmentCrosses(o, at, point, (o.pad ?? 0) / 2), false, `${seat.key}: ${JSON.stringify(at)} → ${JSON.stringify(point)}`);
        }
        at = point;
      }
    }
  }
});

test('every bookcase can be walked up to from the door, whichever way it faces', () => {
  for (const shelf of cases) {
    // A place to stand in front of the case, where a reader reaches up to its books.
    const front = { x: Math.sin(shelf.rotation), z: Math.cos(shelf.rotation) };
    const stand = { x: shelf.x + front.x * (ORIGINAL_BOOKCASE_DIMENSIONS.depth / 2 + 0.36), z: shelf.z + front.z * (ORIGINAL_BOOKCASE_DIMENSIONS.depth / 2 + 0.36) };
    assert.ok(room.free(stand.x, stand.z), `in front of the case at ${shelf.x.toFixed(2)}, ${shelf.z.toFixed(2)}`);
    assert.ok(room.path(door, stand), `a route to the case at ${shelf.x.toFixed(2)}, ${shelf.z.toFixed(2)}`);
  }
});

test('readers keep clear of the furniture on the way', () => {
  const route = room.path(door, { x: 0, z: 0.9 });
  assert.ok(route.length > 1, 'the long table and its chairs are in the way, so the route bends');
  for (const point of route) {
    for (const o of obstacles) assert.equal(rectContains(o, point.x, point.z, (o.pad ?? 0) - 0.01), false, 'a waypoint inside something');
  }
  assert.ok(WALK_PAD > 0);
});
