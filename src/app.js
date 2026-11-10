/**
 * A four-sided reading room: History, Science, Entertainment, and Philosophy & Ideas.
 * Each subject has its own Wikipedia and Grokipedia bookcases, reading nook, and rug.
 * Click a book to read it; click a page's side to turn it, use the arrow keys, and click
 * the room (or press Escape) to put the book back.
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
import { createPersianRug } from './rug.js';
import { CATALOG, keyOf } from './catalog.js';
import { SOURCES } from './sources.js';
import { loadArticle, MAX_PAGES, pageCountForBook } from './library.js';
import { flowPages } from '../vendor/madness-engine/src/props/book-art.js';
import { shelveBooksByPriority } from './shelving.js';
import { catalogsForSections, SECTION_NAMES } from './sections.js';

// Wikipedia and Grokipedia retain their oak and mahogany identities. Subject nooks have
// complementary woods, while the AI centerpiece uses walnut as a neutral focal point.
const SPECIES = {
  wikipedia: 'oak', grokipedia: 'mahogany', ai: 'walnut',
  history: 'cherry', science: 'maple', entertainment: 'teak', philosophy: 'walnut',
};
const DESK_HEIGHT = 0.75;
const SOURCES_IN_ORDER = ['wikipedia', 'grokipedia'];
const AI_BAY = Object.freeze({ x: 0, z: 0, turn: 0, sources: SOURCES_IN_ORDER });
const WALL_BAYS = Object.freeze({
  history:       { x: 0, z: -4.35, turn: 0, sources: SOURCES_IN_ORDER },
  science:       { x: 4.35, z: 0, turn: -Math.PI / 2, sources: SOURCES_IN_ORDER },
  entertainment:{ x: 0, z: 4.35, turn: Math.PI, sources: SOURCES_IN_ORDER },
  philosophy:    { x: -4.35, z: 0, turn: Math.PI / 2, sources: SOURCES_IN_ORDER },
});
const SHELF_TARGET = new GFX.Vector3(0, 1.15, 0);
const AXIS_Y = new GFX.Vector3(0, 1, 0);

function pointInBay(bay, x, z, y = 0) {
  return new GFX.Vector3(x, y, z)
    .applyAxisAngle(AXIS_Y, bay.turn)
    .add(new GFX.Vector3(bay.x, 0, bay.z));
}

function readAt(record) {
  const bay = record.sectionId === 'ai' ? AI_BAY : WALL_BAYS[record.sectionId];
  const towardCenter = record.source.id === 'wikipedia' ? 1 : -1;
  const lateral = record.sectionId === 'ai' ? 0 : -1.65;
  return pointInBay(bay, lateral, towardCenter * 1.18, DESK_HEIGHT + 0.42);
}
const READ_UPRIGHT = new GFX.Quaternion().setFromAxisAngle(new GFX.Vector3(1, 0, 0), Math.PI / 2);

// A view that can go from nearly level to nearly overhead, and in close or far out.
const VIEW_HOME_ZOOM = 2.0;
const BOOK_VIEW_ZOOM = 0.68;
const { createView } = defineView({
  home: { yaw: Math.PI / 4, pitch: 0.48, zoom: VIEW_HOME_ZOOM },
  limits: { pitch: [0.08, 1.35], zoom: [0.35, 2.4] },
});

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
  lens: { distance: 9.5, fov: 36 },
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

const ROOM_HALF = 7.2;
const ROOM_SIZE = ROOM_HALF * 2;
const WALL_HEIGHT = 4.2;
const wallMaterial = new GFX.MeshStandardMaterial({ color: '#4a4a63', roughness: 0.95, metalness: 0 });
const floorMaterial = new GFX.MeshStandardMaterial({ color: '#3a2d26', roughness: 0.9, metalness: 0 });

const floor = new GFX.Mesh(new GFX.BoxGeometry(ROOM_SIZE, 0.18, ROOM_SIZE), floorMaterial);
floor.name = 'square library stage';
floor.position.y = -0.09;
floor.receiveShadow = true;
floor.castShadow = true;
scene.add(floor);

const walls = [
  { name: 'north wall', position: [0, WALL_HEIGHT / 2, -ROOM_HALF], rotation: 0 },
  { name: 'east wall', position: [ROOM_HALF, WALL_HEIGHT / 2, 0], rotation: -Math.PI / 2 },
  { name: 'south wall', position: [0, WALL_HEIGHT / 2, ROOM_HALF], rotation: Math.PI },
  { name: 'west wall', position: [-ROOM_HALF, WALL_HEIGHT / 2, 0], rotation: Math.PI / 2 },
];
for (const spec of walls) {
  const panel = new GFX.Mesh(new GFX.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT), wallMaterial);
  panel.name = spec.name;
  panel.position.set(...spec.position);
  panel.rotation.y = spec.rotation;
  panel.receiveShadow = true;
  scene.add(panel);
}

// Earth-toned woven rugs distinguish the central AI room and each subject's paired reading nooks.
const centerRug = createPersianRug(GFX, { width: 4.8, depth: 4.8, fringeLength: 0.06 });
centerRug.group.name = 'central AI Persian rug';
centerRug.group.position.set(0, 0.008, 0);
scene.add(centerRug.group);

for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  // The outer reading bays each get a matching rug. The central AI rug remains separate,
  // with a clear band of floor between the two so their fringes never overlap.
  const rug = createPersianRug(GFX, { width: 2.1, depth: 2.2, fringeLength: 0.04 });
  rug.group.name = `${sectionId} reading rug`;
  rug.group.position.copy(pointInBay(bay, -1.65, -1.85, 0.01));
  rug.group.rotation.y = bay.turn;
  scene.add(rug.group);
}

/** Place furniture with its local front aimed at the relevant shelf. */
function furnish(piece, x, z, turn = 0) {
  piece.group.position.set(x, 0, z);
  piece.group.rotation.y = turn;
  scene.add(piece.group);
  return piece;
}

