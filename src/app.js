/**
 * The shelves: two bookcases, one of Wikipedia books and one of Grokipedia
 * books, each holding the same catalog. Click a book on a shelf and it comes
 * off the shelf as a 3D book, lying on the table; its article is written into
 * its pages and it opens. Click a page's side to turn it, use the arrow keys,
 * and click the room (or press Escape) to put the book back on its shelf.
 */

import * as GFX from '../vendor/madness-engine/src/gfx/index.js';
import { createStage } from '../vendor/madness-engine/src/stage.js';
import { paintRoom } from '../vendor/madness-engine/src/textures/rooms/studio.js';
import { createBookcase, stockBooks } from '../vendor/madness-engine/src/props/bookcase.js';
import { createBook } from '../vendor/madness-engine/src/props/book.js';
import { CATALOG, KINDS, keyOf } from './catalog.js';
import { SOURCES } from './sources.js';
import { loadOrFallback } from './library.js';

const SPECIES = { wikipedia: 'oak', grokipedia: 'walnut' };

/** Where a book hangs when it is read: in midair in front of the reader, at the model's own size. */
const READ_AT = new GFX.Vector3(0, 1.0, 0.9);
/** Standing upright, its cover facing the reader (the model lies flat on the x-z plane). */
const READ_UPRIGHT = new GFX.Quaternion().setFromAxisAngle(new GFX.Vector3(1, 0, 0), Math.PI / 2);
const SHELF_TARGET = new GFX.Vector3(0, 1.0, 0);

const status = document.getElementById('status');
const say = (text = '') => { status.textContent = text; status.hidden = !text; };

const stage = await createStage(document.getElementById('host'), { room: paintRoom(), shadowSize: 1024, fixtures: 0, label: 'alexandrpedia', lens: { distance: 17, fov: 36 } });
const { scene, camera, renderer } = stage;
camera.position.set(0, 1.45, 5.2);
stage.target.copy(SHELF_TARGET);

// Two bookcases side by side, the Wikipedia one on the left.
const cases = {};
SOURCES.forEach((source, i) => {
  const shelf = createBookcase(GFX, { species: SPECIES[source.id], shelves: 2, width: 0.55, depth: 0.34 });
  shelf.group.position.set(i === 0 ? -0.5 : 0.5, 0, 0);
  scene.add(shelf.group);
  cases[source.id] = shelf;
});

/** Every book: { entry, source, book, key, home } where `home` is where it stands on its shelf. */
const books = new Map();
const byGroup = new Map();
for (const source of SOURCES) {
  const stock = stockBooks(CATALOG.length, source.id === 'wikipedia' ? 3 : 4);
  const made = CATALOG.map((entry, n) => {
    const book = createBook(GFX, {
      ...stock[n],
      title: entry.title,
      subtitle: `${source.name} · ${KINDS[entry.kind]}`,
      deferPages: true,
    });
    const record = { entry, source, book, key: `${source.id}:${keyOf(entry)}`, home: null };
    books.set(record.key, record);
    byGroup.set(book.group, record);
    return book;
  });
  const { left } = cases[source.id].shelve(made, { spread: true });
  if (left.length) console.warn(`${source.name}: ${left.length} book(s) did not fit`);
  for (const book of made) {
    const record = byGroup.get(book.group);
    record.home = {
      parent: cases[source.id].group,
      position: book.group.position.clone(),
      quaternion: book.group.quaternion.clone(),
      scale: book.group.scale.clone(),
    };
  }
}

// ———————————————————————————————————————————— taking a book down and putting it back

let reading = null;       // the record of the book on the table, if any
let token = 0;            // which selection is current, so a slow fetch cannot overwrite a newer one
const moving = new Set(); // books that are opening or closing

function takeDown(record) {
  const { book, home } = record;
  home.parent.remove(book.group);
  scene.add(book.group);
  book.group.position.copy(READ_AT);
  book.group.quaternion.copy(READ_UPRIGHT);
  book.group.scale.setScalar(1);
  reading = record;
  moving.add(record);
  stage.target.copy(READ_AT);
}

function putBack(record) {
  const { book, home } = record;
  book.close();
  scene.remove(book.group);
  home.parent.add(book.group);
  book.group.position.copy(home.position);
  book.group.quaternion.copy(home.quaternion);
  book.group.scale.copy(home.scale);
  moving.add(record);
  if (reading === record) reading = null;
  stage.target.copy(SHELF_TARGET);
}

