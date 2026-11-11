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
import { createHuman, FIGURES } from '../vendor/madness-engine/src/people/index.js';
import { createWoodTable } from '../vendor/madness-engine/src/props/wood-table.js';
import { createWoodChair } from '../vendor/madness-engine/src/props/wood-chair.js';
import { createTrackLight } from '../vendor/madness-engine/src/props/track-light.js';
import { createGlassEntry } from '../vendor/madness-engine/src/props/glass-entry.js';
import { createPersianRug } from '../vendor/madness-engine/src/props/rug.js';
import { CATALOG, keyOf } from './catalog.js';
import { SOURCES } from './sources.js';
import { loadArticle, MAX_PAGES, pageCountForBook } from './library.js';
import { flowPages } from '../vendor/madness-engine/src/props/book-art.js';
import { shelveBooksByPriority } from './shelving.js';
import { catalogsForSections, SECTION_NAMES } from './sections.js';
import { CENTER_LONG_TABLE_DIMENSIONS, CORNER_READING_TABLE_DIMENSIONS, ORIGINAL_BOOKCASE_DIMENSIONS, WALL_SIGN_FRAME_EXTRA, centerLongTableChairs, centerLongTablePlacement, cornerReadingNookPlacement, TABLE_HEIGHT, wallCasePlacement, wallReadingNookPlacement } from './room-layout.js';

