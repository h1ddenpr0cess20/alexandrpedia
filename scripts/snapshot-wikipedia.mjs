// Saves every catalog article from Wikipedia as data/wikipedia/<Slug>.json, in the same form as the Grokipedia
// snapshots, so the books can be read from our own origin. Slow on purpose: one request a minute. A rate limit (429)
// waits before the same article is tried again, and three in a row stop the run. Articles already saved are skipped,
// so a run can be started again later. Needs network access to en.wikipedia.org; behind a proxy, set
// NODE_USE_ENV_PROXY=1 (Node 22.21 or later). Run: npm run snapshot-wikipedia
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { slugOf } from '../src/sources.js';
import { wikipediaExtractToText } from '../src/text.js';

const GAP_MS = 60_000;          // one request a minute: each starts at least this long after the last one started
const BACKOFF_MS = 5 * 60_000;  // after a rate limit, at least this long before the same article is tried again
const MAX_RATE_LIMITS = 3;      // rate limits in a row before the run stops
const MAX_TRIES = 3;            // tries for one article after other failures (network errors, server errors)
const LICENSE = 'CC BY-SA 4.0';
const USER_AGENT = 'snapshot-script/1.0';
const dir = new URL('../data/wikipedia/', import.meta.url);
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
      return { kind: 'limited', status: res.status, retryAfter: Number(res.headers.get('retry-after')) || 0 };
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

/** Waits until a minute has passed since the last request started. */
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
      const pause = Math.max(BACKOFF_MS, answer.retryAfter * 1000);
      console.log(`${clock()} HTTP ${answer.status} on ${label}; waiting ${pause / 60_000} min`);
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

for (const [i, entry] of CATALOG.entries()) {
  const title = entry.titles?.wikipedia ?? entry.title;
  const name = `${encodeURIComponent(slugOf(title))}.json`;
  const file = new URL(name, dir);
  const label = `[${i + 1}/${CATALOG.length}] ${entry.title}`;
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
