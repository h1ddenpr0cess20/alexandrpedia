// Refresh existing encyclopedia snapshots without changing catalog membership.
// Examples:
//   npm run update-articles -- --all --source both --dry-run
//   npm run update-articles -- --title "Alan Turing" --source wikipedia
//   npm run update-articles -- --older-than 30d --source grokipedia
// Existing files are replaced only after a fresh, non-empty article has been parsed.
// Each write is atomic; interrupted runs leave already-refreshed files valid.
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CATALOG } from '../src/catalog.js';
import { allCatalogEntries } from '../src/sections.js';
import { GROKIPEDIA, WIKIPEDIA, slugOf } from '../src/sources.js';
import { wikipediaExtractToText, grokipediaBody, htmlToText } from '../src/text.js';
import { parseRetryAfter, retryDelayMs } from '../src/snapshot-pacing.js';
import { isSnapshotOlderThan, parseUpdateArgs, resolveUpdateEntries } from '../src/article-update.js';

const GAP_MS = 2_500;
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 3 * 60_000;
const MAX_RATE_LIMIT_STREAK = 5;
const MAX_ATTEMPTS = 5;
const LICENSE_WIKIPEDIA = 'CC BY-SA 4.0';
const USER_AGENT = 'alexandrpedia article snapshot updater/1.0 (+https://github.com/h1ddenpr0cess20/alexandrpedia)';
const SOURCES = [WIKIPEDIA, GROKIPEDIA];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => new Date().toISOString().slice(11, 19);

const HELP = [
  '',
  'Refresh existing local article snapshots.',
  '',
  'Usage:',
  '  npm run update-articles -- --all [--source both|wikipedia|grokipedia] [--dry-run]',
  '  npm run update-articles -- --title "Article title" [--title "Another title"] [--source both|wikipedia|grokipedia]',
  '  npm run update-articles -- --older-than 30d [--source both|wikipedia|grokipedia] [--dry-run]',
  '',
  'Selectors:',
  '  --all                 Refresh every existing snapshot in the curated catalog.',
  '  --title TITLE         Refresh one or more titles (repeat --title for several).',
  '  --older-than AGE      Refresh snapshots older than AGE (e.g. 12h, 7d, 30d, 2w).',
  '',
  'Options:',
  '  --source SOURCE       Select both sources (default), wikipedia, or grokipedia.',
  '  --dry-run             List snapshots that would be refreshed; make no requests or writes.',
  '  --help                Show this help.',
  '',
  'Notes:',
  '  - Missing snapshots are skipped. Use snapshot-wikipedia or snapshot-grokipedia to import missing files.',
  '  - --title can also target an existing one-off snapshot outside the curated catalog.',
  '  - Replacements happen only after a complete, non-empty article has been fetched and parsed.',
  '  - Requests are paced and retry rate limits; interrupted runs are safe to restart.',
  '',
].join('\n');

function snapshotUrl(source, title) {
  return new URL('../data/' + source.id + '/' + encodeURIComponent(slugOf(title)) + '.json', import.meta.url);
}

async function readSnapshot(url) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Cannot read snapshot ' + url.pathname + ': ' + error.message);
  }
}

function sourceTitle(entry, source) {
  return entry.titles?.[source.id] ?? entry.title;
}

function wikipediaUrl(title) {
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
  return 'https://en.wikipedia.org/w/api.php?' + params;
}

function isRateLimit(response) {
  return response.status === 429 || response.status === 503;
}

function isRetryable(response) {
  return [408, 429, 500, 502, 503, 504].includes(response.status);
}

let lastRequestStart = 0;
let limitStreak = 0;

async function paceRequest() {
  const remaining = lastRequestStart + GAP_MS - Date.now();
  if (remaining > 0) await sleep(remaining);
  lastRequestStart = Date.now();
}

