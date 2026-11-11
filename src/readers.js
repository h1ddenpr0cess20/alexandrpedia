/**
 * The readers' day, as a small state machine that knows nothing about the scene: it decides where each reader
 * walks and what they do there, and asks the `hooks` to move, pose and hand over the book.
 *
 * A reader comes in at the door, walks to a shelf with nothing in their hands, reaches up and takes a book,
 * and walks away with it in hand. Then they either leave with it or sit down and read. When they have read,
 * they either put it back and take another (and so on again), put it back and leave, or leave with it.
 *
 *   walk ──► fetch ──► walk ──► sitting ──► reading ──► rising ──► walk ──► shelve ──► fetch …
 *     │                  │                                  │                  └────► walk ──► (gone)
 *     │                  └────► (gone, with the book)       └────► (gone, with the book)
 */

export const READER = Object.freeze({
  speed: 1.0,            // metres a second
  turnRate: 4.5,         // radians a second
  reachTime: 2.2,        // seconds at the shelf, reaching up, taking or putting back, and lowering the arm
  reachTakes: 0.5,       // how far through it the book changes hands
  sitTime: 1.4,
  riseTime: 1.2,
  turnBeforeSitting: 0.35,
  readTime: Object.freeze([20, 50]),
  /** After taking a book: how likely they are to sit and read it (otherwise they leave with it). */
  sitAfterFetch: 0.7,
  /** After reading: what they do with the book. */
  afterReading: Object.freeze({ swap: 0.4, returnAndLeave: 0.3, leaveWithBook: 0.3 }),
  /** How often the next book is chosen from the case they are already at. */
  sameCase: 0.6,
});

const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

/** The angle `from` turned toward `to` by at most `most`, the short way round. */
export function turnToward(from, to, most) {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return from + Math.max(-most, Math.min(most, d));
}

/** One of the keys of `weights`, chosen by `roll` (0 to 1) in proportion to the values. */
export function pickWeighted(weights, roll) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let at = roll * total;
  for (const [key, w] of entries) {
    if (at < w) return key;
    at -= w;
  }
  return entries[entries.length - 1][0];
}

/**
 * @param {object} config
 * @param {{ path(from, to): Array<{x, z}> | null }} config.navigator
 * @param {{ x: number, z: number }} config.door where readers come in and go out
 * @param {Array<{ key: string, x: number, z: number, yaw: number, stand: { x: number, z: number } }>} config.seats
 *   `stand` is where they stand in front of the seat, facing `yaw`, before they sit
 * @param {(ask: { near?: object }) => (object | null)} config.chooseBook a book to fetch: `{ stand: {x, z}, face, y, caseKey }`
 * @param {object} config.hooks `canSpawn()`, `enter(reader)`, `exit(reader)`, `place(reader)`, `pose(reader, state)`,
 *   `take(reader) → boolean`, `shelve(reader)`, `open(reader)`, `close(reader)`
 * @param {() => number} [config.random]
 * @param {object} [config.options] overrides of READER
 */