// Wikipedia and Grokipedia retain their oak and mahogany identities. Subject nooks have
// complementary woods, while the AI centerpiece uses walnut as a neutral focal point.
const SPECIES = Object.freeze({
  wikipedia: 'oak',
  grokipedia: 'mahogany',
});
const DESK_HEIGHT = TABLE_HEIGHT;
const SOURCES_IN_ORDER = ['wikipedia', 'grokipedia'];
const AI_BAY = Object.freeze({ x: 0, z: 0, turn: 0, sources: SOURCES_IN_ORDER });
const WALL_BAYS = Object.freeze({
  history:       { x: 0, z: -4.35, turn: 0, sources: SOURCES_IN_ORDER },
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


// A view that can go from nearly level to nearly overhead, and in close or far out.
const VIEW_HOME_YAW = 0;
const READ_UPRIGHT = new GFX.Quaternion().setFromAxisAngle(new GFX.Vector3(1, 0, 0), Math.PI / 2);
const VIEW_HOME_ZOOM = 0.65;
const { createView, groundAxes } = defineView({
  home: { yaw: VIEW_HOME_YAW, pitch: 0.12, zoom: VIEW_HOME_ZOOM },
  limits: { pitch: [-0.02, 1.35], zoom: [0.03, 2.4] },
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

// Quality presets. High is the full look; Medium and Low draw fewer pixels and cheaper shadows.
// The choice is remembered in this browser and takes effect on reload (the renderer is built once).
const QUALITY = Object.freeze({
  // shelfShadows: whether books standing on the shelves cast shadows (the shelves themselves always do).
  low:    { pixelRatio: 1,    shadows: false, shadowSize: 512,  shelfShadows: false },
  medium: { pixelRatio: 1.25, shadows: true,  shadowSize: 1024, shelfShadows: false },
  high:   { pixelRatio: 2,    shadows: true,  shadowSize: 2048, shelfShadows: true },
});
const QUALITY_KEY = 'alexandrpedia.quality';
let qualityName = 'medium';
try { const saved = localStorage.getItem(QUALITY_KEY); if (saved in QUALITY) qualityName = saved; } catch { /* storage unavailable */ }
const quality = QUALITY[qualityName];
const qualityPicker = document.getElementById('quality');
qualityPicker.value = qualityName;
qualityPicker.addEventListener('change', () => {
  try { localStorage.setItem(QUALITY_KEY, qualityPicker.value); } catch { /* storage unavailable */ }
  location.reload();
});

await loadingStep('Starting the renderer…');
const stage = await createStage(document.getElementById('host'), {
  room: paintRoom(), shadowSize: quality.shadowSize, shadows: quality.shadows, pixelRatio: quality.pixelRatio, fixtures: 0, label: 'alexandrpedia',
  lens: { distance: 7.5, fov: 36 },
  view: createView(),
});
const { scene, camera, renderer } = stage;
// Far enough to see the whole room when zoomed out; the stage moves the near plane to suit the distance.
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
centerRug.group.position.set(0, 0.001, 0);
scene.add(centerRug.group);

for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  // The outer reading bays each get a matching rug. The central AI rug remains separate,
  // with a clear band of floor between the two so their fringes never overlap.
  const rug = createPersianRug(GFX, { width: 2.65, depth: 2.8, fringeLength: 0.04 });
  rug.group.name = `${sectionId} reading rug`;
  rug.group.position.copy(pointInBay(bay, 0, -0.95, 0.001));
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

function createCase(sectionId, sourceId, position, rotationY) {
  const shelf = createBookcase(GFX, {
    species: SPECIES[sourceId],
    shelves: 4,
    ...ORIGINAL_BOOKCASE_DIMENSIONS,
    seed: sectionId.length * 31 + (sourceId === 'wikipedia' ? 3 : 7),
  });
  shelf.group.position.set(position.x, 0, position.z);
  shelf.group.rotation.y = rotationY;
  scene.add(shelf.group);
  cases[`${sectionId}:${sourceId}`] = shelf;
  return shelf;
}

/** The center AI cases alone share a back plane and face in opposite directions. */
function addBackToBackCases(sectionId, bay) {
  const depth = ORIGINAL_BOOKCASE_DIMENSIONS.depth;
  const inward = new GFX.Vector3(0, 0, 1).applyAxisAngle(AXIS_Y, bay.turn);
  for (const sourceId of SOURCES_IN_ORDER) {
    const sign = sourceId === 'wikipedia' ? 1 : -1;
    const position = {
      x: bay.x + inward.x * sign * depth / 2,
      z: bay.z + inward.z * sign * depth / 2,
    };
    createCase(sectionId, sourceId, position, bay.turn + (sign < 0 ? Math.PI : 0));
  }
}

/** Wall cases sit shoulder-to-shoulder, flush against the wall, and both face the room. */
function addSideBySideWallCases(sectionId, bay) {
  for (const [sourceIndex, sourceId] of SOURCES_IN_ORDER.entries()) {
    const placement = wallCasePlacement({ roomHalf: ROOM_HALF, bay, sourceIndex });
    createCase(sectionId, sourceId, placement, placement.rotationY);
  }
}

addBackToBackCases('ai', AI_BAY);
for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  addSideBySideWallCases(sectionId, bay);
}

// ———————————————————————————————————————————— track lighting over the shelves

// Ceiling track rails over each run of shelves (the engine's props/track-light): one PAR can per bookcase,
// each aimed at its case, and one warm light per run (the renderer has eight point lights at most), set just
// in front of and above the shelves so it falls off down them instead of flattening them.
const TRACK_HEIGHT = 3.9;     // the rail, hung below the 4.2 m ceiling line
const TRACK_REACH = 1.4;      // how far out from a bookcase's face the rail runs
const CAN_SPACING = ORIGINAL_BOOKCASE_DIMENSIONS.width + 0.06; // one can over each case

/** A bookcase's facing (its front, toward the room), from how it is turned. */
function caseFront(shelf) {
  const r = shelf.group.rotation.y;
  return new GFX.Vector3(Math.sin(r), 0, Math.cos(r));
}

/** One run of shelves (cases standing side by side, facing the same way): its track, cans and light. */
function lightRun(name, shelves) {
  const front = caseFront(shelves[0]);
  const middle = new GFX.Vector3();
  for (const shelf of shelves) middle.add(shelf.group.position);
  middle.divideScalar(shelves.length);
  const faceOut = ORIGINAL_BOOKCASE_DIMENSIONS.depth / 2;
  const track = createTrackLight(GFX, {
    cans: shelves.length,
    length: (shelves.length - 1) * CAN_SPACING + 0.5,
    drop: 0.2,
    intensity: 3, reach: 3.2, decay: 2,
    lightAt: [0, -1.4, -(TRACK_REACH - 0.7)], // 0.7 m out from the shelves, 2.5 m up
  });
  track.group.name = `${name} track light`;
  track.group.position.copy(middle).addScaledVector(front, faceOut + TRACK_REACH).setY(TRACK_HEIGHT);
  track.group.rotation.y = Math.atan2(front.x, front.z); // the rail runs along the shelves, the light toward them
  scene.add(track.group);
  // Each can aims at the middle of the case beneath it. The cans run along the rail in the order the cases do.
  const along = new GFX.Vector3(front.z, 0, -front.x);
  const ordered = [...shelves].sort((p, q) => p.group.position.dot(along) - q.group.position.dot(along));
  track.group.updateMatrixWorld(true);
  ordered.forEach((shelf, index) => {
    const target = shelf.group.position.clone().addScaledVector(front, faceOut).setY(ORIGINAL_BOOKCASE_DIMENSIONS.height * 0.55);
    track.aimCan(index, track.group.worldToLocal(target));
  });
}

lightRun('central AI front', [cases['ai:wikipedia']]);
lightRun('central AI back', [cases['ai:grokipedia']]);
for (const sectionId of Object.keys(WALL_BAYS)) {
  lightRun(sectionId, SOURCES_IN_ORDER.map((sourceId) => cases[`${sectionId}:${sourceId}`]));
}

// ———————————————————————————————————————————— the glass entryway

// The east wall is the way in: the engine's glass storefront (props/glass-entry), double doors with daylight
// behind them. Readers walk in through the doors and leave the same way.
const ENTRY_POINT = Object.freeze({ x: ROOM_HALF - 0.5, z: 0 });
{
  const entry = createGlassEntry(GFX, { width: 4.4, height: 3.0, doorWidth: 1.8 });
  entry.group.position.set(ROOM_HALF - 0.02, 0, 0); // set into the east wall, facing into the room
  entry.group.rotation.y = -Math.PI / 2;
  scene.add(entry.group);
}

/** Draw only the gold rules and lettering; the mahogany below stays visible. */
function createSectionSignFace(sectionId, collectionLabel, compact = false) {
  const canvas = document.createElement('canvas');
  canvas.width = compact ? 1024 : 1400;
  canvas.height = compact ? 560 : 360;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c4a66a';
  context.lineWidth = compact ? 5 : 6;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.lineWidth = 2;
  context.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#e2c78e';
  context.font = compact ? 'bold 44px Georgia, serif' : 'bold 38px Georgia, serif';
  context.fillText(collectionLabel, canvas.width / 2, compact ? 172 : 102);
  context.fillStyle = '#fff3d9';
  context.font = compact ? 'bold 58px Georgia, serif' : 'bold 78px Georgia, serif';
  context.fillText(SECTION_NAMES[sectionId].toUpperCase(), canvas.width / 2, compact ? 365 : 232, canvas.width - 110);

  const texture = new GFX.CanvasTexture(canvas);
  texture.colorSpace = GFX.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = GFX.LinearMipmapLinearFilter;
  texture.magFilter = GFX.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return new GFX.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: GFX.DoubleSide,
    toneMapped: false,
  });
}

/** Clone the top-surface wood material from a real engine-built mahogany table. */
function createMahoganyPlaqueMaterial() {
  const sample = createWoodTable(GFX, {
    species: 'mahogany',
    finish: 'lacquered',
    kind: 'desk',
    // Use dimensions already supported by the room's working desks.
    width: 1.3,
    depth: 0.68,
    height: DESK_HEIGHT,
  });

  // The engine exposes its resolved wood material on the returned table API.
  // Materials are shared by every plaque frame, so no copy is needed.
  if (!sample.material) {
    console.warn('Mahogany table material is unavailable; using a plain mahogany plaque finish.');
    return new GFX.MeshStandardMaterial({
      color: '#58372f',
      roughness: 0.82,
      metalness: 0,
    });
  }

  return sample.material;
}
const MAHOGANY_PLAQUE_MATERIAL = createMahoganyPlaqueMaterial();

function addPlaqueFrame(group, width) {
  group.add(new GFX.Mesh(new GFX.BoxGeometry(width + WALL_SIGN_FRAME_EXTRA, 0.58, 0.10), MAHOGANY_PLAQUE_MATERIAL));
}

/** The center AI plaque is double-sided because its two shelves face opposite aisles. */
function addSectionSign(sectionId, bay, width, y = 2.72) {
  const group = new GFX.Group();
  group.name = `${SECTION_NAMES[sectionId]} collection plaque`;
  group.rotation.y = bay.turn;

  if (sectionId === 'ai') {
    group.position.set(bay.x, y, bay.z);
    addPlaqueFrame(group, width);
    const wikipediaFace = createSectionSignFace(sectionId, 'WIKIPEDIA COLLECTION');
    const grokipediaFace = createSectionSignFace(sectionId, 'GROKIPEDIA COLLECTION');
    if (wikipediaFace) {
      const front = new GFX.Mesh(new GFX.PlaneGeometry(width, 0.44), wikipediaFace);
      front.position.z = 0.052;
      group.add(front);
    }
    if (grokipediaFace) {
      const reverse = new GFX.Mesh(new GFX.PlaneGeometry(width, 0.44), grokipediaFace);
      reverse.position.z = -0.052;
      reverse.rotation.y = Math.PI;
      group.add(reverse);
    }
    scene.add(group);
    return;
  }

  // The wall cases are side-by-side, so each gets its own plaque on the same inward-facing plane.
  for (const [sourceIndex, sourceId] of SOURCES_IN_ORDER.entries()) {
    const placement = wallCasePlacement({ roomHalf: ROOM_HALF, bay, sourceIndex });
    const plaque = new GFX.Group();
    plaque.name = `${SECTION_NAMES[sectionId]} ${sourceId} collection plaque`;
    plaque.position.set(placement.x, y, placement.z);
    plaque.rotation.y = bay.turn;
    addPlaqueFrame(plaque, ORIGINAL_BOOKCASE_DIMENSIONS.width);
    const face = createSectionSignFace(
      sectionId,
      sourceId === 'wikipedia' ? 'WIKIPEDIA COLLECTION' : 'GROKIPEDIA COLLECTION',
      true,
    );
    if (face) {
      const front = new GFX.Mesh(new GFX.PlaneGeometry(ORIGINAL_BOOKCASE_DIMENSIONS.width, 0.44), face);
      front.position.z = 0.052;
      plaque.add(front);
    }
    scene.add(plaque);
  }
}

addSectionSign('ai', AI_BAY, 2.05, 2.82);
for (const [sectionId, bay] of Object.entries(WALL_BAYS)) {
  addSectionSign(sectionId, bay, 1.45, 2.55);
}

// Two long shared tables flank the central AI cases. Their long axes run north-south,
// leaving the front approach to both faces of the back-to-back shelves open.
for (const side of ['left', 'right']) {
  const sourceId = side === 'left' ? 'wikipedia' : 'grokipedia';
  const placement = centerLongTablePlacement({ side });
  const wood = { species: SPECIES[sourceId], finish: 'lacquered' };
  const table = createWoodTable(GFX, {
    ...wood,
    kind: 'desk',
    width: CENTER_LONG_TABLE_DIMENSIONS.width,
    depth: CENTER_LONG_TABLE_DIMENSIONS.depth,
    height: DESK_HEIGHT,
  });
  table.group.name = side + ' central AI long table';
  furnish(table, placement.x, placement.z, placement.rotationY);

  // Two chairs on the outer long side, so readers sit beside the book and the aisle to the shelves stays open.
  centerLongTableChairs({ side }).chairs.forEach((spot, index) => {
    const chair = createWoodChair(GFX, { ...wood, kind: 'dining' });
    chair.group.name = `${side} central AI reading chair ${index + 1}`;
    furnish(chair, spot.x, spot.z, spot.rotationY);
  });
}

// Four compact reading nooks occupy the open room corners. Wall-section books are
// placed on the nearest of these shared tables when selected for reading.
const CORNER_NOOKS = [
  { cornerX: -1, cornerZ: -1, sourceId: 'wikipedia' },
  { cornerX: 1, cornerZ: -1, sourceId: 'grokipedia' },
  { cornerX: 1, cornerZ: 1, sourceId: 'wikipedia' },
  { cornerX: -1, cornerZ: 1, sourceId: 'grokipedia' },
];
for (const [index, corner] of CORNER_NOOKS.entries()) {
  const nook = cornerReadingNookPlacement({
    roomHalf: ROOM_HALF,
    cornerX: corner.cornerX,
    cornerZ: corner.cornerZ,
  });
  const wood = { species: SPECIES[corner.sourceId], finish: 'lacquered' };
  const table = createWoodTable(GFX, {
    ...wood,
    kind: 'desk',
    width: CORNER_READING_TABLE_DIMENSIONS.width,
    depth: CORNER_READING_TABLE_DIMENSIONS.depth,
    height: DESK_HEIGHT,
  });
  table.group.name = 'corner ' + (index + 1) + ' reading table';
  furnish(table, nook.table.x, nook.table.z, nook.table.rotationY);

  // Four chairs around each table: the inward one, then three more spaced on the other diagonals.
  nook.chairs.forEach((spot, chairIndex) => {
    const chair = createWoodChair(GFX, { ...wood, kind: 'armchair' });
    chair.group.name = 'corner ' + (index + 1) + ' reading chair ' + (chairIndex + 1);
    furnish(chair, spot.x, spot.z, spot.rotationY);
  });
}

/** Every book: { entry, source, book, key, home } where `home` is where it stands on its shelf. */
await loadingStep('Reading the committed article snapshots…');

const books = new Map();
const byGroup = new Map();

// Keep the current varied shelf heights, but remove the random overall scale from thickness.
const BOOK_SCALE = 0.57;
const BOOK_PAGE_WIDTH = 0.30;
const BOOK_BASE_HEIGHT = 0.42;
const BOOK_LEAF_PITCH = 0.0006;

const SECTION_CATALOGS = catalogsForSections(CATALOG);
const missingSnapshots = [];

// The shelves are built from titles and page counts alone (data/manifest.json, written by npm run build-manifest). A book on a
// shelf is a whole book with blank placeholder pages; its article is fetched only when it is opened.
const MANIFEST = await (await fetch(new URL('../data/manifest.json', import.meta.url))).json();

for (const [sectionId, catalog] of Object.entries(SECTION_CATALOGS)) {
  const bay = sectionId === 'ai' ? AI_BAY : WALL_BAYS[sectionId];
  for (const sourceId of bay.sources) {
    const source = SOURCES.find((item) => item.id === sourceId);
    const titles = MANIFEST[sourceId] ?? {};
    const available = catalog.filter((entry) => {
      if (titles[entry.title]) return true;
      missingSnapshots.push(`${sourceId}/${entry.title}`);
      return false;
    });
    const stock = stockBooks(available.length, sectionId.length + (sourceId === 'wikipedia' ? 11 : 17));
    const prepared = available.map((entry, index) => {
      const { title, pages } = titles[entry.title];
      const originalSize = stock[index].size;
      const bookOptions = {
        ...stock[index],
        pageCount: pageCountForBook(pages), // blank pages, as many as its article will fill: its real thickness
        title,
        subtitle: `${source.name} · ${entry.shelf ?? entry.kind}`,
        print: source.print,
        width: BOOK_PAGE_WIDTH,
        height: BOOK_BASE_HEIGHT * (originalSize / BOOK_SCALE),
        leafPitch: BOOK_LEAF_PITCH,
        deferPages: true,
        bookplate: false,
        textureSize: 512,
        bump: false,
      };
      // A whole book with blank pages: its words are written only once it is pulled from the shelf (see select).
      const book = createBook(GFX, { ...bookOptions, size: BOOK_SCALE });
      const record = {
        entry, source, title, book, shelfBook: book, bookOptions,
        key: `${sectionId}:${sourceId}:${keyOf(entry)}`,
        sectionId, home: null,
      };
      books.set(record.key, record);
      byGroup.set(book.group, record);
      return book;
    });
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


// ———————————————————————————————————————————— static scene optimizations

/** Whether a book's meshes cast shadows. Shelved books are hundreds of small meshes in the shadow pass. */
function bookShadows(book, on) {
  book.group.traverse((node) => { if (node.isMesh) node.castShadow = on; });
}
if (!quality.shelfShadows) for (const record of books.values()) bookShadows(record.book, false);

/**
 * A shut book on a shelf is skipped when it is out of view. The engine never culls a book (its pages
 * bend past their bounds as they turn), so all 646 covers were drawn every frame, seen or not. Books
 * in view are drawn at full quality; the open book is never culled.
 */
function shelfCulling(book, on) {
  book.group.traverse((node) => {
    if (!node.isMesh) return;
    if (on) node.geometry.computeBoundingSphere(); // the shut shape, fresh each time it is shelved
    node.frustumCulled = on;
  });
}
for (const record of books.values()) shelfCulling(record.book, true);

/**
 * Everything that never moves (room, shelves, furniture, rugs) stops recomputing its matrix
 * every frame. Books keep updating: they are taken down, opened, turned and put back.
 */
function hasLive(node) {
  if (node.isLight || node.isCamera || byGroup.has(node)) return true;
  return node.children.some(hasLive);
}
function freezeStatic(node) {
  if (byGroup.has(node) || node.isLight || node.isCamera) return; // books, lights and cameras stay live
  if (!hasLive(node)) {
    node.traverse((n) => { n.updateMatrix(); n.matrixAutoUpdate = false; });
    return;
  }
  // A group holding books (a bookcase) or a light: freeze the group itself, keep walking its children.
  node.updateMatrix();
  node.matrixAutoUpdate = false;
  for (const child of node.children) freezeStatic(child);
}
scene.updateMatrixWorld(true);
for (const child of scene.children) freezeStatic(child);

// ———————————————————————————————————————————— people reading in the corners

const READER_SHIRTS = ['#5b6b7a', '#7a4e3a', '#3f5e4c', '#8a6d3b', '#a04b3f', '#d8cbb5', '#2e3a4a'];
const SKIN_TONES = ['#f6dccb', '#ecc3a4', '#dba982', '#c68a5e', '#a86b45', '#8a5636', '#5f3b26', '#432a1c'];
const IRIS_COLOURS = ['#4f7fb8', '#6b8e4e', '#7a5a3a', '#3d3d3d', '#8c9ba5', '#5a4a2a'];
const HAIR_COLOURS = ['#1f1a17', '#4a3322', '#8a6a3a', '#c9a467', '#2b2b2b', '#9a9a9a', '#b5532f'];
const FACE_SHAPES = ['oval', 'round', 'square', 'long', 'heart', 'diamond'];
const NOSE_SHAPES = ['straight', 'aquiline', 'roman', 'button', 'snub', 'broad', 'hooked'];
const EYE_SHAPES = ['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned'];
const BUILDS = ['average', 'slim', 'athletic', 'stocky', 'heavy'];
const choose = (list) => list[Math.floor(Math.random() * list.length)];

/** A random look for a figure of `sex`: build, skin tone and features. The library has no sunglasses. */
function randomLook(sex) {
  const look = {
    glasses: 'none',
    build: choose(BUILDS),
    skin: choose(SKIN_TONES),
    iris: choose(IRIS_COLOURS),
    hairColour: choose(HAIR_COLOURS),
    hair: choose(sex === 'male' ? ['none', 'sidePart'] : ['none', 'sidePart', 'long']),
    face: choose(FACE_SHAPES),
    noseShape: choose(NOSE_SHAPES),
    eyeShape: choose(EYE_SHAPES),
  };
  if (sex === 'male') look.beard = choose(['none', 'full']);
  return look;
}

const READER_SEATS = CORNER_NOOKS.flatMap((corner, cornerIndex) => {
  const nook = cornerReadingNookPlacement({ roomHalf: ROOM_HALF, cornerX: corner.cornerX, cornerZ: corner.cornerZ });
  return nook.chairs.map((spot, chairIndex) => ({ key: `${cornerIndex}:${chairIndex}`, spot }));
});
const MIN_READERS = 1;
const MAX_READERS = 4;
const WALK_SPEED = 1.0; // metres a second
const titles = [...books.values()];

/** Where every reader comes in and leaves: just inside the glass doors. */
function entranceFor() { return ENTRY_POINT; }
// The figures are built once, half men and half women, and reused: building a figure takes seconds,
// so they are only built the first time people are switched on.
const figures = [];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
async function buildFigures() {
  // One figure per frame, so switching people on never freezes the page for seconds.
  for (const sex of ['male', 'male', 'female', 'female'].slice(figures.length)) {
    await nextFrame();
    if (!peopleOn) return;
    const man = createHuman(GFX, { sex, detail: 0.5 });
    const joint = FIGURES[sex].joints.ball;
    man.pose({ clip: 'idle', t: 0, time: 0 });
    const standingSole = man.point('footL', joint)[1];
    man.pose({ clip: 'read', t: 1, time: 0 });
    const seatedSole = man.point('footL', joint)[1];
    // Each figure gets its look, and its own book to carry, once: restyling a figure takes seconds,
    // so doing it each time someone walks in froze the page. Arrivals only change the shirt.
    man.customize(randomLook(sex));
    // The engine's own Book of Madness, made as the asset viewer makes it to hold, so the hands grip it as they do there.
    const copy = createBook(GFX, { size: 0.45, pageCount: 60 });
    figures.push({ man, sex, copy, lift: standingSole - seatedSole, inUse: false });
  }
}

/** A figure in motion or seated: its seat, where it came in from, and the copy of the book it holds. */
const readers = new Map(); // seat key -> reader
function createReader(seat, record) {
  const sexes = [...new Set(figures.filter((f) => !f.inUse).map((f) => f.sex))];
  const sex = choose(sexes);
  const slot = choose(figures.filter((f) => !f.inUse && f.sex === sex));
  slot.inUse = true;
  const { man, copy } = slot;
  man.setShirtColor(choose(READER_SHIRTS));
  holdCopy(man, copy, false);
  man.group.name = `${sex} reader`;
  scene.add(man.group);
  const reader = {
    key: seat.key, seat: seat.spot, entrance: entranceFor(seat.spot), slot, copy,
    phase: 'in', t0: performance.now() / 1000,
  };
  readers.set(seat.key, reader);
  return reader;
}

/** Puts a book in a figure's hands, shut while walking and open to read. Any book they held is let go first. */
function holdCopy(man, copy, open) {
  if (man.held('R')) man.release('R');
  if (man.held('L')) man.release('L');
  man.hold(copy, { how: 'book', open });
}

/** Walks a reader one step along the path for this frame; sits them down or removes them at the end. */
function walkReader(reader, now) {
  const inbound = reader.phase === 'in';
  const from = inbound ? reader.entrance : reader.seat;
  const to = inbound ? reader.seat : reader.entrance;
  const dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const elapsed = now - reader.t0;
  const along = Math.min(1, elapsed * WALK_SPEED / length);
  const { man, lift } = reader.slot;
  const { group } = man;
  group.position.set(from.x + dx * along, 0, from.z + dz * along);
  group.rotation.y = Math.atan2(dx, dz);
  // Re-pose at most 30 times a second: posing a figure is costly, and the eye can't tell at walking pace.
  if (!(now - (reader.posed ?? -1) < 1 / 30)) { man.pose({ clip: 'walk', t: elapsed, time: now, speed: 1 }); reader.posed = now; }
  if (along < 1) return true;

  if (inbound) {
    reader.phase = 'sit';
    group.position.set(reader.seat.x, lift, reader.seat.z);
    group.rotation.y = reader.seat.rotationY;
    holdCopy(man, reader.copy, true);
    man.pose({ clip: 'read', t: 1, time: 0 });
    return false;
  }
  // Out of the room: the figure, and the book it carries, are put away for the next reader.
  scene.remove(group);
  reader.slot.inUse = false;
  readers.delete(reader.key);
  return false;
}

/** Walks the readers who are on their way in or out. Returns whether any still are. */
function animateReaders(now) {
  let moving = false;
  for (const reader of [...readers.values()]) {
    if (reader.phase === 'in' || reader.phase === 'out') moving = walkReader(reader, now) || moving;
  }
  return moving;
}

function arriveReader() {
  const free = READER_SEATS.filter((seat) => !readers.has(seat.key));
  if (free.length && titles.length && figures.some((f) => !f.inUse)) createReader(choose(free), choose(titles));
  wake();
}

function departReader() {
  const seated = [...readers.values()].filter((reader) => reader.phase === 'sit');
  if (!seated.length) return;
  const reader = choose(seated);
  reader.phase = 'out';
  reader.t0 = performance.now() / 1000;
  holdCopy(reader.slot.man, reader.copy, false);
  reader.slot.man.pose({ clip: 'walk', t: 0, time: reader.t0, speed: 1 });
  reader.slot.man.group.position.set(reader.seat.x, 0, reader.seat.z);
  wake();
}

// Readers come and go: every so often one walks in or walks out, between one and four at a time.
function turnOver() {
  turnOverTimer = null;
  if (!peopleOn) return;
  const count = readers.size;
  if (count <= MIN_READERS) arriveReader();
  else if (count >= MAX_READERS) departReader();
  else if (Math.random() < 0.5) arriveReader();
  else departReader();
  turnOverTimer = setTimeout(turnOver, 15000 + Math.random() * 30000);
}

// People are off by default: they are the heaviest part of the scene. A toggle switches them on.
let peopleOn = false;
let turnOverTimer = null;
async function setPeople(on) {
  peopleOn = on && titles.length > 0;
  peopleToggle.checked = peopleOn;
  if (peopleOn) {
    if (figures.length < 4) {
      say('Bringing in the readers…');
      await buildFigures();
      say(reading ? '' : snapshotNotice);
      if (!peopleOn) return;
    }
    if (!readers.size) { arriveReader(); arriveReader(); }
    if (!turnOverTimer) turnOverTimer = setTimeout(turnOver, 15000 + Math.random() * 30000);
  } else {
    clearTimeout(turnOverTimer);
    turnOverTimer = null;
    for (const reader of [...readers.values()]) {
      scene.remove(reader.slot.man.group);
      reader.slot.inUse = false;
      readers.delete(reader.key);
    }
  }
  peopleToggle.checked = peopleOn;
  wake();
}
const peopleToggle = document.getElementById('people-toggle');
peopleToggle.addEventListener('change', () => setPeople(peopleToggle.checked));

// ———————————————————————————————————————————— taking a book down and putting it back

// What the camera looks at: eased toward `focus` plus whatever the viewer has panned.
const focus = SHELF_TARGET.clone();
const panned = new GFX.Vector3();
function focusOn(point) { focus.copy(point); panned.set(0, 0, 0); }

let reading = null;       // the record of the book on the table, if any
const moving = new Set(); // books that are opening or closing

// The open book travels with you: it stays at the point you look at as you move.
function holdBook(book) {
  // Where you are looking, pulled back toward you if a shelf, wall or table is in the way.
  book.group.position.copy(clearSpot(GOAL));
}

function takeDown(record) {
  const { book } = record; // the full book, built from its article (see select)
  record.shelfBook.group.visible = false; // its shelf copy stays on the shelf, out of sight, until it goes back
  byGroup.set(book.group, record);
  scene.add(book.group);
  // Upright with its pages toward you, whichever way you are facing.
  book.group.quaternion.setFromAxisAngle(AXIS_Y, stage.view.aim.yaw).multiply(READ_UPRIGHT);
  book.group.scale.setScalar(1);
  reading = record;
  moving.add(record);
  // Open it right where you stand: straight ahead, at your current viewing distance. If a shelf
  // or wall is nearer than that, it stops short of it instead of opening inside it.
  const spot = openingSpot().clone();
  focusOn(spot);
  stage.target.copy(spot);
  stage.view.zoomBy(camera.position.distanceTo(spot) / LENS_DISTANCE / stage.view.aim.zoom);
  book.group.position.copy(spot);
}

const LENS_DISTANCE = 7.5; // the stage's lens distance
const BOOK_CLEARANCE = 0.55; // metres kept between the open book and anything behind it: half its open width, and some
const AHEAD = new GFX.Vector3();
const blocker = new GFX.Raycaster();
function openingSpot() { return clearSpot(stage.target); }

/** The point toward `goal` from your eyes, stopped BOOK_CLEARANCE short of anything in the way. */
function clearSpot(goal) {
  camera.updateMatrixWorld();
  AHEAD.copy(goal).sub(camera.position);
  let distance = AHEAD.length();
  AHEAD.normalize();
  blocker.set(camera.position, AHEAD);
  blocker.far = distance + BOOK_CLEARANCE;
  const hit = blocker.intersectObjects(obstacles(), false).find((h) => h.distance > 0.05);
  if (hit && hit.distance - BOOK_CLEARANCE < distance) distance = Math.max(0.5, hit.distance - BOOK_CLEARANCE);
  return SPOT.copy(camera.position).addScaledVector(AHEAD, distance);
}
const SPOT = new GFX.Vector3();
// What the open book must stay clear of: the room's fixed meshes (walls, shelves, furniture), not the books
// on the shelves or the people. Gathered once; the room does not change.
let fixedMeshes = null;
function obstacles() {
  if (!fixedMeshes) {
    fixedMeshes = [];
    const skip = (node) => { for (let n = node; n; n = n.parent) if (byGroup.has(n) || n.name?.endsWith(' reader')) return true; return false; };
    scene.traverse((node) => { if (node.isMesh && node.visible && !skip(node)) fixedMeshes.push(node); });
  }
  return fixedMeshes;
}
function putBack(record) {
  const { book, shelfBook } = record;
  // The full book is let go of; the shelf copy takes its place again.
  scene.remove(book.group);
  byGroup.delete(book.group);
  if (book !== shelfBook) disposeBook(book.group);
  record.book = shelfBook;
  shelfBook.group.visible = true;
  moving.delete(record);
  if (reading === record) reading = null;
  // You stay where you are: the look point stays where you have walked to, not back at the shelves.
  focus.add(panned);
  panned.set(0, 0, 0);
  say(snapshotNotice);
}

/** Frees a book's geometry, materials and textures once it is no longer wanted. */
function disposeBook(group) {
  group.traverse((node) => {
    node.geometry?.dispose?.();
    for (const material of [].concat(node.material ?? [])) {
      for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap']) material[key]?.dispose?.();
      material.dispose?.();
    }
  });
}

let opening = 0; // which open was asked for last: a slower fetch for an earlier click is dropped

/** Opens a book: its article is fetched now, laid out into pages, and made into a full book in your hands. */
async function select(key) {
  const record = books.get(key);
  if (!record || reading === record) return;
  if (reading) putBack(reading);
  const ticket = ++opening;
  say('Opening…');
  let article;
  try {
    article = await loadArticle(record.source.id, record.entry);
  } catch (error) {
    if (ticket === opening) say(`Could not open ${record.title}: ${error.message}`);
    return;
  }
  if (ticket !== opening || reading) return;
  const pages = flowPages(article.text, { print: record.source.print }).slice(0, MAX_PAGES);
  record.book = createBook(GFX, { ...record.bookOptions, pageCount: pageCountForBook(pages.length), pages, size: BOOK_SCALE });
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

// Picking has to be quick: it runs on every click. Ray-testing the whole scene meant every page of every
// shelf book (thousands of meshes), which blocked the page for hundreds of milliseconds. Instead, the open
// book is tested exactly (its pages need the point that was hit), and shelf books by their boxes, which do
// not move while they are shelved; a shelf, wall or table in front of a book still hides it.
const shelfBoxes = new Map(); // record -> its shelved book's own box, and how to turn a world ray into its frame
function shelfBox(record) {
  let entry = shelfBoxes.get(record);
  if (!entry) {
    const { group, dimensions } = record.shelfBook;
    group.updateMatrixWorld(true);
    const { min, max } = dimensions.closed;
    entry = {
      // Fitted to the shut book and turned with it, trimmed a little through its thickness and at the spine (it is
      // rounded, half the book's thickness across): neighbours stand close, so an untrimmed box takes the next one's edge.
      box: new GFX.Box3(
        new GFX.Vector3(min[0], min[1] + (max[1] - min[1]) * BOX_TRIM, min[2]),
        new GFX.Vector3(max[0] - (max[1] - min[1]) / 2, max[1] - (max[1] - min[1]) * BOX_TRIM, max[2]),
      ),
      toLocal: group.matrixWorld.clone().invert(),
      toWorld: group.matrixWorld.clone(),
    };
    shelfBoxes.set(record, entry);
  }
  return entry;
}
const BOX_TRIM = 0; // the exact cover test below settles which of neighbouring books was hit
const CANDIDATE_REACH = 0.08; // metres past the nearest box that a book is still tested exactly
const LOCAL_RAY = new GFX.Ray();
const BOX_HIT = new GFX.Vector3();
const AHEAD_POINT = new GFX.Vector3();

/** Where a world ray first meets a shelved book (in the world), or null. */
function hitShelfBook(record, ray) {
  const { box, toLocal, toWorld } = shelfBox(record);
  LOCAL_RAY.origin.copy(ray.origin).applyMatrix4(toLocal);
  AHEAD_POINT.copy(ray.origin).add(ray.direction).applyMatrix4(toLocal);
  LOCAL_RAY.direction.copy(AHEAD_POINT).sub(LOCAL_RAY.origin).normalize();
  if (!LOCAL_RAY.intersectBox(box, BOX_HIT)) return null;
  return BOX_HIT.applyMatrix4(toWorld);
}

/** The book (and the hit) under a pointer event, or null. */
function pick(e) {
  const rect = canvas.getBoundingClientRect();
  NDC.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(NDC, camera);
  const ray = raycaster.ray;
  if (reading) {
    const hit = raycaster.intersectObject(reading.book.group, true)[0];
    if (hit) return { record: reading, hit };
  }
  // The boxes narrow it to the few books nearest along the ray; their covers are then tested exactly.
  const near = [];
  for (const record of books.values()) {
    if (record === reading) continue;
    const point = hitShelfBook(record, ray);
    if (point) near.push({ record, hit: { point: point.clone(), distance: point.distanceTo(ray.origin) } });
  }
  if (!near.length) return null;
  near.sort((p, q) => p.hit.distance - q.hit.distance);
  const closest = near.filter((c) => c.hit.distance < near[0].hit.distance + CANDIDATE_REACH);
  let best = null;
  for (const candidate of closest) {
    const cover = candidate.record.shelfBook.group.getObjectByName('book_cover');
    const exact = cover && raycaster.intersectObject(cover, false)[0];
    if (exact && (!best || exact.distance < best.hit.distance)) best = { record: candidate.record, hit: exact };
  }
  best ??= near[0];
  const nearest = best.hit.distance;
  // Hidden behind a shelf, wall or table: not that book.
  const blocker = raycaster.intersectObjects(obstacles(), false)[0];
  if (blocker && blocker.distance < nearest - 0.05) return null;
  return best;
}


const AXIS_X = new GFX.Vector3(1, 0, 0);
const SPIN = new GFX.Quaternion();
const RIGHT = new GFX.Vector3();
const UP = new GFX.Vector3();
// You can walk anywhere inside the walls, right up to the shelves on every side (and into the corners).
const WALK_EDGE = ROOM_HALF - 0.3;
function keepInRoom() {
  panned.x = Math.min(WALK_EDGE, Math.max(-WALK_EDGE, focus.x + panned.x)) - focus.x;
  panned.z = Math.min(WALK_EDGE, Math.max(-WALK_EDGE, focus.z + panned.z)) - focus.z;
}
const ORBIT_SPEED = 0.006;

/** Slide the view sideways and up the screen by pixels, in proportion to how far the camera stands from what it looks at. */
function pan(dx, dy) {
  camera.updateMatrixWorld();
  RIGHT.setFromMatrixColumn(camera.matrixWorld, 0);
  UP.setFromMatrixColumn(camera.matrixWorld, 1);
  const perPixel = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.distanceTo(stage.target)) / canvas.clientHeight;
  panned.addScaledVector(RIGHT, -dx * perPixel).addScaledVector(UP, dy * perPixel);
  keepInRoom();
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
    // Tip it about the screen's horizontal, so dragging works the same whichever way you face.
    camera.updateMatrixWorld();
    RIGHT.setFromMatrixColumn(camera.matrixWorld, 0);
    RIGHT.y = 0;
    RIGHT.normalize();
    SPIN.setFromAxisAngle(RIGHT, dy * 0.01);
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

// Keyboard: W/A/S/D or the arrow keys slide the view across the room. While a book is open the arrows turn its pages instead.
const heldKeys = new Set();
let fast = false; // Shift held: move three times as fast
const FAST_MOVE = 3;
const MOVE = { w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
/** How far the keys ask to go, right and up on the screen: [right, up], each -1 to 1. */
function keyMove() {
  let right = 0, up = 0;
  for (const key of heldKeys) {
    if (reading && key.startsWith('Arrow')) continue;
    right += MOVE[key][0];
    up += MOVE[key][1];
  }
  return [right, up];
}
globalThis.addEventListener('keydown', (e) => {
  const key = keyName(e);
  fast = e.shiftKey;
  if (MOVE[key] && !(reading && key.startsWith('Arrow'))) heldKeys.add(key);
  if (e.key === 'r' || e.key === 'R' || e.key === 'Home') { resetView(); return; }
  if (!reading) return;
  if (e.key === 'ArrowRight') { reading.book.next(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { reading.book.prev(); e.preventDefault(); }
  else if (e.key === 'Escape') { putBack(reading); }
});
globalThis.addEventListener('keyup', (e) => { heldKeys.delete(keyName(e)); fast = e.shiftKey; });
globalThis.addEventListener('blur', () => { heldKeys.clear(); fast = false; });

// ———————————————————————————————————————————— the frame loop

// The picture is drawn only when something has changed: a book or the camera is moving, or the viewer has
// touched the page, or the page has been resized or has new text. A still room costs nothing to leave alone.
let dirty = true;
function wake() { dirty = true; }
// Moving the pointer with no button held changes nothing on screen, so it doesn't redraw; a drag does.
for (const type of ['pointerdown', 'pointerup', 'wheel', 'keydown', 'dblclick']) globalThis.addEventListener(type, wake, { passive: true });
globalThis.addEventListener('pointermove', (e) => { if (e.buttons) wake(); }, { passive: true });
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
  // Held movement keys slide the view across the room, relative to the screen, at a pace that grows with the zoom.
  const [right, up] = keyMove();
  if (right || up) {
    const axes = groundAxes(stage.view.yaw);
    const step = 2.0 * stage.view.zoom * dt * (fast ? FAST_MOVE : 1);
    panned.x += (axes.right[0] * right + axes.up[0] * up) * step;
    panned.z += (axes.right[1] * right + axes.up[1] * up) * step;
    keepInRoom();
    dirty = true;
  }
  GOAL.copy(focus).add(panned);
  const view = stage.view;
  const eased = Math.abs(view.yaw - view.aim.yaw) > 1e-6 || Math.abs(view.pitch - view.aim.pitch) > 1e-6 || Math.abs(view.zoom - view.aim.zoom) > 1e-6;
  if (eased || stage.target.distanceToSquared(GOAL) > 1e-10) dirty = true;
  stage.target.lerp(GOAL, 1 - Math.exp(-10 * dt));
  view.step(dt);
  if (animateReaders(now / 1000)) dirty = true;
  if (!dirty) return;
  dirty = false;
  stage.look();   // place the camera on the target, from the view
  if (reading) holdBook(reading.book); // the open book travels with you
  stage.render();
  if (!shown) { shown = true; loading.classList.add('done'); setTimeout(() => loading.remove(), 800); }
});

// People stay off until the toggle switches them on (see setPeople).
