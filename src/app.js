/**
 * The reading room: two bookcases of AI articles (Wikipedia's and Grokipedia's), a desk, chairs and
 * tables to sit among them. Click a book on a shelf and it comes off as a 3D book hanging over the
 * desk; its article is written into its pages and it opens. Click a page's side to turn it, use the
 * arrow keys, and click the room (or press Escape) to put the book back.
 *
 * The room itself can be looked around: drag to orbit, right-drag (or Shift-drag, or two fingers) to
 * pan, scroll or pinch to zoom, double-click or press R to come back. Dragging the open book turns it.
 */

import * as GFX from '../vendor/madness-engine/src/gfx/index.js';
import { createStage } from '../vendor/madness-engine/src/stage.js';
import { paintRoom } from '../vendor/madness-engine/src/textures/rooms/studio.js';
import { defineView } from '../vendor/madness-engine/src/view.js';
import { createBookcase, stockBooks } from '../vendor/madness-engine/src/props/bookcase.js';
import { createBook } from '../vendor/madness-engine/src/props/book.js';
import { createWoodTable } from '../vendor/madness-engine/src/props/wood-table.js';
import { createWoodChair } from '../vendor/madness-engine/src/props/wood-chair.js';
import { CATALOG, KINDS, keyOf } from './catalog.js';
import { SOURCES } from './sources.js';
import { loadOrFallback } from './library.js';

// Not walnut: the engine paints walnut from a photograph, on canvases WebGPU refuses to copy before the photo has decoded.
const SPECIES = { wikipedia: 'oak', grokipedia: 'mahogany' };

/** A reading desk for each encyclopedia, in the wood of its bookcase, to either side of the shelves. */
const DESKS = { wikipedia: { x: -2.6, z: 1.6 }, grokipedia: { x: 2.6, z: 1.6 } };
const DESK_HEIGHT = 0.75;
/** Where a book hangs when it is read: in midair over its own encyclopedia's desk, at the model's own size. */
const readAt = (sourceId) => new GFX.Vector3(DESKS[sourceId].x, DESK_HEIGHT + 0.42, DESKS[sourceId].z);
/** Standing upright, its cover facing the reader (the model lies flat on the x-z plane). */
const READ_UPRIGHT = new GFX.Quaternion().setFromAxisAngle(new GFX.Vector3(1, 0, 0), Math.PI / 2);
const SHELF_TARGET = new GFX.Vector3(0, 1.05, 0.8);

// A view that can go from nearly level to nearly overhead, and in close or far out.
const { createView } = defineView({ home: { yaw: 0, pitch: 0.12, zoom: 0.65 }, limits: { pitch: [-0.02, 1.35], zoom: [0.03, 2.4] } });

const loading = document.getElementById('loading');
const loadingNote = document.getElementById('loading-note');
const loadingStep = (text) => { loadingNote.textContent = text; return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };
const loadingFailed = (error) => {
  loading.classList.add('failed');
  loadingNote.textContent = `The library could not open: ${error?.message ?? error}`;
};
globalThis.addEventListener('error', (e) => { if (!loading.classList.contains('done')) loadingFailed(e.error ?? e.message); });
globalThis.addEventListener('unhandledrejection', (e) => { if (!loading.classList.contains('done')) loadingFailed(e.reason); });

const status = document.getElementById('status');
const say = (text = '') => { status.textContent = text; status.hidden = !text; };

await loadingStep('Starting the renderer…');
const stage = await createStage(document.getElementById('host'), {
  room: paintRoom(), shadowSize: 2048, fixtures: 0, label: 'alexandrpedia',
  lens: { distance: 7.5, fov: 36 },
  view: createView(),
});
const { scene, camera, renderer } = stage;
// Close enough to read a spine or a page: the stage's near plane (0.3 m) would cut the book away.
camera.near = 0.02;
camera.far = 120;
camera.updateProjectionMatrix();
stage.target.copy(SHELF_TARGET);
stage.view.step(0, true);

// ———————————————————————————————————————————— the room

await loadingStep('Furnishing the room…');