export function createReaders({ navigator, door, seats, chooseBook, hooks, random = Math.random, options = {} }) {
  const opts = { ...READER, ...options };
  const readers = [];
  let nextId = 1;
  const between = ([lo, hi]) => lo + random() * (hi - lo);

  /** Sends the reader along a clear route to `point`, to do `then` when they get there. */
  function walkTo(reader, point, then) {
    reader.route = navigator.path(reader.pos, point) ?? [{ x: point.x, z: point.z }];
    reader.then = then;
    reader.phase = 'walk';
  }

  function leave(reader) {
    walkTo(reader, door, 'exit');
  }

  function remove(reader) {
    hooks.exit(reader);
    const at = readers.indexOf(reader);
    if (at >= 0) readers.splice(at, 1);
  }

  function spawn(now) {
    if (!hooks.canSpawn()) return null;
    const target = chooseBook({});
    if (!target) return null;
    const reader = {
      id: nextId++, phase: 'walk', then: 'fetch', route: [],
      pos: { x: door.x, z: door.z }, yaw: Math.PI / 2, heading: Math.PI / 2, sit: 0,
      target, held: null, at: null, seat: null, afterShelve: 'swap', readFor: 0,
      t0: now, last: now, did: false,
    };
    readers.push(reader);
    hooks.enter(reader);
    walkTo(reader, target.stand, 'fetch');
    return reader;
  }

  function startReach(reader, kind, now) {
    reader.phase = kind;
    reader.t0 = now;
    reader.did = false;
    // The book they are at: taken from its place, or put back in it. (Held in hand, it is no longer `target`.)
    reader.at = kind === 'fetch' ? reader.target : reader.held;
  }

  function arrive(reader, now) {
    switch (reader.then) {
      case 'fetch': startReach(reader, 'fetch', now); break;
      case 'shelve': startReach(reader, 'shelve', now); break;
      case 'sit': reader.phase = 'sitting'; reader.t0 = now; break;
      default: remove(reader);
    }
  }

  function walk(reader, now, dt) {
    let budget = opts.speed * dt;
    const { pos } = reader;
    while (budget > 0 && reader.route.length) {
      const goal = reader.route[0];
      const dx = goal.x - pos.x, dz = goal.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= budget) {
        pos.x = goal.x; pos.z = goal.z;
        budget -= d;
        reader.route.shift();
      } else {
        pos.x += (dx / d) * budget;
        pos.z += (dz / d) * budget;
        reader.heading = Math.atan2(dx, dz);
        budget = 0;
      }
    }
    reader.yaw = turnToward(reader.yaw, reader.heading, opts.turnRate * dt);
    hooks.place(reader);
    hooks.pose(reader, { clip: 'walk', time: now, t: now - reader.t0, speed: 1 });
    if (!reader.route.length) arrive(reader, now);
    return true;
  }

  /** Reaching to a shelf: the arm comes up, the book changes hands, the arm comes down. */
  function reach(reader, now, dt) {
    const u = (now - reader.t0) / opts.reachTime;
    const taking = reader.phase === 'fetch';
    const book = reader.at;
    reader.yaw = turnToward(reader.yaw, book.face, opts.turnRate * dt);
    const up = u < opts.reachTakes ? smooth(u / opts.reachTakes) : 1 - smooth((u - opts.reachTakes) / (1 - opts.reachTakes));
    if (!reader.did && u >= opts.reachTakes) {
      reader.did = true;
      if (taking) {
        if (!hooks.take(reader)) {
          // Someone else has it: look for another.
          const other = chooseBook({ near: book });
          if (other) {
            reader.target = other;
            walkTo(reader, other.stand, 'fetch');
          } else {
            leave(reader);
          }
          return true;
        }
        reader.held = reader.target;
        reader.target = null;
      } else {
        hooks.shelve(reader);
        reader.held = null; // (it stands on the shelf again; `at` still says which)
      }
    }
    hooks.place(reader);
    hooks.pose(reader, { clip: 'idle', time: now, reach: Math.max(0, up), reachY: book.y });
    if (u < 1) return true;

    if (taking) {
      const seat = random() < opts.sitAfterFetch ? takeSeat(reader) : null;
      if (seat) walkTo(reader, seat.stand, 'sit');
      else leave(reader);
    } else {
      const next = reader.afterShelve === 'swap' ? chooseBook({ near: book }) : null;
      if (!next) { leave(reader); return true; }
      reader.target = next;
      if (Math.hypot(next.stand.x - reader.pos.x, next.stand.z - reader.pos.z) < 0.25) startReach(reader, 'fetch', now);
      else walkTo(reader, next.stand, 'fetch');
    }
    return true;
  }

  function takeSeat(reader) {
    const open = seats.filter((seat) => !readers.some((other) => other.seat === seat));
    if (!open.length) return null;
    reader.seat = open[Math.floor(random() * open.length)];
    return reader.seat;
  }

  /** Sitting down and getting up: from where they stand, back onto the seat, and the other way. */
  function sit(reader, now, dt) {
    const { seat } = reader;
    const sitting = reader.phase === 'sitting';
    reader.yaw = turnToward(reader.yaw, seat.yaw, opts.turnRate * 1.5 * dt);
    const delay = sitting ? opts.turnBeforeSitting : 0;
    const progress = smooth((now - reader.t0 - delay) / (sitting ? opts.sitTime : opts.riseTime));
    reader.sit = sitting ? progress : 1 - progress;
    reader.pos.x = seat.stand.x + (seat.x - seat.stand.x) * reader.sit;
    reader.pos.z = seat.stand.z + (seat.z - seat.stand.z) * reader.sit;
    hooks.place(reader);
    hooks.pose(reader, { clip: 'read', time: now, t: 0.45 * reader.sit });
    if (now - reader.t0 - delay < (sitting ? opts.sitTime : opts.riseTime)) return true;

    if (sitting) {
      reader.sit = 1;
      reader.phase = 'reading';
      reader.t0 = now;
      reader.readFor = between(opts.readTime);
      hooks.open(reader);
      return false;
    }
    reader.sit = 0;
    reader.pos.x = seat.stand.x; reader.pos.z = seat.stand.z;
    reader.seat = null;
    const choice = pickWeighted(opts.afterReading, random());
    if (choice === 'leaveWithBook') leave(reader);
    else {
      reader.afterShelve = choice === 'swap' ? 'swap' : 'leave';
      walkTo(reader, reader.held.stand, 'shelve');
    }
    return true;
  }

  /** Reading is stillness: nothing moves until it is time to get up. */
  function read(reader, now) {
    if (now - reader.t0 < reader.readFor) return false;
    hooks.close(reader);
    reader.phase = 'rising';
    reader.t0 = now;
    return true;
  }

  function step(reader, now) {
    const dt = Math.min(0.1, Math.max(0, now - reader.last));
    reader.last = now;
    switch (reader.phase) {
      case 'walk': return walk(reader, now, dt);
      case 'fetch': case 'shelve': return reach(reader, now, dt);
      case 'sitting': case 'rising': return sit(reader, now, dt);
      case 'reading': return read(reader, now);
      default: return false;
    }
  }

  /** Moves every reader on to `now` (seconds). Gives whether anything on screen changed. */
  function update(now) {
    let changed = false;
    for (const reader of [...readers]) changed = step(reader, now) || changed;
    return changed;
  }

  /** Sends everyone away at once. */
  function clear() {
    for (const reader of [...readers]) remove(reader);
  }

  return { readers, spawn, update, clear, get count() { return readers.length; } };
}
