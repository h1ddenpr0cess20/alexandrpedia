/**
 * The library: loads an article from a source once, and turns it into what a
 * book is made from. The text is cached in memory so a book is only fetched
 * once per visit.
 */

import { keyOf } from './catalog.js';
import { fallbackFor } from './fallbacks.js';
import { SOURCES, sourceById } from './sources.js';

/** Two sides per leaf, capped at the engine's 160-leaf maximum. */
export const MIN_PAGES = 2;
export const MAX_PAGES = 320;

const cache = new Map();

/** How many pages to make a book with for a text. Always even: pages go two to a leaf. */
/**
 * Server-safe metadata estimate only. Actual shelf geometry uses the engine's
 * canvas-measured flowPages() result, so this estimate never controls book size.
 */
export function pageCountFor(text) {
  const value = String(text ?? '');
  if (!value.trim()) return MIN_PAGES;
  const estimated = Math.max(1, Math.ceil(value.length / 1900));
  const even = estimated + (estimated % 2);
  return Math.min(MAX_PAGES, Math.max(MIN_PAGES, even));
}

/**
 * Loads one article. Resolves to `{ source, title, url, text, license, kind,
 * key, pageCount }`; rejects with what the source gave (ArticleNotFound, HttpError).
 * @param {string} sourceId
 * @param {{ title: string, kind: string, key: string }} entry
 * @param {{ fetchOptions?: object, source?: object }} [options] `source` replaces the registered source (for tests)
 */
export async function loadArticle(sourceId, entry, { fetchOptions, source: given } = {}) {
  const source = given ?? sourceById(sourceId);
  if (!source) throw new Error(`Unknown source "${sourceId}"`);
  const key = entry.key ?? keyOf(entry); // catalog entries carry no key of their own: without this every book shared one cache slot
  const id = `${source.id}:${key}`;
  if (!cache.has(id)) {
    // Read a committed snapshot once per article per visit.
    const promise = (async () => {
      // Committed snapshots are authoritative; older IndexedDB data must not mask them.
      const article = await source.fetch(entry.titles?.[source.id] ?? entry.title, fetchOptions);
      return { ...article, kind: entry.kind, key, pageCount: pageCountFor(article.text) };
    })();
    cache.set(id, promise);
    // A failed load is not kept, so a retry asks again.
    promise.catch(() => cache.delete(id));
  }
  return cache.get(id);
}

/**
 * As loadArticle, but a failure gives a book all the same: one of the
 * satirical fallbacks (fallbacks.js), marked `fallback: true` with the
 * `failure` message, so the shelf is never left with an empty spine.
 */
export async function loadOrFallback(sourceId, entry, options = {}) {
  try {
    return await loadArticle(sourceId, entry, options);
  } catch (error) {
    const book = fallbackFor(error);
    return {
      source: 'fallback',
      title: book.title,
      url: null,
      text: book.text,
      license: null,
      kind: entry.kind,
      key: `${book.key}:${sourceId}:${entry.key ?? keyOf(entry)}`,
      pageCount: pageCountFor(book.text),
      fallback: true,
      failure: `${sourceId}: ${error.message}`,
    };
  }
}

/** Forget what was loaded (for the tests, and for a reload button). */
export function clearCache() {
  cache.clear();
}

/** The book's paragraphs, as the reader shows them: `{ heading: true, text }` or `{ text }`. */
export function blocksOf(text) {
  return String(text ?? '')
    .split(/\n{2,}|\n(?=#)/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (block.startsWith('#') ? { heading: true, text: block.slice(1).trim() } : { text: block.replace(/\n/g, ' ') }));
}

export { SOURCES };
