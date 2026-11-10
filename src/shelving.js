/**
 * Fill a four-level bookcase in a deliberate order. Compartments are ordered
 * from bottom to top by the engine: 0 bottom, 1 lower middle, 2 upper middle,
 * 3 top. The middle pair is filled first and kept evenly occupied; overflow is
 * split 60/40 between the top and bottom shelves.
 */
export function shelveBooksByPriority(bookcase, books, { topShare = 0.6 } = {}) {
  const compartments = bookcase?.compartments;
  if (!Array.isArray(compartments) || compartments.length !== 4) {
    throw new RangeError('Book shelving requires exactly four compartments, ordered bottom to top.');
  }
  if (!(Number.isFinite(topShare) && topShare > 0 && topShare < 1)) {
    throw new RangeError('topShare must be a number between 0 and 1.');
  }

  const capacity = compartments.map((compartment, index) => {
    const width = compartment.x1 - compartment.x0;
    if (!(Number.isFinite(width) && width > 0)) {
      throw new RangeError(`Bookcase compartment ${index} has no usable width.`);
    }
    return width;
  });
  const occupied = [0, 0, 0, 0];
  const fill = (index) => occupied[index] / capacity[index];

  const place = (book, compartment) => {
    const position = bookcase.standBook(book, { compartment });
    if (!position) return false;
    const width = position.x1 - position.x0;
    if (!(Number.isFinite(width) && width > 0)) {
      throw new Error(`Bookcase returned an invalid placement width for compartment ${compartment}.`);
    }
    occupied[compartment] += width;
    return true;
  };

  const overflow = [];
  for (const book of books) {
    // Balance the two middle shelves by occupied fraction, not book count.
    const [first, second] = [1, 2].sort((a, b) => fill(a) - fill(b) || a - b);
    if (!place(book, first) && !place(book, second)) overflow.push(book);
  }

  const left = [];
  for (const book of overflow) {
    // The outer shelves share overflow, with a 60/40 capacity bias toward the top.
    const topLoad = fill(3) / topShare;
    const bottomLoad = fill(0) / (1 - topShare);
    const first = topLoad <= bottomLoad ? 3 : 0;
    const second = first === 3 ? 0 : 3;
    if (!place(book, first) && !place(book, second)) left.push(book);
  }

  return {
    placed: books.length - left.length,
    left,
    occupiedWidths: { bottom: occupied[0], lowerMiddle: occupied[1], upperMiddle: occupied[2], top: occupied[3] },
  };
}
