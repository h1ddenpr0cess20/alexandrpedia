import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READER, createReaders, pickWeighted, turnToward } from '../src/readers.js';
import { SEAT_STAND } from '../src/room-plan.js';

const door = { x: 6.7, z: 0 };
const seats = [
  { key: 'a', x: -5, z: -5, yaw: 0.5, stand: { x: -4.8, z: -4.7 } },
  { key: 'b', x: 5, z: -5, yaw: 1.5, stand: { x: 4.7, z: -4.9 } },
];
const shelfBook = (name, x = 0, z = 0.9) => ({ name, stand: { x, z }, face: Math.PI, y: 1.2, caseKey: 'ai' });

/**
 * A world that records what the readers ask of it, and checks as it goes that nobody is ever shown walking to a
 * shelf with a book already in hand, or walking away from it without one.
 */
function world({ books, options = {}, seed = 1, free = 4 }) {
  const log = [];
  const shelf = new Set(); // names of the books standing on the shelf
  for (const b of books) shelf.add(b.name);
  const queue = [...books];
  let state = seed;
  const random = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
  const hands = new Map(); // reader -> the name of the book in hand, or null
  const problems = [];
  const hooks = {
    canSpawn: () => free-- > 0,
    enter: (r) => { hands.set(r, null); log.push('enter'); },
    exit: (r) => { log.push(r.held ? `exit with ${r.held.name}` : 'exit'); hands.delete(r); if (r.held) shelf.delete(r.held.name); },
    place: (r) => {
      const inHand = hands.get(r) ?? null;
      if ((inHand !== null) !== (r.held !== null)) problems.push(`hand/held mismatch in ${r.phase}`);
      if (r.phase === 'walk' && r.then === 'fetch' && inHand !== null) problems.push('walking to a shelf with a book in hand');
      if (r.phase === 'walk' && r.then === 'shelve' && inHand === null) problems.push('walking to return a book with none');
      if (r.phase === 'walk' && r.then === 'sit' && inHand === null) problems.push('walking to sit down without a book');
      if (r.phase === 'reading' && inHand === null) problems.push('reading without a book');
    },
    pose: () => {},
    take: (r) => { if (!shelf.has(r.target.name)) return false; hands.set(r, r.target.name); log.push(`take ${r.target.name}`); return true; },
    shelve: (r) => { hands.set(r, null); log.push(`shelve ${r.held.name}`); },
    open: (r) => log.push(`open ${r.held.name}`),
    close: (r) => log.push(`close ${r.held.name}`),
  };
  const system = createReaders({
    navigator: { path: (from, to) => [{ x: to.x, z: to.z }] },
    door, seats, hooks, random, options,
    chooseBook: () => queue.shift() ?? null,
  });
  return { system, log, problems, shelf, hands };
}

/** Runs the clock, 30 times a second, until nobody is left (or a long time has gone by). */
function run(w, seconds = 900) {
  let now = 100;
  w.system.spawn(now);
  for (let t = 0; t < seconds * 30 && w.system.count; t++) { now += 1 / 30; w.system.update(now); }
  return now - 100;
}

const only = (options) => ({ sitAfterFetch: 0, afterReading: { swap: 0, returnAndLeave: 0, leaveWithBook: 1 }, ...options });

test('a reader comes in, takes a book and leaves with it', () => {
  const w = world({ books: [shelfBook('one')], options: only({ sitAfterFetch: 0 }) });
  run(w);
  assert.deepEqual(w.log, ['enter', 'take one', 'exit with one']);
  assert.deepEqual(w.problems, []);
});

test('a reader who sits reads the book open, then shuts it', () => {
  const w = world({ books: [shelfBook('one')], options: only({ sitAfterFetch: 1 }) });
  run(w);
  assert.deepEqual(w.log, ['enter', 'take one', 'open one', 'close one', 'exit with one']);
  assert.deepEqual(w.problems, []);
});

test('after reading, a reader may put it back and leave with nothing', () => {
  const w = world({ books: [shelfBook('one')], options: only({ sitAfterFetch: 1, afterReading: { swap: 0, returnAndLeave: 1, leaveWithBook: 0 } }) });
  run(w);
  assert.deepEqual(w.log, ['enter', 'take one', 'open one', 'close one', 'shelve one', 'exit']);
  assert.deepEqual(w.problems, []);
});

test('after reading, a reader may put it back, take another and read that', () => {
  const w = world({
    books: [shelfBook('one'), shelfBook('two', 0.4, 0.9)],
    options: only({ sitAfterFetch: 1, afterReading: { swap: 1, returnAndLeave: 0, leaveWithBook: 0 } }),
  });
  run(w);
  // (With no third book to be had, the second reader-of-two puts theirs back and goes.)
  assert.deepEqual(w.log, [
    'enter', 'take one', 'open one', 'close one', 'shelve one',
    'take two', 'open two', 'close two', 'shelve two', 'exit',
  ]);
  assert.deepEqual(w.problems, []);
});

