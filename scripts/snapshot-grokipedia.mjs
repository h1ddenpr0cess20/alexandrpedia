// Saves every catalog article from Grokipedia as data/grokipedia/<Slug>.json, for the browser to read from our own origin
// (Grokipedia sends no CORS headers, so a page cannot fetch it directly). Needs network access to grokipedia.com.
// Run: npm run snapshot-grokipedia
import { mkdir, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { GROKIPEDIA, slugOf } from '../src/sources.js';

const dir = new URL('../data/grokipedia/', import.meta.url);
await mkdir(dir, { recursive: true });
let failed = 0;
for (const entry of CATALOG) {
  try {
    const article = await GROKIPEDIA.fetch(entry.title, { baseDelay: 2000, retries: 5 });
    await writeFile(new URL(`${encodeURIComponent(slugOf(entry.title))}.json`, dir), `${JSON.stringify({ ...article, fetchedAt: new Date().toISOString() }, null, 1)}\n`);
    console.log(`ok   ${entry.title} (${article.text.length} characters)`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${entry.title}: ${err.message}`);
  }
}
if (failed) process.exitCode = 1;
