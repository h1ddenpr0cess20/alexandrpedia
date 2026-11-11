// Imports the curated AI and wall collections from Grokipedia into committed local snapshots.
// The browser continues to read only data/grokipedia/*.json; this script is the explicit import step.
// It is resumable, skips existing files, waits between requests, and writes each article atomically.
// Run: npm run snapshot-grokipedia
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { GROKIPEDIA, slugOf } from '../src/sources.js';
import { fetchWithRetry, HttpError } from '../src/fetch.js';
import { grokipediaBody, htmlToText } from '../src/text.js';
import { allCatalogEntries } from '../src/sections.js';

const GAP_MS = 2500;
const USER_AGENT = 'alexandrpedia-snapshot/1.0';
const dir = new URL('../data/grokipedia/', import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => new Date().toISOString().slice(11, 19);
const exists = (file) => stat(file).then(() => true, () => false);
const entries = allCatalogEntries(CATALOG);
let lastStart = 0;

async function turn() {
  const wait = lastStart + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
}

async function obtain(title) {
  const url = GROKIPEDIA.pageUrl(title);
  const response = await fetchWithRetry(url, {
    retries: 5,
    baseDelay: 2500,
    init: { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' } },
  });
  if (response.status === 404) return { missing: true };
  if (!response.ok) throw new HttpError(url, response.status);

  const html = await response.text();
  const body = grokipediaBody(html);
  if (!body) throw new Error('The page did not contain an article body.');
  const text = htmlToText(body);
  if (!text.trim()) throw new Error('The article body was empty after text extraction.');

  return {
    article: {
      source: 'grokipedia',
      title,
      url,
      text,
      license: GROKIPEDIA.license,
    },
  };
}

await mkdir(dir, { recursive: true });
const saved = [];
const kept = [];
const missing = [];
const failed = [];

for (const [i, entry] of entries.entries()) {
  const title = entry.titles?.grokipedia ?? entry.title;
  const name = `${encodeURIComponent(slugOf(title))}.json`;
  const file = new URL(name, dir);
  const label = `[${i + 1}/${entries.length}] ${entry.title}`;
  if (await exists(file)) {
    kept.push(entry.title);
    continue;
  }

  try {
    await turn();
    const result = await obtain(title);
    if (result.missing) {
      missing.push(entry.title);
      console.log(`${clock()} MISSING ${label}`);
      continue;
    }

    const json = `${JSON.stringify({ ...result.article, fetchedAt: new Date().toISOString() }, null, 1)}\n`;
    const tmp = new URL(`${name}.tmp`, dir);
    await writeFile(tmp, json);
    await rename(tmp, file);
    saved.push(entry.title);
    const words = result.article.text.split(/\s+/).filter(Boolean).length;
    console.log(`${clock()} ok   ${label} (${words} words, ${Buffer.byteLength(json)} bytes)`);
  } catch (error) {
    failed.push(`${entry.title} (${error.message})`);
    console.log(`${clock()} FAIL ${label}: ${error.message}`);
  }
}

const list = (label, items) => items.length ? `\n${label} (${items.length}): ${items.join('; ')}` : '';
console.log(`\nDone: saved ${saved.length}, already saved ${kept.length}, missing ${missing.length}, failed ${failed.length}.`);
console.log(list('Missing on Grokipedia', missing) + list('Failed', failed));
if (failed.length || missing.length) process.exitCode = 1;