const floor = new GFX.Mesh(
  new GFX.CircleGeometry(9, 64),
  new GFX.MeshStandardMaterial({ color: '#3a2d26', roughness: 0.85, metalness: 0 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wall = new GFX.Mesh(
  new GFX.PlaneGeometry(16, 4.2),
  new GFX.MeshStandardMaterial({ color: '#4a4a63', roughness: 0.95, metalness: 0 }),
);
wall.position.set(0, 2.1, -0.28);
wall.receiveShadow = true;
scene.add(wall);

const rug = new GFX.Mesh(
  new GFX.CircleGeometry(2.0, 48),
  new GFX.MeshStandardMaterial({ color: '#6b2f35', roughness: 1, metalness: 0 }),
);
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.004, 2.2);
rug.receiveShadow = true;
scene.add(rug);

/** Sets a piece of furniture down on the floor, turned about the vertical (0 faces +z, toward the viewer). */
function furnish(piece, x, z, turn = 0) {
  piece.group.position.set(x, 0, z);
  piece.group.rotation.y = turn;
  scene.add(piece.group);
  return piece;
}

// Furniture stands to the sides, so the bookcases are never hidden. Each encyclopedia has a matching nook:
// a reading desk and its chair, pulled up, a stool and a side table, all in the wood of that bookcase.
for (const source of SOURCES) {
  const { x, z } = DESKS[source.id];
  const species = SPECIES[source.id];
  const wood = { species, finish: 'lacquered' };
  const inward = x < 0 ? 1 : -1; // toward the middle of the room
  furnish(createWoodTable(GFX, { ...wood, kind: 'desk', width: 1.5, depth: 0.75, height: DESK_HEIGHT }), x, z);
  furnish(createWoodChair(GFX, { ...wood, kind: 'dining' }), x, z + 0.85, Math.PI);
  furnish(createWoodChair(GFX, { ...wood, kind: 'armchair' }), x - inward * 1.7, z + 0.3, inward * Math.PI / 2 + Math.PI);
  furnish(createWoodTable(GFX, { ...wood, kind: 'side' }), x - inward * 1.7, z + 1.4);
}

// Two bookcases side by side against the wall, the Wikipedia one on the left.
const cases = {};
SOURCES.forEach((source, i) => {
  const shelf = createBookcase(GFX, { species: SPECIES[source.id], shelves: 5, width: 0.8, depth: 0.34, height: 2.2 });
  shelf.group.position.set(i === 0 ? -0.45 : 0.45, 0, 0);
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
      bookplate: false, // no ex libris inside the cover
      textureSize: 512, // a shelf holds a hundred books; a 2048 cover for each would not fit in memory
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

// What the camera looks at: eased toward `focus` plus whatever the viewer has panned.
const focus = SHELF_TARGET.clone();
const panned = new GFX.Vector3();
function focusOn(point) { focus.copy(point); panned.set(0, 0, 0); }

let reading = null;       // the record of the book on the table, if any
let token = 0;            // which selection is current, so a slow fetch cannot overwrite a newer one
const moving = new Set(); // books that are opening or closing

function takeDown(record) {
  const { book, home } = record;
  home.parent.remove(book.group);
  scene.add(book.group);
  book.group.position.copy(readAt(record.source.id));
  book.group.quaternion.copy(READ_UPRIGHT);
  book.group.scale.setScalar(1);
  reading = record;
  moving.add(record);
  focusOn(readAt(record.source.id));
}

function putBack(record) {
  const { book, home } = record;
  book.pose({ open: 0, turn: 0 }); // shut at once: it is going back on the shelf, not closing in front of anyone
  scene.remove(book.group);
  home.parent.add(book.group);
  book.group.position.copy(home.position);
  book.group.quaternion.copy(home.quaternion);
  book.group.scale.copy(home.scale);
  moving.delete(record);
  if (reading === record) reading = null;
  focusOn(SHELF_TARGET);
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

const canvas = renderer.domElement;
canvas.style.touchAction = 'none';
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const raycaster = new GFX.Raycaster();
const NDC = new GFX.Vector2();

/** The book (and the hit) under a pointer event, or null. */
function pick(e) {
  const rect = canvas.getBoundingClientRect();
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
const RIGHT = new GFX.Vector3();
const UP = new GFX.Vector3();
const PAN_LIMIT = 5;
const ORBIT_SPEED = 0.006;

/** Slide the view sideways and up the screen by pixels, in proportion to how far the camera stands from what it looks at. */
function pan(dx, dy) {
  camera.updateMatrixWorld();
  RIGHT.setFromMatrixColumn(camera.matrixWorld, 0);
  UP.setFromMatrixColumn(camera.matrixWorld, 1);
  const perPixel = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.distanceTo(stage.target)) / canvas.clientHeight;
  panned.addScaledVector(RIGHT, -dx * perPixel).addScaledVector(UP, dy * perPixel);
  panned.clampLength(0, PAN_LIMIT);
}

function resetView() {
  stage.view.reset();
  panned.set(0, 0, 0);
}

/** Active pointers on the canvas: id -> { x, y }. */
const pointers = new Map();
/** The gesture in progress: { mode: 'book' | 'orbit' | 'pan', x, y, moved, found, button } for one pointer; { mode: 'pinch', gap, x, y } for two. */
let gesture = null;

function beginPinch() {
  const [a, b] = [...pointers.values()];
  gesture = { mode: 'pinch', gap: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: true };
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  stage.view.zoomBy(Math.exp(e.deltaY * unit * 0.0015));
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) return beginPinch();
  if (pointers.size > 2) return;
  const found = pick(e);
  const panning = e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey);
  gesture = {
    mode: panning ? 'pan' : found?.record === reading ? 'book' : 'orbit',
    x: e.clientX, y: e.clientY, moved: false, found, button: e.button,
  };
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gesture) return;
  if (gesture.mode === 'pinch') {
    if (pointers.size < 2) return;
    // Two fingers: the gap zooms, the middle of them pans.
    const [a, b] = [...pointers.values()];
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (gap > 0 && gesture.gap > 0) stage.view.zoomBy(gesture.gap / gap);
    pan(mx - gesture.x, my - gesture.y);
    Object.assign(gesture, { gap, x: mx, y: my });
    return;
  }
  const dx = e.clientX - gesture.x;
  const dy = e.clientY - gesture.y;
  if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
  gesture.moved = true;
  gesture.x = e.clientX;
  gesture.y = e.clientY;
  if (gesture.mode === 'pan') {
    pan(dx, dy);
  } else if (gesture.mode === 'orbit') {
    stage.view.turn(-dx * ORBIT_SPEED, dy * ORBIT_SPEED);
  } else if (reading) {
    // Turn the book about the screen's axes: it rotates freely, through any angle.
    SPIN.setFromAxisAngle(AXIS_Y, dx * 0.01);
    reading.book.group.quaternion.premultiply(SPIN);
    SPIN.setFromAxisAngle(AXIS_X, dy * 0.01);
    reading.book.group.quaternion.premultiply(SPIN);
  }
});

function release(e) {
  pointers.delete(e.pointerId);
  canvas.releasePointerCapture?.(e.pointerId);
}
canvas.addEventListener('pointercancel', (e) => { release(e); if (pointers.size === 0) gesture = null; });
canvas.addEventListener('pointerup', (e) => {
  release(e);
  const was = gesture;
  if (pointers.size === 1 && was?.mode === 'pinch') { gesture = null; pointers.clear(); return; } // a finger lifted off a pinch: nothing to click
  if (pointers.size > 0) return;
  gesture = null;
  if (!was || was.moved || was.button !== 0 || was.mode === 'pan') return; // a drag, not a click
  const found = was.found;
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

canvas.addEventListener('dblclick', (e) => { if (!pick(e)) resetView(); });

globalThis.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R' || e.key === 'Home') { resetView(); return; }
  if (!reading) return;
  if (e.key === 'ArrowRight') { reading.book.next(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { reading.book.prev(); e.preventDefault(); }
  else if (e.key === 'Escape') { putBack(reading); say(''); }
});

// ———————————————————————————————————————————— the frame loop

const GOAL = new GFX.Vector3();
let last = performance.now();
let shown = false;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const record of moving) {
    record.book.update(dt);
    if (record !== reading && record.book.openness < 0.001) moving.delete(record);
  }
  if (reading) reading.book.update(dt);
  // The camera's aim glides to where it should look; the view eases its own turn and zoom.
  GOAL.copy(focus).add(panned);
  stage.target.lerp(GOAL, 1 - Math.exp(-10 * dt));
  stage.view.step(dt);
  stage.look();   // place the camera on the target, from the view
  stage.render();
  if (!shown) { shown = true; loading.classList.add('done'); setTimeout(() => loading.remove(), 800); }
});
