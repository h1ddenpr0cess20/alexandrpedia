/**
 * The encyclopedias the books come from. Each source turns a title into
 * `{ source, title, url, text, license }`, where `text` is the book's form (see
 * text.js). Both encyclopedias are read from committed JSON snapshots under data/.
 * The browser does not call either encyclopedia API.
 */

import { ArticleNotFound } from './fetch.js';

/** The title as it appears in a page's address: spaces become underscores. */
export const slugOf = (title) => String(title).trim().replace(/\s+/g, '_');

export const WIKIPEDIA = Object.freeze({
  id: 'wikipedia',
  name: 'Wikipedia',
  print: true,
  license: 'CC BY-SA 4.0',
  pageUrl: (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(slugOf(title))}`,
  async fetch(title) {
    return readSnapshot(WIKIPEDIA.id, title, WIKIPEDIA.pageUrl(title), WIKIPEDIA.license);
  }
});

export const GROKIPEDIA = Object.freeze({
  id: 'grokipedia',
  name: 'Grokipedia',
  print: false, // Use the engine's Madman's Hand page lettering.
  license: 'See grokipedia.com',
  pageUrl: (title) => `https://grokipedia.com/page/${encodeURIComponent(slugOf(title))}`,
  async fetch(title) {
    return readSnapshot(GROKIPEDIA.id, title, GROKIPEDIA.pageUrl(title), GROKIPEDIA.license);
  }
});

/**
 * Read the committed JSON snapshot. Missing or malformed files are explicit errors,
 * never a trigger for a live encyclopedia request.
 */
async function readSnapshot(sourceId, title, url, license) {
  const base = typeof document !== 'undefined'
    ? document.baseURI
    : new URL('../', import.meta.url);
  const file = new URL(`data/${sourceId}/${encodeURIComponent(slugOf(title))}.json`, base);
  const response = await fetch(file.href);
  const sourceName = sourceId === 'wikipedia' ? 'Wikipedia' : 'Grokipedia';
  if (response.status === 404) throw new ArticleNotFound(sourceName, title);
  if (!response.ok) throw new Error(`Could not read ${sourceId} snapshot (${response.status}): ${file.pathname}`);
  const article = await response.json();
  if (!article || typeof article.text !== 'string' || !article.text.trim()) {
    throw new Error(`Invalid ${sourceId} snapshot for "${title}"`);
  }
  return {
    source: sourceId,
    title: article.title || title,
    url: article.url || url,
    text: article.text,
    license: article.license || license,
  };
}

/** Every source, in the order their shelves are shown. */
export const SOURCES = Object.freeze([WIKIPEDIA, GROKIPEDIA]);

export const sourceById = (id) => SOURCES.find((s) => s.id === id) ?? null;