const cases = {};

/**
 * Two matching cases share their back panels at the center plane. Wikipedia faces
 * toward the room center; Grokipedia faces the opposite direction.
 */
function addBackToBackCases(sectionId, bay) {
  // Original Alexandrpedia bookcase dimensions; the new layout changes placement only.
  const width = 0.8;
  const depth = 0.34;
  const inward = new GFX.Vector3(0, 0, 1).applyAxisAngle(AXIS_Y, bay.turn);
  for (const sourceId of SOURCES_IN_ORDER) {
    const sign = sourceId === 'wikipedia' ? 1 : -1;
    const shelf = createBookcase(GFX, {
      species: SPECIES[sourceId],
      shelves: 4,
      width,
      depth,
      height: 2.2,
      seed: sectionId.length * 31 + (sourceId === 'wikipedia' ? 3 : 7),
    });
    shelf.group.position.set(
      bay.x + inward.x * sign * depth / 2,
      0,
      bay.z + inward.z * sign * depth / 2,
    );
    shelf.group.rotation.y = bay.turn + (sign < 0 ? Math.PI : 0);
    scene.add(shelf.group);
    cases[`${sectionId}:${sourceId}`] = shelf;
  }
}

addBackToBackCases('ai', AI_BAY);
for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  addBackToBackCases(sectionId, bay);
}

/** A framed two-sided brass title plaque, painted once and shown legibly from either side. */
function addSectionSign(sectionId, bay, width, y = 2.72) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#32251f';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c4a66a';
  context.lineWidth = 12;
  context.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  context.lineWidth = 3;
  context.strokeRect(38, 38, canvas.width - 76, canvas.height - 76);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#c4a66a';
  context.font = 'bold 30px Georgia, serif';
  context.fillText('ALEXANDRPEDIA COLLECTION', canvas.width / 2, 76);
  context.fillStyle = '#f1e6d1';
  context.font = 'bold 72px Georgia, serif';
  context.fillText(SECTION_NAMES[sectionId].toUpperCase(), canvas.width / 2, 162, canvas.width - 100);

  const texture = new GFX.CanvasTexture(canvas);
  texture.colorSpace = GFX.SRGBColorSpace;
  texture.anisotropy = 8;
  const face = new GFX.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0 });
  const woodColor = { ai: '#5b3d2b', history: '#6b3c2c', science: '#9a7445', entertainment: '#67452e', philosophy: '#554034' }[sectionId];
  const frame = new GFX.MeshStandardMaterial({ color: woodColor, roughness: 0.72, metalness: 0 });
  const group = new GFX.Group();
  group.name = `${SECTION_NAMES[sectionId]} title plaque`;
  group.position.set(bay.x, y, bay.z);
  group.rotation.y = bay.turn;
  group.add(new GFX.Mesh(new GFX.BoxGeometry(width + 0.14, 0.58, 0.08), frame));
  const front = new GFX.Mesh(new GFX.PlaneGeometry(width, 0.44), face);
  front.position.z = 0.043;
  const reverse = new GFX.Mesh(new GFX.PlaneGeometry(width, 0.44), face);
  reverse.position.z = -0.043;
  reverse.rotation.y = Math.PI;
  group.add(front, reverse);
  scene.add(group);
}

addSectionSign('ai', AI_BAY, 2.05, 2.82);
for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  addSectionSign(sectionId, bay, 1.45, 2.55);
}

