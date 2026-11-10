import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('collection sign boards use the engine wood material and UV helpers directly', () => {
  assert.match(app, /createBookcase, stockBooks, woodMaterial, woodUV/);
  assert.match(app, /woodMaterial\(GFX, 'mahogany', 'lacquered'\)/);
  assert.match(app, /woodUV\(GFX, geometry, \[position\.x, position\.y, position\.z\], 'x'\)/);
  assert.match(app, /new GFX\.Mesh\(geometry, MAHOGANY_PLAQUE_MATERIAL\)/);
});

test('sign material setup never constructs a temporary table or clones engine materials', () => {
  assert.doesNotMatch(app, /createMahoganyPlaqueMaterial/);
  assert.doesNotMatch(app, /MAHOGANY_PLAQUE_MATERIAL\.clone/);
  assert.doesNotMatch(app, /sample\.material\.clone/);
  assert.doesNotMatch(app, /createWoodTable\(GFX, \{[\s\S]{0,120}species: 'mahogany'/);
});
