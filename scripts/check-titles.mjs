// Fetches every catalog title from both sources and reports the ones that do not resolve.
// Needs network access to en.wikipedia.org and grokipedia.com. Run: npm run check-titles
import { CATALOG } from '../src/catalog.js';
import { SOURCES } from '../src/sources.js';

const problems = [];
for (const entry of CATALOG) {
  for (const source of SOURCES) {
    try {
      const article = await source.fetch(entry.title, { baseDelay: 2000, retries: 5 });
      const words = article.text.split(/\s+/).filter(Boolean).length;
      console.log(`ok   ${source.id.padEnd(12)} ${entry.title} -> "${article.title}" (${words} words)`);
      if (words < 150) problems.push(`${source.id}: "${entry.title}" is short (${words} words)`);
    } catch (err) {
      console.log(`FAIL ${source.id.padEnd(12)} ${entry.title}: ${err.message}`);
      problems.push(`${source.id}: "${entry.title}": ${err.message}`);
    }
  }
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nAll titles resolve on both sources.');
}
