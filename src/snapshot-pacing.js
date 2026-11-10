/**
 * Small helpers for the Wikipedia snapshot importer.
 * Successful requests use a short fixed gap; actual rate-limit responses use
 * exponential backoff and honor Retry-After when the server supplies it.
 */

export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || String(value).trim() === '') return 0;
  const raw = String(value).trim();
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
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