// AI reading desks sit on opposite sides of the central island.
for (const sourceId of SOURCES_IN_ORDER) {
  const sign = sourceId === 'wikipedia' ? 1 : -1;
  const wood = { species: SPECIES.ai, finish: 'lacquered' };
  furnish(
    createWoodTable(GFX, { ...wood, kind: 'desk', width: 1.3, depth: 0.68, height: DESK_HEIGHT }),
    0, sign * 1.2, sign > 0 ? 0 : Math.PI,
  );
  furnish(
    createWoodChair(GFX, { ...wood, kind: 'armchair' }),
    0, sign * 2.1, sign > 0 ? Math.PI : 0,
  );
  furnish(
    createWoodTable(GFX, { ...wood, kind: 'side' }),
    sign * 0.95, sign * 1.4, 0,
  );
}

// Each wall section has a compact desk, armchair and side table beside its two-sided shelf.
for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  const wood = { species: SPECIES[sectionId], finish: 'lacquered' };
  for (const sourceId of SOURCES_IN_ORDER) {
    const sign = sourceId === 'wikipedia' ? 1 : -1;
    const desk = pointInBay(bay, -1.65, sign * 1.18);
    const chair = pointInBay(bay, -1.65, sign * 2.12);
    const side = pointInBay(bay, -2.45, sign * 1.28);
    furnish(
      createWoodTable(GFX, { ...wood, kind: 'desk', width: 1.35, depth: 0.68, height: DESK_HEIGHT }),
      desk.x, desk.z, bay.turn + (sign < 0 ? Math.PI : 0),
    );
    furnish(
      createWoodChair(GFX, { ...wood, kind: 'armchair' }),
      chair.x, chair.z, bay.turn + (sign > 0 ? Math.PI : 0),
    );
    furnish(
      createWoodTable(GFX, { ...wood, kind: 'side' }),
      side.x, side.z, bay.turn,
    );
  }
}

/** Every book: { entry, source, book, key, home } where `home` is where it stands on its shelf. */
await loadingStep('Reading the committed article snapshots…');

const books = new Map();
const byGroup = new Map();

// Keep the current varied shelf heights, but remove the random overall scale from
// thickness. The spine is sized by measured article pages, not stockBooks' guess.
const BOOK_SCALE = 0.57;
const BOOK_PAGE_WIDTH = 0.30;
const BOOK_BASE_HEIGHT = 0.42;
const BOOK_LEAF_PITCH = 0.0006;

const SECTION_CATALOGS = catalogsForSections(CATALOG);
const missingSnapshots = [];

for (const [sectionId, catalog] of Object.entries(SECTION_CATALOGS)) {
  const bay = sectionId === 'ai' ? AI_BAY : WALL_BAYS[sectionId];
  for (const sourceId of bay.sources) {
    const source = SOURCES.find((item) => item.id === sourceId);
    const results = await Promise.all(catalog.map(async (entry) => {
      try {
        const article = await loadArticle(sourceId, entry);
        return { entry, article };
      } catch (error) {
        missingSnapshots.push(`${sourceId}/${entry.title}`);
        console.warn(`Missing local article snapshot: ${sourceId}/${entry.title} (${error.message})`);
        return null;
      }
    }));
    const available = results.filter(Boolean);
    const stock = stockBooks(available.length, sectionId.length + (sourceId === 'wikipedia' ? 11 : 17));
    const prepared = await Promise.all(available.map(async ({ entry, article }, index) => {
      const pages = flowPages(article.text, { print: source.print });
      const visiblePages = pages.slice(0, MAX_PAGES);
      const pageCount = pageCountForBook(visiblePages.length);
      if (pages.length > MAX_PAGES) {
        console.warn(`${article.title}: ${pages.length} measured pages exceeds the engine's ${MAX_PAGES}-page limit.`);
      }
      const originalSize = stock[index].size;
      const book = createBook(GFX, {
        ...stock[index],
        title: article.title,
        subtitle: `${source.name} · ${entry.shelf ?? entry.kind}`,
        pageCount,
        pages: visiblePages,
        print: source.print,
        width: BOOK_PAGE_WIDTH,
        height: BOOK_BASE_HEIGHT * (originalSize / BOOK_SCALE),
        size: BOOK_SCALE,
        leafPitch: BOOK_LEAF_PITCH,
        deferPages: true,
        bookplate: false,
        textureSize: 512,
        bump: false,
      });
      const record = {
        entry, source, article, book, pages: visiblePages.length,
        key: `${sectionId}:${sourceId}:${keyOf(entry)}`,
        sectionId, home: null,
      };
      books.set(record.key, record);
      byGroup.set(book.group, record);
      return book;
    }));
    const { left } = shelveBooksByPriority(cases[`${sectionId}:${sourceId}`], prepared);
    if (left.length) console.warn(`${sectionId} / ${source.name}: ${left.length} book(s) did not fit on the shelves`);
    for (const book of prepared) {
      const record = byGroup.get(book.group);
      record.home = {
        parent: cases[`${sectionId}:${sourceId}`].group,
        position: book.group.position.clone(),
        quaternion: book.group.quaternion.clone(),
        scale: book.group.scale.clone(),
      };
    }
  }
}

