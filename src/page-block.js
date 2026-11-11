/**
 * A shelved book is its cover and one block of paper between the boards, not a mesh to every leaf.
 *
 * Built leaf by leaf, the 924 shelf books came to some 16,000 meshes, each with a geometry and a material of
 * its own: 12 million vertices and a gigabyte of memory, and a draw call a leaf for every book in view. And the
 * leaves were never used: a book that is opened is made afresh from its article (see `select` in app.js), so a
 * shelf copy's leaves were never turned or read. The engine's `shell` option builds the cover alone; this is
 * where the paper goes in it.
 */

/**
 * How far the paper stops short of the cover's closed box, in the book's own units: measured on shut books of
 * 6 to 320 pages (the leaves' bounding box against the cover's), and held to by test/page-block.test.js.
 * x runs across the page from the spine, y through the thickness, z up the page.
 */
export const PAGE_BLOCK_INSET = Object.freeze({ x0: 0.0035, x1: 0.0091, y: 0.00983, z: 0.009 });

/** The block's corners, `{ min, max }`, from a shut book's closed box (`book.dimensions.closed`). */
export function pageBlockBox({ min, max }, inset = PAGE_BLOCK_INSET) {
  const lo = [min[0] + inset.x0, min[1] + inset.y, min[2] + inset.z];
  const hi = [max[0] - inset.x1, max[1] - inset.y, max[2] - inset.z];
  return { min: lo, max: hi.map((v, k) => Math.max(v, lo[k] + 1e-4)) };
}
