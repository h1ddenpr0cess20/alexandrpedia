/**
 * Fill a four-level bookcase in a deliberate order. Compartments are ordered
 * from bottom to top by the engine: 0 bottom, 1 lower middle, 2 upper middle,
 * 3 top. Fill the middle pair evenly to 85%, then distribute the remaining
 * books across the outer pair with a 60/40 bias toward the top. The unused
 * middle capacity remains available for later additions.
 */
export function shelveBooksByPriority(bookcase, books, { middleFill = 0.85, topShare = 0.6 } = {}) {
  const compartments = bookcase?.compartments;
  if (!Array.isArray(compartments) || compartments.length !== 4) {
    throw new RangeError('Book shelving requires exactly four compartments, ordered bottom to top.');
  }
  if (!(Number.isFinite(middleFill) && middleFill > 0 && middleFill <= 1)) {
    throw new RangeError('middleFill must be greater than 0 and no greater than 1.');
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

  // Match bookcase.standBook's own thickness calculation so the 85% check
  // accounts for each book's true spine width, including its model scale.
  const widthOf = (book) => {
    const bounds = book?.dimensions?.closed;
    const scale = book?.group?.scale?.x;
    const width = (bounds?.max?.[1] - bounds?.min?.[1]) * scale;
    if (!(Number.isFinite(width) && width > 0)) {
      throw new TypeError('Each book must expose closed dimensions and a finite positive group scale.');
    }
    return width;
  };

  const place = (book, compartment, maxFill = 1) => {
    const expectedWidth = widthOf(book);
    if (occupied[compartment] + expectedWidth > capacity[compartment] * maxFill + 1e-9) return false;

    const position = bookcase.standBook(book, { compartment });
    if (!position) return false;
    const actualWidth = position.x1 - position.x0;
    if (!(Number.isFinite(actualWidth) && actualWidth > 0)) {
      throw new Error(`Bookcase returned an invalid placement width for compartment ${compartment}.`);
    }
    occupied[compartment] += actualWidth;
    return true;
  };

  const overflow = [];
  for (const book of books) {
    // Keep both middle shelves close in fill percentage without crossing the reserve limit.
    const candidates = [1, 2].sort((a, b) => fill(a) - fill(b) || a - b);
    let placed = false;
    for (const compartment of candidates) {
      if (place(book, compartment, middleFill)) {
        placed = true;
        break;
      }
    }
    if (!placed) overflow.push(book);
  }

  const left = [];
  for (const book of overflow) {
    // The outer shelves share overflow, with a 60/40 capacity bias toward the top.
    const candidates = [3, 0].sort((a, b) => {
      const shareA = a === 3 ? topShare : 1 - topShare;
      const shareB = b === 3 ? topShare : 1 - topShare;
      return fill(a) / shareA - fill(b) / shareB;
    });
    let placed = false;
    for (const compartment of candidates) {
      if (place(book, compartment)) {
        placed = true;
        break;
      }
    }
    if (!placed) left.push(book);
  }

  return {
    placed: books.length - left.length,
    left,
    occupiedWidths: { bottom: occupied[0], lowerMiddle: occupied[1], upperMiddle: occupied[2], top: occupied[3] },
    occupiedFractions: occupied.map((width, index) => width / capacity[index]),
  };
}
