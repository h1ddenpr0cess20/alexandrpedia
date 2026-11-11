import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRetryAfter, retryDelayMs } from '../src/snapshot-pacing.js';

test('Retry-After seconds are converted to milliseconds', () => {
  assert.equal(parseRetryAfter('12'), 12_000);
  assert.equal(parseRetryAfter('0'), 0);
});

test('Retry-After HTTP dates become a delay from the supplied clock', () => {
  const now = Date.parse('Wed, 21 Oct 2015 07:27:00 GMT');
  assert.equal(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT', now), 60_000);
  assert.equal(parseRetryAfter('Wed, 21 Oct 2015 07:26:00 GMT', now), 0);
});

test('missing, invalid and negative Retry-After values do not create huge waits', () => {
  assert.equal(parseRetryAfter(null), 0);
  assert.equal(parseRetryAfter('not a date'), 0);
  assert.equal(parseRetryAfter('-4'), 0);
});

test('rate-limit pauses start at 15 seconds and grow exponentially', () => {
  assert.equal(retryDelayMs({ streak: 1, baseMs: 15_000 }), 15_000);
  assert.equal(retryDelayMs({ streak: 2, baseMs: 15_000 }), 30_000);
  assert.equal(retryDelayMs({ streak: 3, baseMs: 15_000 }), 60_000);
});

test('server Retry-After is honored and cooldown is capped unless the server asks for longer', () => {
  assert.equal(retryDelayMs({ streak: 1, retryAfterMs: 45_000, baseMs: 15_000 }), 45_000);
  assert.equal(retryDelayMs({ streak: 10, baseMs: 15_000, maxMs: 180_000 }), 180_000);
  assert.equal(retryDelayMs({ streak: 1, retryAfterMs: 240_000, baseMs: 15_000, maxMs: 180_000 }), 240_000);
});
