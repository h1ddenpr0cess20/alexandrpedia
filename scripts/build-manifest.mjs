// Writes data/manifest.json: for every catalog title that has a committed snapshot, the article's title,
// per encyclopedia. The browser builds the shelves from these titles alone and fetches an article only
// when its book is opened. Run after taking snapshots: npm run build-manifest
import { readFile, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { catalogsForSections } from '../src/sections.js';
import { SOURCES, slugOf } from '../src/sources.js';

const root = new URL('../', import.meta.url);
const manifest = {};
let found = 0, missing = 0;
for (const source of SOURCES) {
  const books = {};
  for (const catalog of Object.values(catalogsForSections(CATALOG))) {
    for (const entry of catalog) {
      if (books[entry.title]) continue;
      const title = entry.titles?.[source.id] ?? entry.title;
      try {
        const article = JSON.parse(await readFile(new URL(`data/${source.id}/${slugOf(title)}.json`, root), 'utf8'));
        if (!article.text?.trim()) throw new Error('empty');
        books[entry.title] = article.title;
        found++;
      } catch {
        missing++;
      }
    }
  }
  manifest[source.id] = books;
}
await writeFile(new URL('data/manifest.json', root), `${JSON.stringify(manifest)}\n`);
console.log(`data/manifest.json: ${found} books, ${missing} catalog titles without a snapshot.`);
