// Checks that every curated title has a readable committed snapshot for both encyclopedias.
// This is intentionally offline: the browser and this checker never call encyclopedia APIs.
// Import missing snapshots with npm run snapshot-wikipedia and npm run snapshot-grokipedia.
import { readFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { SOURCES, slugOf } from '../src/sources.js';
import { allCatalogEntries } from '../src/sections.js';

const entries = allCatalogEntries(CATALOG);
const problems = [];
const counts = Object.fromEntries(SOURCES.map((source) => [source.id, { present: 0, missing: 0, invalid: 0 }]));

for (const entry of entries) {
  for (const source of SOURCES) {
    const title = entry.titles?.[source.id] ?? entry.title;
    const url = new URL(`../data/${source.id}/${encodeURIComponent(slugOf(title))}.json`, import.meta.url);
    try {
      const article = JSON.parse(await readFile(url, 'utf8'));
      if (!article || typeof article.text !== 'string' || !article.text.trim()) {
        throw new Error('snapshot has no readable article text');
      }
      counts[source.id].present++;
      console.log(`ok   ${source.id.padEnd(12)} ${entry.title} (${article.text.split(/\\s+/).filter(Boolean).length} words)`);
    } catch (error) {
      const missing = error.code === 'ENOENT';
      counts[source.id][missing ? 'missing' : 'invalid']++;
      problems.push(`${source.id}: "${entry.title}" ${missing ? 'has no local snapshot' : `is invalid (${error.message})`}`);
    }
  }
}

console.log(`\\nChecked ${entries.length} unique titles against ${SOURCES.length} encyclopedias.`);
for (const [source, count] of Object.entries(counts)) {
  console.log(`${source}: ${count.present} present, ${count.missing} missing, ${count.invalid} invalid`);
}
if (problems.length) {
  console.log(`\\n${problems.length} snapshot problem(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Every curated title has a readable snapshot from both sources.');
}
