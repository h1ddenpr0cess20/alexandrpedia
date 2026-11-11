// Writes data/manifest.json: for every catalog title that has a committed snapshot, the article's title and
// how many printed pages its text takes (about 1,890 characters a page in the books' regular print), per
// encyclopedia. The browser builds the shelves from these titles alone and fetches an article only
// when its book is opened. Run after taking snapshots: npm run build-manifest
import { readFile, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { catalogsForSections } from '../src/sections.js';
import { SOURCES, slugOf } from '../src/sources.js';

const CHARS_PER_PAGE = 1890; // measured with the engine's flowPages on a sample of articles
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
        books[entry.title] = { title: article.title, pages: Math.ceil(article.text.length / CHARS_PER_PAGE) };
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
