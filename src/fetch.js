/**
 * A GET that waits out rate limits. Wikimedia and the other sites answer 429
 * (or a 5xx) when asked too fast; this retries those with exponential
 * back-off, honouring `Retry-After` when it is given in seconds.
 */

const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(url, status) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export class ArticleNotFound extends Error {
  constructor(source, title) {
    super(`No article called "${title}" on ${source}`);
    this.name = 'ArticleNotFound';
    this.source = source;
    this.title = title;
  }
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.retries] how many times to try again after the first
 * @param {number} [options.baseDelay] milliseconds before the first retry
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {RequestInit} [options.init]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, {
  fetchImpl = globalThis.fetch,
  retries = 4,
  baseDelay = 1000,
  sleep = wait,
  init = undefined,
} = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, init);
    if (res.ok || !RETRY_STATUS.has(res.status) || attempt >= retries) return res;
    const after = Number(res.headers?.get?.('retry-after'));
    const delay = Number.isFinite(after) && after > 0 ? after * 1000 : baseDelay * 2 ** attempt;
    await sleep(delay);
  }
}
