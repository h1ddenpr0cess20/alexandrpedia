import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, KINDS, keyOf } from '../src/catalog.js';
import { FALLBACKS, fallbackFor } from '../src/fallbacks.js';
import { BOOK_END_PAGES, MAX_PAGES, MIN_PAGES, blocksOf, clearCache, loadArticle, loadOrFallback, pageCountFor, pageCountForBook } from '../src/library.js';
import { GROKIPEDIA, WIKIPEDIA, SOURCES } from '../src/sources.js';

test('the catalog has topics, people and companies, with no repeated titles or keys', () => {
  const titles = CATALOG.map((e) => e.title.toLowerCase());
  const keys = CATALOG.map(keyOf);
  assert.equal(new Set(titles).size, CATALOG.length);
  assert.equal(new Set(keys).size, CATALOG.length);
  for (const kind of Object.keys(KINDS)) assert.ok(CATALOG.some((e) => e.kind === kind), `no ${kind}`);
});

test('both sources sit on the same shelves, in the same order', () => {
  assert.deepEqual(SOURCES.map((s) => s.id), ['wikipedia', 'grokipedia']);
  assert.equal(SOURCES.length, 2);
  assert.equal(WIKIPEDIA.print, true, 'Wikipedia keeps its standard printed pages');
  assert.equal(GROKIPEDIA.print, true, 'Grokipedia books are printed in the regular font, as Wikipedia\'s are');
});

test('page metadata follows content length without arbitrary extra pages', () => {
  assert.equal(pageCountFor(''), MIN_PAGES);
  const short = pageCountFor('Brief article.');
  const medium = pageCountFor('word '.repeat(2000));
  const long = pageCountFor('word '.repeat(12000));
  assert.ok(medium > short);
  assert.ok(long > medium);
  assert.equal(medium % 2, 0);
  assert.equal(pageCountFor('x'.repeat(10_000_000)), MAX_PAGES);
});

test('each book reserves four blank pages after its measured article', () => {
  assert.equal(BOOK_END_PAGES, 4);
  assert.equal(pageCountForBook(0), 6);
  assert.equal(pageCountForBook(1), 6);
  assert.equal(pageCountForBook(8), 12);
  assert.equal(pageCountForBook(314), 318);
  assert.equal(pageCountForBook(317), MAX_PAGES);
  assert.equal(pageCountForBook(319), MAX_PAGES);
});

test('a text becomes blocks: headings and paragraphs', () => {
  assert.deepEqual(blocksOf('First line\nstill first.\n\n#Early life\n\nSecond.'), [
    { text: 'First line still first.' },
    { heading: true, text: 'Early life' },
    { text: 'Second.' },
  ]);
});

test('an article is loaded once per source and entry, and a failure is not kept', async () => {
  clearCache();
  let calls = 0;
  const fake = { id: 'fake', name: 'Fake', fetch: async (title) => { calls++; if (calls === 1) throw new Error('down'); return { source: 'fake', title, url: 'u', text: 'Words.', license: 'x' }; } };
  {
    const entry = { title: 'Alan Turing', kind: 'person', key: 'alan_turing' };
    const source = { id: 'fake', fetch: fake.fetch };
    await assert.rejects(loadArticle('fake', entry, { source }), /down/);
    const first = await loadArticle('fake', entry, { source });
    const again = await loadArticle('fake', entry, { source });
    assert.equal(calls, 2);
    assert.equal(first, again);
    assert.equal(first.kind, 'person');
    assert.equal(first.pageCount, MIN_PAGES);
  }
  clearCache();
});

test('an unknown source is refused', async () => {
  await assert.rejects(loadArticle('britannica', { title: 'X', kind: 'topic', key: 'x' }), /Unknown source/);
  assert.equal(GROKIPEDIA.id, 'grokipedia');
});

test('a failed load gives a satirical fallback book, with the failure recorded', async () => {
  clearCache();
  const source = { id: 'down', fetch: async () => { const e = new Error('HTTP 429 for x'); e.status = 429; throw e; } };
  const entry = { title: 'OpenAI', kind: 'company', key: 'openai' };
  const book = await loadOrFallback('down', entry, { source });
  assert.equal(book.fallback, true);
  assert.equal(book.title, 'Too Many Requests');
  assert.equal(book.kind, 'company');
  assert.match(book.failure, /HTTP 429/);
  assert.ok(book.pageCount >= MIN_PAGES);
  clearCache();
});

test('every fallback is a short, readable book with headings and no mark characters', () => {
  assert.equal(FALLBACKS.length, 5);
  for (const b of FALLBACKS) {
    assert.ok(b.text.split(/\s+/).length < 220, `${b.title} is too long`);
    assert.ok(blocksOf(b.text).some((x) => x.heading), `${b.title} has no heading`);
    assert.doesNotMatch(b.text, /[*~]/);
  }
});

test('each kind of failure has its book', () => {
  assert.equal(fallbackFor({ status: 429 }).title, 'Too Many Requests');
  assert.equal(fallbackFor({ name: 'ArticleNotFound' }).title, 'The Page That Was Here Yesterday');
  assert.equal(fallbackFor(new TypeError('fetch failed')).title, 'Please Stand By');
  assert.equal(fallbackFor({ status: 503 }).title, 'Scheduled Maintenance');
});

test('catalog entries, which have no key of their own, are cached apart', async () => {
  clearCache();
  const source = { id: 'fake', fetch: async (title) => ({ source: 'fake', title, url: null, text: `about ${title}`, license: null }) };
  const a = await loadArticle('fake', CATALOG[0], { source });
  const b = await loadArticle('fake', CATALOG[1], { source });
  assert.equal(a.title, CATALOG[0].title);
  assert.equal(b.title, CATALOG[1].title);
  assert.notEqual(a.key, b.key);
});

test('both encyclopedia sources read committed local snapshots, never live APIs', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    requested.push(new URL(input));
    return {
      status: 200,
      ok: true,
      json: async () => ({
        title: 'Artificial intelligence',
        url: 'https://example.test/article',
        text: 'Snapshot article text.',
        license: 'snapshot license',
      }),
    };
  };
  try {
    const [wiki, grok] = await Promise.all([
      WIKIPEDIA.fetch('Artificial intelligence'),
      GROKIPEDIA.fetch('Artificial intelligence'),
    ]);
    const paths = requested.map((url) => url.pathname);
    assert.ok(paths.some((path) => path.endsWith('/data/wikipedia/Artificial_intelligence.json')));
    assert.ok(paths.some((path) => path.endsWith('/data/grokipedia/Artificial_intelligence.json')));
    assert.equal(wiki.text, 'Snapshot article text.');
    assert.equal(grok.text, 'Snapshot article text.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
