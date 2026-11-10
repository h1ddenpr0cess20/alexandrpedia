import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUG_DEFAULTS, assetViewer, createPersianRug } from '../src/rug.js';

class Group {
  constructor() { this.children = []; this.userData = {}; this.name = ''; }
  add(object) { this.children.push(object); object.parent = this; }
}
class Geometry {
  constructor(...args) { this.parameters = args; }
  setIndex(indices) { this.index = indices; }
  setAttribute(name, attribute) { this.attributes ??= {}; this.attributes[name] = attribute; }
  computeVertexNormals() { this.normalsComputed = true; }
}
class Attribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material;
    this.position = { set: (...values) => { this.position.values = values; } };
    this.rotation = { x: 0 }; this.name = ''; this.castShadow = false; this.receiveShadow = false;
  }
}
class Material { constructor(options) { Object.assign(this, options); } }
const GFX = {
  Group, Mesh, MeshStandardMaterial: Material, BoxGeometry: Geometry, PlaneGeometry: Geometry,
  BufferGeometry: Geometry, Float32BufferAttribute: Attribute, DoubleSide: 2,
};

test('the rug exposes reusable dimensions and engine asset metadata', () => {
  assert.deepEqual(RUG_DEFAULTS, { width: 3.8, depth: 3.15, thickness: 0.018, fringeLength: 0.075 });
  assert.equal(assetViewer.id, 'persian-rug');
  assert.equal(assetViewer.category, 'Props');
});

test('the rug is a grouped asset with pile, foundation, bound edges and fringe', () => {
  const rug = createPersianRug(GFX);
  assert.equal(rug.group.name, 'ornate Persian rug');
  assert.equal(rug.group.children.length, 7);
  assert.deepEqual(rug.dimensions, RUG_DEFAULTS);
  assert.equal(rug.group.userData.materials.pile, rug.pile);
  assert.equal(rug.pile.bumpMap, null, 'the rug avoids unstable micro-bump detail');
  assert.equal(rug.group.children[0].receiveShadow, false, 'the hidden foundation is not a second shadow receiver');
  assert.equal(rug.group.children.at(-1).name, 'hand-knotted ivory fringe');
  assert.equal(rug.group.children.at(-1).geometry.normalsComputed, true);
  assert.equal(rug.group.children.at(1).name, 'woven Persian pile');
});

test('the exposed asset viewer builder creates a configurable rug', () => {
  const rug = assetViewer.build({ GFX, width: 2.6, depth: 2.1 });
  assert.deepEqual(rug.dimensions, { ...RUG_DEFAULTS, width: 2.6, depth: 2.1 });
});

test('invalid dimensions are rejected before geometry is allocated', () => {
  assert.throws(() => createPersianRug(GFX, { width: 0.5 }), /width must be between/);
  assert.throws(() => createPersianRug(GFX, { depth: 9 }), /depth must be between/);
  assert.throws(() => createPersianRug(GFX, { thickness: 0 }), /thickness must be between/);
  assert.throws(() => createPersianRug(GFX, { fringeLength: 0.5 }), /fringeLength must be between/);
});