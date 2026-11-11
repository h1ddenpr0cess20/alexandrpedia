import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/catalog.js';
import { allCatalogEntries, catalogsForSections, SECTION_NAMES } from '../src/sections.js';

test('the reading room has a central AI collection and three named wall collections', () => {
  assert.deepEqual(Object.keys(SECTION_NAMES), ['ai', 'history', 'entertainment', 'philosophy']);
  const sections = catalogsForSections(CATALOG);
  assert.deepEqual(Object.keys(sections), ['ai', 'history', 'entertainment', 'philosophy']);
  assert.deepEqual(sections.ai, CATALOG);
  assert.equal(SECTION_NAMES.history, 'History & Science');
  assert.equal(SECTION_NAMES.entertainment, 'American Popular Culture');
  assert.equal(SECTION_NAMES.philosophy, 'Philosophy, Literature & the Arts');
});

test('every curated collection has nonempty article titles and stable shelf groupings', () => {
  const sections = catalogsForSections(CATALOG);
  for (const [sectionId, entries] of Object.entries(sections)) {
    assert.ok(entries.length > 0, `${sectionId} collection is empty`);
    for (const entry of entries) {
      assert.equal(typeof entry.title, 'string');
      assert.ok(entry.title.trim(), `${sectionId} contains an empty title`);
      if (sectionId !== 'ai') {
        assert.equal(entry.sectionId, sectionId);
        assert.equal(entry.kind, 'topic');
        assert.ok(entry.shelf, `${entry.title} has no shelf grouping`);
      }
    }
  }
});

test('science, nature and geography share the History & Science wall', () => {
  const science = catalogsForSections(CATALOG).history.map((entry) => entry.title);
  for (const title of ['Geography', 'Physical geography', 'Mountain', 'Forest', 'Rainforest', 'Coral reef', 'Biodiversity', 'Animal', 'Evolution', 'Climate change']) {
    assert.ok(science.includes(title), `Science is missing ${title}`);
  }
  assert.equal('nature' in SECTION_NAMES, false);
});

test('American popular culture spans the early twentieth century through the present', () => {
  const entertainment = catalogsForSections(CATALOG).entertainment;
  const shelves = [...new Set(entertainment.map((entry) => entry.shelf))];
  assert.ok(shelves.some((shelf) => shelf.startsWith('1900–1929')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('1930–1949')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('1950–1969')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('1970–1989')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('1990–2009')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('2010–present')));
  assert.ok(shelves.some((shelf) => shelf.startsWith('Across the decades')));
  assert.ok(entertainment.some((entry) => entry.title === 'Vaudeville'));
  assert.ok(entertainment.some((entry) => entry.title === 'TikTok'));
});

test('the import manifest deduplicates article titles across the AI and wall collections', () => {
  const entries = allCatalogEntries(CATALOG);
  const normalized = entries.map((entry) => entry.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  assert.equal(new Set(normalized).size, entries.length);
  assert.ok(entries.length > CATALOG.length + 100);
  assert.throws(() => catalogsForSections(null), /AI catalog must be an array/);
});

test('the Philosophy wall also holds literature and the arts', () => {
  const titles = catalogsForSections(CATALOG).philosophy.map((entry) => entry.title);
  for (const title of ['Ethics', 'William Shakespeare', 'Moby-Dick', 'Painting', 'Ludwig van Beethoven']) {
    assert.ok(titles.includes(title), `Philosophy is missing ${title}`);
  }
});

test('History & Science includes lesser-known history', () => {
  const titles = catalogsForSections(CATALOG).history.map((entry) => entry.title);
  for (const title of ['Hanseatic League', 'Great Zimbabwe', 'Antikythera mechanism', 'Tunguska event']) {
    assert.ok(titles.includes(title), `History & Science is missing ${title}`);
  }
});