async function fetchArticle(source, title, label) {
  const url = source.id === 'wikipedia' ? wikipediaUrl(title) : GROKIPEDIA.pageUrl(title);
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await paceRequest();
    let response;
    try {
      response = await fetch(url, {
        headers: source.id === 'wikipedia'
          ? { 'User-Agent': USER_AGENT }
          : { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const delay = Math.min(BACKOFF_MAX_MS, 2_500 * 2 ** (attempt - 1));
      console.log(clock() + ' network error on ' + label + ': ' + error.message + '; retrying in ' + Math.ceil(delay / 1000) + 's');
      await sleep(delay);
      continue;
    }

    if (isRateLimit(response)) {
      limitStreak++;
      if (limitStreak >= MAX_RATE_LIMIT_STREAK) {
        const error = new Error('stopped after ' + limitStreak + ' consecutive HTTP ' + response.status + ' rate-limit responses');
        error.rateLimited = true;
        throw error;
      }
      if (attempt === MAX_ATTEMPTS) throw new Error('HTTP ' + response.status + ' after ' + MAX_ATTEMPTS + ' attempts');
      const delay = retryDelayMs({
        streak: limitStreak,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
        baseMs: BACKOFF_BASE_MS,
        maxMs: BACKOFF_MAX_MS,
      });
      console.log(clock() + ' HTTP ' + response.status + ' on ' + label + '; cooling down ' + Math.ceil(delay / 1000) + 's');
      await sleep(delay);
      continue;
    }

    limitStreak = 0;
    if (response.status === 404) return { missing: true };
    if (!response.ok) {
      lastError = new Error('HTTP ' + response.status);
      if (isRetryable(response) && attempt < MAX_ATTEMPTS) {
        const delay = Math.min(BACKOFF_MAX_MS, 2_500 * 2 ** (attempt - 1));
        console.log(clock() + ' ' + lastError.message + ' on ' + label + '; retrying in ' + Math.ceil(delay / 1000) + 's');
        await sleep(delay);
        continue;
      }
      throw lastError;
    }

    if (source.id === 'wikipedia') {
      const page = (await response.json())?.query?.pages?.[0];
      if (!page || page.missing || page.invalid || !page.extract) return { missing: true };
      const text = wikipediaExtractToText(page.extract);
      if (!text.trim()) throw new Error('Wikipedia returned an empty article after text extraction.');
      return {
        article: {
          source: source.id,
          title: page.title,
          url: page.fullurl ?? WIKIPEDIA.pageUrl(page.title),
          text,
          license: LICENSE_WIKIPEDIA,
        },
      };
    }

    const body = grokipediaBody(await response.text());
    if (!body) throw new Error('Grokipedia page did not contain an article body.');
    const text = htmlToText(body);
    if (!text.trim()) throw new Error('Grokipedia returned an empty article after text extraction.');
    return {
      article: {
        source: source.id,
        title,
        url,
        text,
        license: GROKIPEDIA.license,
      },
    };
  }

  throw lastError ?? new Error('Request failed without a response.');
}

async function writeSnapshot(source, title, article) {
  const destination = snapshotUrl(source, title);
  const directory = new URL('../data/' + source.id + '/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const name = encodeURIComponent(slugOf(title)) + '.json';
  const temporary = new URL(name + '.' + randomUUID() + '.tmp', directory);
  const output = { ...article, fetchedAt: new Date().toISOString() };
  const json = JSON.stringify(output, null, 1) + '\n';

  try {
    await writeFile(temporary, json, { flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }

  return {
    bytes: Buffer.byteLength(json),
    words: article.text.split(/\s+/).filter(Boolean).length,
  };
}

async function main() {
  let options;
  try {
    options = parseUpdateArgs(process.argv.slice(2));
  } catch (error) {
    console.error('Error: ' + error.message + '\n' + HELP);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(HELP);
    return;
  }

  const catalog = allCatalogEntries(CATALOG);
  const entries = options.mode === 'title'
    ? resolveUpdateEntries(catalog, options.titles)
    : catalog;
  const sources = options.source === 'both'
    ? SOURCES
    : SOURCES.filter((source) => source.id === options.source);
  const tasks = [];
  const missing = [];

  for (const entry of entries) {
    for (const source of sources) {
      const title = sourceTitle(entry, source);
      const existing = await readSnapshot(snapshotUrl(source, title));
      if (!existing) {
        if (options.mode === 'title') missing.push(source.id + ': ' + title);
        continue;
      }
      if (options.mode === 'older-than' && !isSnapshotOlderThan(existing, options.ageMs)) continue;
      tasks.push({ entry, source, title });
    }
  }

  console.log('Selected ' + tasks.length + ' existing snapshot(s) from ' + entries.length + ' title(s) for ' + options.source + '.');
  if (missing.length) console.log('Skipped missing snapshots (use the importer to add these):\n  ' + missing.join('\n  '));
  if (!tasks.length) {
    console.log('Nothing to refresh.');
    return;
  }
  if (options.dryRun) {
    for (const task of tasks) console.log('DRY RUN  ' + task.source.id.padEnd(10) + ' ' + task.title);
    console.log('\nDry run complete: ' + tasks.length + ' snapshot(s) would be refreshed. No network requests or writes were made.');
    return;
  }

  const updated = [];
  const notFound = [];
  const failed = [];
  let stopped = false;

  for (const [index, task] of tasks.entries()) {
    const label = '[' + (index + 1) + '/' + tasks.length + '] ' + task.source.id + ' / ' + task.entry.title;
    try {
      const result = await fetchArticle(task.source, task.title, label);
      if (result.missing) {
        notFound.push(label);
        console.log(clock() + ' MISSING ' + label + '; kept the previous snapshot');
        continue;
      }
      const details = await writeSnapshot(task.source, task.title, result.article);
      updated.push(label);
      console.log(clock() + ' UPDATED ' + label + ' (' + details.words + ' words, ' + details.bytes + ' bytes)');
    } catch (error) {
      failed.push(label + ': ' + error.message);
      console.error(clock() + ' FAIL ' + label + ': ' + error.message);
      if (error.rateLimited) {
        stopped = true;
        console.error('Stopping this run. Snapshots already refreshed are intact; run again later.');
        break;
      }
    }
  }

  console.log('\nFinished: updated ' + updated.length + ', not found ' + notFound.length + ', failed ' + failed.length + (stopped ? ', stopped early' : '') + '.');
  if (notFound.length) console.log('\nNot found:\n  ' + notFound.join('\n  '));
  if (failed.length) console.log('\nFailed:\n  ' + failed.join('\n  '));
  if (failed.length || notFound.length) process.exitCode = 1;
}

await main();
