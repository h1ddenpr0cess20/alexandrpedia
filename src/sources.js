/**
 * The encyclopedias the books come from. Each source turns a title into
 * `{ source, title, url, text, license }`, where `text` is the book's form (see
 * text.js). Both are read from the browser. Wikipedia's API allows cross-origin
 * requests with `origin=*`; Grokipedia's pages send no CORS headers at all, so
 * a browser cannot read them directly. They go through `/proxy/grokipedia/` on
 * our own server (scripts/serve.mjs) when it is there, and through a public
 * CORS proxy when the page is served from plain static hosting.
 */

import { ArticleNotFound, HttpError, fetchWithRetry } from './fetch.js';
import { grokipediaBody, htmlToText, wikipediaExtractToText } from './text.js';

/** Browsers do not let a page set its User-Agent, so it is only sent from Node. */
const NODE = typeof window === 'undefined';
const headers = NODE ? { 'User-Agent': 'alexandrpedia/0.1 (https://github.com/h1ddenpr0cess20/alexandrpedia)' } : undefined;

/** Our own server's relay for Grokipedia (scripts/serve.mjs), which marks its answers so a 404 from static hosting is told apart. */
export const PROXY_MARK = 'x-alexandrpedia-proxy';
const LOCAL_PROXY = (slug) => new URL(`proxy/grokipedia/${encodeURIComponent(slug)}`, globalThis.document?.baseURI ?? 'http://localhost/').href;
const PUBLIC_PROXY = (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
let localProxy = null; // null: not tried yet; then whether our server answers

/**
 * Grokipedia's page as a Response. From Node it is asked for directly. From a
 * browser it goes through our own server's relay, or, if that is not there, a
 * public CORS proxy.
 */
async function grokipediaResponse(url, slug, options) {
  const init = headers ? { headers } : undefined;
  if (NODE) return fetchWithRetry(url, { ...options, init });
  if (localProxy !== false) {
    try {
      const res = await fetchWithRetry(LOCAL_PROXY(slug), { ...options });
      if (res.headers.get(PROXY_MARK)) { localProxy = true; return res; }
      localProxy = false;
    } catch {
      localProxy = false;
    }
  }
  return fetchWithRetry(PUBLIC_PROXY(url), { ...options });
}

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
    const res = await grokipediaResponse(url, slugOf(title), options);
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
