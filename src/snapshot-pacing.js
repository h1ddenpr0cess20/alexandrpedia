/**
 * Small helpers for the Wikipedia snapshot importer.
 * Successful requests use a short fixed gap; actual rate-limit responses use
 * exponential backoff and honor Retry-After when the server supplies it.
 */

export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || String(value).trim() === '') return 0;
  const raw = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) * 1000;
  if (/^-\d+(?:\.\d+)?$/.test(raw)) return 0;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : 0;
}

export function retryDelayMs({
  streak,
  retryAfterMs = 0,
  baseMs = 30_000,
  maxMs = 5 * 60_000,
}) {
  const count = Math.max(1, Math.floor(Number(streak) || 1));
  const exponential = Math.min(maxMs, baseMs * (2 ** (count - 1)));
  return Math.max(0, retryAfterMs, exponential);
}
