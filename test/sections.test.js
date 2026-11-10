import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/catalog.js';
import { allCatalogEntries, catalogsForSections, SECTION_NAMES } from '../src/sections.js';

test('the reading room has a central AI collection and four named wall collections', () => {
  assert.deepEqual(Object.keys(SECTION_NAMES), ['ai', 'history', 'science', 'entertainment', 'philosophy']);
  const sections = catalogsForSections(CATALOG);
  assert.deepEqual(Object.keys(sections), ['ai', 'history', 'science', 'entertainment', 'philosophy']);
  assert.deepEqual(sections.ai, CATALOG);
  assert.equal(SECTION_NAMES.science, 'Science, Nature & Geography');
  assert.equal(SECTION_NAMES.entertainment, 'American Popular Culture');
  assert.equal(SECTION_NAMES.philosophy, 'Philosophy & Ideas');
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

test('nature and geography are part of Science, not a separate room section', () => {
  const science = catalogsForSections(CATALOG).science.map((entry) => entry.title);
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
