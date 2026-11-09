/**
 * The library: loads an article from a source once, and turns it into what a
 * book is made from. The text is cached in memory so a book is only fetched
 * once per visit.
 */

import { keyOf } from './catalog.js';
import { fallbackFor } from './fallbacks.js';
import { SOURCES, sourceById } from './sources.js';

/** Roughly how many characters a page of the book holds. */
export const CHARS_PER_PAGE = 1100;
/** The book's pages: at least this many, and at most this many (props/book.js holds 160 leaves). */
export const MIN_PAGES = 20;
export const MAX_PAGES = 200;

const cache = new Map();

/** How many pages to make a book with for a text. Always even: pages go two to a leaf. */
export function pageCountFor(text) {
  const wanted = Math.ceil(String(text).length / CHARS_PER_PAGE) + 2;
  const even = wanted + (wanted % 2);
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
    const promise = source.fetch(entry.titles?.[source.id] ?? entry.title, fetchOptions).then((article) => ({
      ...article,
      kind: entry.kind,
      key,
      pageCount: pageCountFor(article.text),
    }));
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