async function select(key) {
  const record = books.get(key);
  if (!record || reading === record) return;
  if (reading) putBack(reading);
  const current = ++token;
  takeDown(record);
  record.book.open();
  say(`Fetching ${record.entry.title} from ${record.source.name}…`);

  const article = await loadOrFallback(record.source.id, record.entry);
  if (current !== token) return; // another book was chosen meanwhile
  record.book.setStyle({ title: article.title, subtitle: `${record.source.name} · ${KINDS[record.entry.kind]}` });
  record.book.setText(article.text);
  record.book.open();
  say(article.fallback ? `Could not fetch this one, so a stand-in book is on the table. (${article.failure})` : '');
}

// ———————————————————————————————————————————— picking things in the scene

const raycaster = new GFX.Raycaster();
const NDC = new GFX.Vector2();

/** The book (and the hit) under a pointer event, or null. */
function pick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  NDC.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(NDC, camera);
  for (const hit of raycaster.intersectObjects(scene.children, true)) {
    let node = hit.object;
    while (node && !byGroup.has(node)) node = node.parent;
    if (node) return { record: byGroup.get(node), hit };
  }
  return null;
}

const AXIS_Y = new GFX.Vector3(0, 1, 0);
const AXIS_X = new GFX.Vector3(1, 0, 0);
const SPIN = new GFX.Quaternion();
const SCALE_RANGE = [0.4, 4];
let drag = null; // { x, y, moved } while the reading book is being turned in the air
const pointers = new Map(); // every pointer down on the canvas, for pinching
let pinchGap = null;

/** Zoom the reading book about its own size, kept within SCALE_RANGE. */
function zoomReading(factor) {
  if (!reading) return;
  const s = reading.book.group.scale.x * factor;
  reading.book.group.scale.setScalar(Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], s)));
}

renderer.domElement.addEventListener('wheel', (e) => {
  if (!reading) return;
  e.preventDefault();
  zoomReading(Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.button !== 0) return;
  if (pointers.size >= 2) { drag = null; pinchGap = null; return; }
  const found = pick(e);
  drag = found?.record === reading ? { x: e.clientX, y: e.clientY, moved: false, found } : null;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && reading) {
    // Two fingers: pinch to zoom the book.
    const [a, b] = [...pointers.values()];
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchGap) zoomReading(gap / pinchGap);
    pinchGap = gap;
    drag = null;
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  drag.x = e.clientX;
  drag.y = e.clientY;
  // Turn the book about the screen's axes: it rotates freely, through any angle.
  SPIN.setFromAxisAngle(AXIS_Y, dx * 0.01);
  reading.book.group.quaternion.premultiply(SPIN);
  SPIN.setFromAxisAngle(AXIS_X, dy * 0.01);
  reading.book.group.quaternion.premultiply(SPIN);
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchGap = null;
};
renderer.domElement.addEventListener('pointercancel', (e) => { endPointer(e); drag = null; });
renderer.domElement.addEventListener('pointerup', (e) => {
  endPointer(e);
  const was = drag;
  drag = null;
  if (e.button !== 0) return;
  if (was?.moved) return; // a turn in the air, not a click
  const found = was ? was.found : pick(e);
  if (found) {
    if (found.record === reading) {
      // A click on the open book turns the page on the side that was touched (left of the spine turns back).
      found.record.book.touch(found.record.book.group.worldToLocal(found.hit.point.clone()).x);
    } else {
      select(found.record.key);
    }
    return;
  }
  // The room: the book goes back to its shelf.
  if (reading) { putBack(reading); say(''); }
});

globalThis.addEventListener('keydown', (e) => {
  if (!reading) return;
  if (e.key === 'ArrowRight') { reading.book.next(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { reading.book.prev(); e.preventDefault(); }
  else if (e.key === 'Escape') { putBack(reading); say(''); }
});

// ———————————————————————————————————————————— the frame loop

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const record of moving) {
    record.book.update(dt);
    if (record !== reading && record.book.openness < 0.001) moving.delete(record);
  }
  if (reading) reading.book.update(dt);
  stage.render();
});
