/**
 * Where people can walk: a floor plan of rectangles (bookcases, tables, chairs) and a way of finding a clear
 * route between two points on it. Plain numbers in, plain numbers out, so it is checked without a browser.
 *
 * A rectangle is `{ x, z, hw, hd, rotation, pad }`: its middle, its half-width along its own x and half-depth
 * along its own z, how far it is turned about the vertical axis (the way a three-d object's `rotation.y`
 * turns it) and how much room a walker keeps from it (default none).
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A point in the rectangle's own frame. */
function local(rect, x, z) {
  const c = Math.cos(rect.rotation ?? 0), s = Math.sin(rect.rotation ?? 0);
  const dx = x - rect.x, dz = z - rect.z;
  return [dx * c - dz * s, dx * s + dz * c];
}

/** Whether the point is in the rectangle grown by `pad`. */
export function rectContains(rect, x, z, pad = rect.pad ?? 0) {
  const [lx, lz] = local(rect, x, z);
  return Math.abs(lx) <= rect.hw + pad && Math.abs(lz) <= rect.hd + pad;
}

/** Whether the straight way from `a` to `b` goes through the rectangle grown by `pad`. */
export function segmentCrosses(rect, a, b, pad = rect.pad ?? 0) {
  const [ax, az] = local(rect, a.x, a.z);
  const [bx, bz] = local(rect, b.x, b.z);
  let t0 = 0, t1 = 1;
  for (const [from, to, half] of [[ax, bx, rect.hw + pad], [az, bz, rect.hd + pad]]) {
    const d = to - from;
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(from) > half) return false;
      continue;
    }
    let near = (-half - from) / d, far = (half - from) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

/** A small binary heap of [priority, value] pairs, lowest priority first. */
class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(priority, value) {
    const items = this.items;
    items.push([priority, value]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < items.length && items[l][0] < items[m][0]) m = l;
        if (r < items.length && items[r][0] < items[m][0]) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * Routes on a square room from -`half` to `half` each way, with its walls kept `edge` away, round `obstacles`.
 * The floor is cut into squares of `cell` metres; `path` searches them and then pulls the route tight.
 */
export function createNavigator({ half, obstacles, cell = 0.12, edge = 0.25 }) {
  const n = Math.ceil((2 * half) / cell);
  const inRoom = (x, z) => Math.abs(x) <= half - edge && Math.abs(z) <= half - edge;
  const free = (x, z) => inRoom(x, z) && !obstacles.some((o) => rectContains(o, x, z));
  const centre = (i) => -half + (i + 0.5) * cell;
  const cellOf = (v) => clamp(Math.floor((v + half) / cell), 0, n - 1);

  const blocked = new Uint8Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) if (!free(centre(ix), centre(iz))) blocked[iz * n + ix] = 1;

  /** Whether the straight way from `a` to `b` is clear. */
  function clear(a, b) {
    return inRoom(b.x, b.z) && inRoom(a.x, a.z) && !obstacles.some((o) => segmentCrosses(o, a, b));
  }

  /** The nearest free square to a point, by rings outward from its own. -1 when there is none near. */
  function nearestFree(p) {
    const cx = cellOf(p.x), cz = cellOf(p.z);
    for (let ring = 0; ring < 20; ring++) {
      let best = -1, bestDistance = Infinity;
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const ix = cx + dx, iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= n || iz >= n || blocked[iz * n + ix]) continue;
          const d = Math.hypot(centre(ix) - p.x, centre(iz) - p.z);
          if (d < bestDistance) { bestDistance = d; best = iz * n + ix; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  /** The squares from one square to another, or null if the two are cut off from each other. */
  function search(start, goal) {
    const cost = new Float32Array(n * n).fill(Infinity);
    const from = new Int32Array(n * n).fill(-1);
    const open = new Heap();
    const gx = goal % n, gz = (goal / n) | 0;
    const estimate = (i) => {
      const dx = Math.abs((i % n) - gx), dz = Math.abs(((i / n) | 0) - gz);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    cost[start] = 0;
    open.push(estimate(start), start);
    while (open.size) {
      const at = open.pop();
      if (at === goal) {
        const route = [];
        for (let i = goal; i !== -1; i = from[i]) route.push(i);
        return route.reverse();
      }
      const ax = at % n, az = (at / n) | 0;
      for (const [dx, dz, step] of STEPS) {
        const ix = ax + dx, iz = az + dz;
        if (ix < 0 || iz < 0 || ix >= n || iz >= n) continue;
        const next = iz * n + ix;
        if (blocked[next]) continue;
        // No cutting a corner of something.
        if (dx && dz && (blocked[az * n + ix] || blocked[iz * n + ax])) continue;
        const through = cost[at] + step;
        if (through >= cost[next]) continue;
        cost[next] = through;
        from[next] = at;
        open.push(through + estimate(next), next);
      }
    }
    return null;
  }

  /**
   * The points to walk through, one after another, to get from `from` to `to`: the last is `to` itself.
   * Null when there is no way (the caller may walk straight and hope).
   */
  function path(from, to) {
    if (clear(from, to)) return [{ x: to.x, z: to.z }];
    const start = nearestFree(from), goal = nearestFree(to);
    if (start < 0 || goal < 0) return null;
    const cells = search(start, goal);
    if (!cells) return null;
    const points = [{ x: from.x, z: from.z }, ...cells.map((i) => ({ x: centre(i % n), z: centre((i / n) | 0) })), { x: to.x, z: to.z }];
    // Pulled tight: from each point, on to the furthest one that can be seen from it.
    const route = [];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !clear(points[i], points[j])) j--;
      route.push(points[j]);
      i = j;
    }
    return route;
  }

  return { path, clear, free, inRoom };
}
