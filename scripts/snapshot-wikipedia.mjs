// Saves every catalog article from Wikipedia as data/wikipedia/<Slug>.json, in the same form as the Grokipedia
// snapshots, so the books can be read from our own origin. Successful requests are spaced 2.5 seconds apart.
// Only actual rate-limit responses trigger a longer adaptive cooldown. Articles already saved are skipped,
// so a run can be started again later. Needs network access to en.wikipedia.org; behind a proxy, set
// NODE_USE_ENV_PROXY=1 (Node 22.21 or later). Run: npm run snapshot-wikipedia
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { allCatalogEntries } from '../src/sections.js';
import { slugOf } from '../src/sources.js';
import { wikipediaExtractToText } from '../src/text.js';
import { parseRetryAfter, retryDelayMs } from '../src/snapshot-pacing.js';

const GAP_MS = 2_500;             // normal pace: one request every 2.5 seconds
const BACKOFF_BASE_MS = 15_000;   // starts at 15 seconds only after a 429/503 response
const BACKOFF_MAX_MS = 3 * 60_000; // capped exponential backoff after repeated rate limits
const MAX_RATE_LIMITS = 5;       // consecutive rate limits before stopping for manual review
const MAX_TRIES = 3;            // tries for one article after other failures (network errors, server errors)
const LICENSE = 'CC BY-SA 4.0';
const USER_AGENT = 'alexandrpedia snapshot importer/1.0 (+https://github.com/h1ddenpr0cess20/alexandrpedia)';
const dir = new URL('../data/wikipedia/', import.meta.url);
const entries = allCatalogEntries(CATALOG);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => new Date().toISOString().slice(11, 19);
const exists = (file) => stat(file).then(() => true, () => false);

/** One request for one article. Gives { kind: 'ok', article } | { kind: 'missing' } | { kind: 'limited', ... } | { kind: 'failed', message }. */
async function askWikipedia(title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts|info',
    explaintext: '1',
    exlimit: '1',
    redirects: '1',
    inprop: 'url',
    format: 'json',
    formatversion: '2',
    titles: slugOf(title).replace(/_/g, ' '),
  });
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 429 || res.status === 503) {
      return {
        kind: 'limited',
        status: res.status,
        retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
      };
    }
    if (!res.ok) return { kind: 'failed', message: `HTTP ${res.status}` };
    const page = (await res.json())?.query?.pages?.[0];
    if (!page || page.missing || page.invalid || !page.extract) return { kind: 'missing' };
    return {
      kind: 'ok',
      article: {
        source: 'wikipedia',
        title: page.title,
        url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(slugOf(page.title))}`,
        text: wikipediaExtractToText(page.extract),
        license: LICENSE,
      },
    };
  } catch (err) {
    return { kind: 'failed', message: err.message };
  }
}

let lastStart = 0;
let limitStreak = 0;

/** Waits for the short normal gap between successful requests. */
async function turn() {
  const wait = lastStart + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
}

/** Asks for one article until there is an answer, waiting out rate limits. Gives null when the run should stop. */
async function obtain(title, label) {
  let tries = 0;
  for (;;) {
    await turn();
    const answer = await askWikipedia(title);
    if (answer.kind === 'limited') {
      limitStreak++;
      if (limitStreak >= MAX_RATE_LIMITS) return null;
      const pause = retryDelayMs({
        streak: limitStreak,
        retryAfterMs: answer.retryAfterMs,
        baseMs: BACKOFF_BASE_MS,
        maxMs: BACKOFF_MAX_MS,
      });
      console.log(`${clock()} HTTP ${answer.status} on ${label}; cooling down ${Math.ceil(pause / 1000)}s before retrying`);
      await sleep(pause);
      continue;
    }
    limitStreak = 0;
    if (answer.kind === 'failed' && ++tries < MAX_TRIES) {
      console.log(`${clock()} ${answer.message} on ${label}; trying again`);
      continue;
    }
    return answer;
  }
}

await mkdir(dir, { recursive: true });
const saved = [], kept = [], missing = [], failed = [];
let stopped = false;

for (const [i, entry] of entries.entries()) {
  const title = entry.titles?.wikipedia ?? entry.title;
  const name = `${encodeURIComponent(slugOf(title))}.json`;
  const file = new URL(name, dir);
  const label = `[${i + 1}/${entries.length}] ${entry.title}`;
  if (await exists(file)) { kept.push(entry.title); continue; }

  const answer = await obtain(title, label);
  if (!answer) {
    stopped = true;
    console.log(`${clock()} stopped: Wikipedia kept refusing requests. Run it again later; saved articles are skipped.`);
    break;
  }
  if (answer.kind === 'missing') { missing.push(entry.title); console.log(`${clock()} MISSING ${label}`); continue; }
  if (answer.kind !== 'ok') { failed.push(`${entry.title} (${answer.message})`); console.log(`${clock()} FAIL ${label}: ${answer.message}`); continue; }

  const json = `${JSON.stringify({ ...answer.article, fetchedAt: new Date().toISOString() }, null, 1)}\n`;
  const tmp = new URL(`${name}.tmp`, dir);
  await writeFile(tmp, json);
  await rename(tmp, file);
  saved.push(entry.title);
  const words = answer.article.text.split(/\s+/).filter(Boolean).length;
  console.log(`${clock()} ok   ${label} (${words} words, ${Buffer.byteLength(json)} bytes)`);
}

const list = (label, items) => (items.length ? `\n${label} (${items.length}): ${items.join('; ')}` : '');
console.log(`\nDone: saved ${saved.length}, already saved ${kept.length}, missing ${missing.length}, failed ${failed.length}${stopped ? ' (stopped early)' : ''}.`);
console.log(list('Missing or empty on Wikipedia', missing) + list('Failed', failed));
if (stopped || failed.length || missing.length) process.exitCode = 1;
