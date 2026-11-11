import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as GFX from 'madness-engine/gfx';
import { createBook } from 'madness-engine/props/book';
import { pageBlockBox } from '../src/page-block.js';

/** The box the leaves of a built book fill, as they lie shut. */
function leafBox(book) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const { mesh } of book.leaves) {
    const P = mesh.geometry.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i + k]); max[k] = Math.max(max[k], P[i + k]); }
  }
  return { min, max };
}

const options = { width: 0.30, leafPitch: 0.0006, bookplate: false, textureSize: 64, bump: false };

test('the shelf paper block fills the space the real leaves of a shut book do', () => {
  for (const [pageCount, height] of [[6, 0.42], [34, 0.5], [60, 0.4], [120, 0.36], [320, 0.42]]) {
    const full = createBook(GFX, { ...options, pageCount, height });
    const shell = createBook(GFX, { ...options, pageCount, height, shell: true });
    const real = leafBox(full);
    const block = pageBlockBox(shell.dimensions.closed);
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(block.min[k] - real.min[k]) < 5e-4, `${pageCount} pages: min ${'xyz'[k]} ${block.min[k]} vs ${real.min[k]}`);
      assert.ok(Math.abs(block.max[k] - real.max[k]) < 5e-4, `${pageCount} pages: max ${'xyz'[k]} ${block.max[k]} vs ${real.max[k]}`);
    }
  }
});

test('a shell book is its cover alone, and the same size as the whole book', () => {
  const full = createBook(GFX, { ...options, pageCount: 80, height: 0.42 });
  const shell = createBook(GFX, { ...options, pageCount: 80, height: 0.42, shell: true });
  assert.equal(shell.built, false);
  assert.equal(shell.leaves.length, 0);
  assert.equal(full.leaves.length, 40);
  assert.deepEqual(shell.dimensions.closed, full.dimensions.closed, 'so it shelves exactly as the whole book does');
});

test('the block never turns inside out, however thin the book', () => {
  const box = pageBlockBox({ min: [0, 0, -0.2], max: [0.01, 0.012, 0.2] });
  for (let k = 0; k < 3; k++) assert.ok(box.max[k] > box.min[k]);
});
