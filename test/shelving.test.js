import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelveBooksByPriority } from '../src/shelving.js';

function makeBookcase(capacities) {
  const used = [0, 0, 0, 0];
  const placements = [];
  return {
    compartments: capacities.map((width) => ({ x0: 0, x1: width })),
    placements,
    standBook(book, { compartment }) {
      const x0 = used[compartment];
      const x1 = x0 + book.width;
      if (x1 > capacities[compartment] + 1e-9) return null;
      used[compartment] = x1;
      placements.push({ book: book.id, compartment });
      return { x0, x1 };
    },
    used,
  };
}

test('fills and balances the two middle shelves before using the outer shelves', () => {
  const bookcase = makeBookcase([12, 2, 2, 12]);
  const books = Array.from({ length: 14 }, (_, id) => ({ id, width: 1 }));
  const result = shelveBooksByPriority(bookcase, books);

  assert.equal(result.placed, 14);
  assert.deepEqual(result.left, []);
  assert.deepEqual(bookcase.placements.slice(0, 4).map((p) => p.compartment), [1, 2, 1, 2]);
  assert.ok(bookcase.placements.slice(0, 4).every((p) => p.compartment === 1 || p.compartment === 2));
  assert.equal(bookcase.used[1], 2);
  assert.equal(bookcase.used[2], 2);
  assert.equal(bookcase.used[3], 6);
  assert.equal(bookcase.used[0], 4);
});

test('uses actual book widths when balancing unevenly sized books', () => {
  const bookcase = makeBookcase([10, 5, 5, 10]);
  const books = [1, 2, 1, 2, 1, 2, 1, 2].map((width, id) => ({ id, width }));
  const result = shelveBooksByPriority(bookcase, books);
  assert.equal(result.placed, books.length);
  assert.ok(Math.abs(bookcase.used[1] / 5 - bookcase.used[2] / 5) <= 0.4);
});

test('reports books that cannot fit anywhere', () => {
  const bookcase = makeBookcase([1, 1, 1, 1]);
  const books = Array.from({ length: 6 }, (_, id) => ({ id, width: 1 }));
  const result = shelveBooksByPriority(bookcase, books);
  assert.equal(result.placed, 4);
  assert.equal(result.left.length, 2);
});

test('rejects a bookcase with an unexpected number of shelves', () => {
  assert.throws(() => shelveBooksByPriority({ compartments: [{ x0: 0, x1: 1 }] }, []), /exactly four compartments/);
});