test('a book that has gone from the shelf by the time they reach it is swapped for another', () => {
  const w = world({ books: [shelfBook('gone'), shelfBook('other')], options: only({ sitAfterFetch: 0 }) });
  w.shelf.delete('gone');
  run(w);
  assert.deepEqual(w.log, ['enter', 'take other', 'exit with other']);
});

test('a reader who finds nothing to read goes home empty-handed', () => {
  const w = world({ books: [shelfBook('gone')], options: only({ sitAfterFetch: 0 }) });
  w.shelf.delete('gone');
  run(w);
  assert.deepEqual(w.log, ['enter', 'exit']);
});

test('nobody is spawned when there is no book, or no figure free', () => {
  assert.equal(world({ books: [] }).system.spawn(0), null);
  assert.equal(world({ books: [shelfBook('one')], free: 0 }).system.spawn(0), null);
});

test('over many lives, hands are always right and everyone leaves', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const books = Array.from({ length: 6 }, (_, i) => shelfBook(`b${i}`, i * 0.1, 0.9));
    const w = world({ books, seed, options: { readTime: [2, 4] } });
    run(w);
    assert.deepEqual(w.problems, [], `seed ${seed}`);
    assert.equal(w.system.count, 0, `seed ${seed}: they all leave in the end`);
    const taken = w.log.filter((line) => line.startsWith('take')).length;
    const returned = w.log.filter((line) => line.startsWith('shelve')).length;
    assert.ok(taken >= 1 && returned <= taken, `seed ${seed}`);
    outcomes.add(w.log.at(-1).startsWith('exit with') ? 'left with a book' : 'left empty-handed');
    if (w.log.some((l) => l.startsWith('open'))) outcomes.add('read');
    if (w.log.some((l) => l.startsWith('shelve'))) outcomes.add('returned one');
    if (taken > 1) outcomes.add('took another');
  }
  for (const wanted of ['left with a book', 'left empty-handed', 'read', 'returned one', 'took another']) {
    assert.ok(outcomes.has(wanted), `some reader ${wanted}`);
  }
});

test('a seat is only ever taken by one reader at a time', () => {
  const books = Array.from({ length: 4 }, (_, i) => shelfBook(`b${i}`, i * 0.1));
  const w = world({ books, options: only({ sitAfterFetch: 1 }) });
  const first = w.system.spawn(0), second = w.system.spawn(0);
  for (let now = 0, i = 0; i < 30 * 40; i++) {
    now += 1 / 30;
    w.system.update(now);
    if (first.seat && second.seat) assert.notEqual(first.seat, second.seat);
  }
});

test('sitting takes the reader from standing before the seat to the seat itself, and back', () => {
  const w = world({ books: [shelfBook('one')], options: only({ sitAfterFetch: 1, readTime: [3, 3] }) });
  const reader = w.system.spawn(0);
  const seen = [];
  for (let now = 0, i = 0; i < 30 * 120 && w.system.count; i++) {
    now += 1 / 30;
    w.system.update(now);
    seen.push({ phase: reader.phase, sit: reader.sit, x: reader.pos.x, z: reader.pos.z, seat: reader.seat });
  }
  const seated = seen.filter((s) => s.phase === 'reading');
  assert.ok(seated.length > 30, 'they read for a while');
  assert.ok(seated.every((s) => s.sit === 1 && s.x === s.seat.x && s.z === s.seat.z), 'on the seat, all the while');
  const sitting = seen.filter((s) => s.phase === 'sitting');
  assert.ok(sitting.length > 10);
  assert.ok(sitting.every((s) => Math.hypot(s.x - s.seat.stand.x, s.z - s.seat.stand.z) <= SEAT_STAND + 1e-9), 'never further back than the seat');
  const down = sitting.map((s) => s.sit);
  assert.ok(down.every((v, i) => i === 0 || v >= down[i - 1] - 1e-9), 'sitting goes only down');
  const rising = seen.filter((s) => s.phase === 'rising').map((s) => s.sit);
  assert.ok(rising.every((v, i) => i === 0 || v <= rising[i - 1] + 1e-9), 'rising goes only up');
});

test('weighted choices follow their weights', () => {
  assert.equal(pickWeighted({ a: 1, b: 3 }, 0.1), 'a');
  assert.equal(pickWeighted({ a: 1, b: 3 }, 0.3), 'b');
  assert.equal(pickWeighted({ a: 0, b: 1 }, 0), 'b');
  assert.equal(pickWeighted({ a: 1, b: 1 }, 0.9999), 'b');
  assert.equal(Math.round(Object.values(READER.afterReading).reduce((a, b) => a + b, 0) * 100), 100);
});

test('turning goes the short way round, and no faster than asked', () => {
  assert.equal(turnToward(0, 1, 5), 1);
  assert.equal(turnToward(0, 2, 0.5), 0.5);
  assert.ok(Math.abs(turnToward(3, -3, 5) - (-3 + 2 * Math.PI)) < 1e-9, 'across the half turn');
  assert.ok(turnToward(-3, 3, 0.2) < -3, 'the short way is down');
});