const snapshotNotice = missingSnapshots.length
  ? `${missingSnapshots.length} subject articles still need local snapshots. The central AI collection is available now.`
  : '';
if (missingSnapshots.length) {
  console.warn(`${missingSnapshots.length} encyclopedia snapshots are not yet imported for the new subject collections.`);
  say(snapshotNotice);
}


// ———————————————————————————————————————————— taking a book down and putting it back

// What the camera looks at: eased toward `focus` plus whatever the viewer has panned.
const focus = SHELF_TARGET.clone();
const panned = new GFX.Vector3();
function focusOn(point) { focus.copy(point); panned.set(0, 0, 0); }

let reading = null;       // the record of the book on the table, if any
const moving = new Set(); // books that are opening or closing

function takeDown(record) {
  const { book, home } = record;
  home.parent.remove(book.group);
  scene.add(book.group);
  book.group.position.copy(readAt(record));
  book.group.quaternion.copy(READ_UPRIGHT);
  book.group.scale.setScalar(1);
  reading = record;
  moving.add(record);
  stage.view.zoomBy(BOOK_VIEW_ZOOM / stage.view.aim.zoom);
  focusOn(readAt(record));
}

function putBack(record) {
  const { book, home } = record;
  book.close({ instant: true }); // shut at once: it is going back on the shelf, not closing in front of anyone
  scene.remove(book.group);
  home.parent.add(book.group);
  book.group.position.copy(home.position);
  book.group.quaternion.copy(home.quaternion);
  book.group.scale.copy(home.scale);
  moving.delete(record);
  if (reading === record) reading = null;
  stage.view.zoomBy(VIEW_HOME_ZOOM / stage.view.aim.zoom);
  focusOn(SHELF_TARGET);
  say(snapshotNotice);
}

function select(key) {
  const record = books.get(key);
  if (!record || reading === record) return;
  if (reading) putBack(reading);
  takeDown(record);
  record.book.open();
  wake();
  say('');
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
  if (reading) putBack(reading);
});

canvas.addEventListener('dblclick', (e) => { if (!pick(e)) resetView(); });

globalThis.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R' || e.key === 'Home') { resetView(); return; }
  if (!reading) return;
  if (e.key === 'ArrowRight') { reading.book.next(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { reading.book.prev(); e.preventDefault(); }
  else if (e.key === 'Escape') { putBack(reading); }
});

// ———————————————————————————————————————————— the frame loop

// The picture is drawn only when something has changed: a book or the camera is moving, or the viewer has
// touched the page, or the page has been resized or has new text. A still room costs nothing to leave alone.
let dirty = true;
function wake() { dirty = true; }
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'dblclick']) globalThis.addEventListener(type, wake, { passive: true });
new ResizeObserver(wake).observe(document.getElementById('host'));

/** A book's pose as numbers: if it is the same as last frame, it is at rest. */
function poseOf(book) {
  const out = [book.openness];
  for (const L of book.leaves) out.push(L.turn, L.curl);
  return out;
}
function restless(record) {
  const was = record.pose;
  const now = poseOf(record.book);
  record.pose = now;
  return !was || now.some((v, i) => Math.abs(v - was[i]) > 1e-7);
}

const GOAL = new GFX.Vector3();
let last = performance.now();
let shown = false;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const record of moving) {
    record.book.update(dt);
    if (restless(record)) dirty = true;
    if (record !== reading && record.book.openness < 0.001) moving.delete(record);
  }
  // The camera's aim glides to where it should look; the view eases its own turn and zoom.
  GOAL.copy(focus).add(panned);
  const view = stage.view;
  const eased = Math.abs(view.yaw - view.aim.yaw) > 1e-6 || Math.abs(view.pitch - view.aim.pitch) > 1e-6 || Math.abs(view.zoom - view.aim.zoom) > 1e-6;
  if (eased || stage.target.distanceToSquared(GOAL) > 1e-10) dirty = true;
  stage.target.lerp(GOAL, 1 - Math.exp(-10 * dt));
  view.step(dt);
  if (!dirty) return;
  dirty = false;
  stage.look();   // place the camera on the target, from the view
  stage.render();
  if (!shown) { shown = true; loading.classList.add('done'); setTimeout(() => loading.remove(), 800); }
});
