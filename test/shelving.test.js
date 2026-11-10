import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelveBooksByPriority } from '../src/shelving.js';

function makeBook(id, width) {
  return {
    id,
    dimensions: { closed: { min: [0, 0, 0], max: [0, width, 0] } },
    group: { scale: { x: 1 } },
  };
}

function makeBookcase(capacities) {
  const used = [0, 0, 0, 0];
  const placements = [];
  return {
    compartments: capacities.map((width) => ({ x0: 0, x1: width })),
    placements,
    standBook(book, { compartment }) {
      const x0 = used[compartment];
      const x1 = x0 + (book.dimensions.closed.max[1] - book.dimensions.closed.min[1]) * book.group.scale.x;
      if (x1 > capacities[compartment] + 1e-9) return null;
      used[compartment] = x1;
      placements.push({ book: book.id, compartment });
      return { x0, x1 };
    },
    used,
  };
}

test('fills middle shelves to about 85% before placing books on the outer shelves', () => {
  const bookcase = makeBookcase([12, 10, 10, 12]);
  const books = Array.from({ length: 30 }, (_, id) => makeBook(id, 1));
  const result = shelveBooksByPriority(bookcase, books);

  assert.equal(result.placed, 30);
  assert.deepEqual(result.left, []);
  assert.ok(bookcase.placements.slice(0, 16).every((p) => p.compartment === 1 || p.compartment === 2));
  assert.ok(bookcase.placements.slice(16).every((p) => p.compartment === 0 || p.compartment === 3));
  assert.equal(bookcase.used[1], 8);
  assert.equal(bookcase.used[2], 8);
  assert.equal(bookcase.used[3], 8);
  assert.equal(bookcase.used[0], 6);
  assert.ok(result.occupiedFractions[1] <= 0.85);
  assert.ok(result.occupiedFractions[2] <= 0.85);
  assert.ok(bookcase.used[3] > bookcase.used[0]);
});

test('balances center shelves by actual book widths without exceeding the 85% target', () => {
  const bookcase = makeBookcase([10, 5, 5, 10]);
  const books = [1, 2, 1, 2, 1, 2, 1, 2].map((width, id) => makeBook(id, width));
  const result = shelveBooksByPriority(bookcase, books);

  assert.equal(result.placed, books.length);
  assert.deepEqual(result.left, []);
  assert.equal(bookcase.used[1], 4);
  assert.equal(bookcase.used[2], 4);
  assert.ok(result.occupiedFractions[1] <= 0.85);
  assert.ok(result.occupiedFractions[2] <= 0.85);
});

test('uses the outer shelves for books that would cross the center reserve', () => {
  const bookcase = makeBookcase([12, 2, 2, 12]);
  const books = Array.from({ length: 14 }, (_, id) => makeBook(id, 1));
  const result = shelveBooksByPriority(bookcase, books);

  assert.equal(result.placed, 14);
  assert.deepEqual(result.left, []);
  assert.equal(bookcase.used[1], 1);
  assert.equal(bookcase.used[2], 1);
  assert.equal(bookcase.used[3], 7);
  assert.equal(bookcase.used[0], 5);
});

test('reports books that cannot fit anywhere', () => {
  const bookcase = makeBookcase([1, 1, 1, 1]);
  const books = Array.from({ length: 6 }, (_, id) => makeBook(id, 1));
  const result = shelveBooksByPriority(bookcase, books);

  assert.equal(result.placed, 2);
  assert.equal(result.left.length, 4);
});

test('rejects invalid bookcase and fill settings', () => {
  assert.throws(() => shelveBooksByPriority({ compartments: [{ x0: 0, x1: 1 }] }, []), /exactly four compartments/);
  assert.throws(() => shelveBooksByPriority({ compartments: Array.from({ length: 4 }, () => ({ x0: 0, x1: 1 })) }, [], { middleFill: 0 }), /middleFill/);
});
