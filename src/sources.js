/**
 * The encyclopedias the books come from. Each source turns a title into
 * `{ source, title, url, text, license }`, where `text` is the book's form (see
 * text.js). No proxy is used. Wikipedia's API allows cross-origin requests with
 * `origin=*`, so the browser asks it directly. Grokipedia sends no CORS headers,
 * so a browser cannot read it; its articles are fetched ahead of time from Node
 * (`npm run snapshot-grokipedia`, scripts/snapshot-grokipedia.mjs) into
 * data/grokipedia/, and the browser reads those from our own origin.
 */

import { ArticleNotFound, HttpError, fetchWithRetry } from './fetch.js';
import { grokipediaBody, htmlToText, wikipediaExtractToText } from './text.js';

/** Browsers do not let a page set its User-Agent, so it is only sent from Node. */
const NODE = typeof window === 'undefined';
const headers = NODE ? { 'User-Agent': 'alexandrpedia/0.1 (https://github.com/h1ddenpr0cess20/alexandrpedia)' } : undefined;

/** The title as it appears in a page's address: spaces become underscores. */
export const slugOf = (title) => String(title).trim().replace(/\s+/g, '_');

export const WIKIPEDIA = Object.freeze({
  id: 'wikipedia',
  name: 'Wikipedia',
  license: 'CC BY-SA 4.0',
  pageUrl: (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(slugOf(title))}`,
  async fetch(title, options = {}) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      exlimit: '1',
      redirects: '1',
      inprop: 'url',
      format: 'json',
      formatversion: '2',
      origin: '*',
      titles: slugOf(title).replace(/_/g, ' '),
    });
    const url = `https://en.wikipedia.org/w/api.php?${params}`;
    const res = await fetchWithRetry(url, { ...options, init: headers ? { headers } : undefined });
    if (!res.ok) throw new HttpError(url, res.status);
    const page = (await res.json())?.query?.pages?.[0];
    if (!page || page.missing || page.invalid) throw new ArticleNotFound(WIKIPEDIA.name, title);
    return {
      source: WIKIPEDIA.id,
      title: page.title,
      url: page.fullurl ?? WIKIPEDIA.pageUrl(page.title),
      text: wikipediaExtractToText(page.extract ?? ''),
      license: WIKIPEDIA.license,
    };
  },
});

export const GROKIPEDIA = Object.freeze({
  id: 'grokipedia',
  name: 'Grokipedia',
  license: 'See grokipedia.com',
  pageUrl: (title) => `https://grokipedia.com/page/${encodeURIComponent(slugOf(title))}`,
  async fetch(title, options = {}) {
    const url = GROKIPEDIA.pageUrl(title);
    if (!NODE) {
      // The snapshot, from our own origin.
      const file = new URL(`data/grokipedia/${encodeURIComponent(slugOf(title))}.json`, globalThis.document?.baseURI ?? globalThis.location?.href);
      const res = await fetchWithRetry(file.href, options);
      if (res.status === 404) throw new ArticleNotFound(GROKIPEDIA.name, title);
      if (!res.ok) throw new HttpError(file.href, res.status);
      return res.json();
    }
    const res = await fetchWithRetry(url, { ...options, init: headers ? { headers } : undefined });
    if (res.status === 404) throw new ArticleNotFound(GROKIPEDIA.name, title);
    if (!res.ok) throw new HttpError(url, res.status);
    const html = await res.text();
    const body = grokipediaBody(html);
    if (!body) throw new ArticleNotFound(GROKIPEDIA.name, title);
    const name = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? title;
    return {
      source: GROKIPEDIA.id,
      title: name.replace(/\s*[—-]\s*Grokipedia\s*$/i, '').trim() || title,
      url,
      text: htmlToText(body),
      license: GROKIPEDIA.license,
    };
  },
});

/** Every source, in the order their shelves are shown. */
export const SOURCES = Object.freeze([WIKIPEDIA, GROKIPEDIA]);

export const sourceById = (id) => SOURCES.find((s) => s.id === id) ?? null;
