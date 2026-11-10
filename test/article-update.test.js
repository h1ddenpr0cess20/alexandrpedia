import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSnapshotOlderThan,
  normalizeArticleTitle,
  parseDuration,
  parseUpdateArgs,
  resolveUpdateEntries,
} from '../src/article-update.js';

const catalog = [
  { title: 'Alan Turing', titles: { wikipedia: 'Alan Turing', grokipedia: 'Alan_Turing' } },
  { title: 'Neural networks', titles: { wikipedia: 'Artificial neural network', grokipedia: 'Neural Network' } },
];

test('durations accept seconds, minutes, hours, days, and weeks', () => {
  assert.equal(parseDuration('30s'), 30_000);
  assert.equal(parseDuration('12m'), 720_000);
  assert.equal(parseDuration('12h'), 43_200_000);
  assert.equal(parseDuration('7d'), 604_800_000);
  assert.equal(parseDuration('2w'), 1_209_600_000);
});

test('invalid and overflowing durations are rejected', () => {
  for (const value of ['0d', '-2d', '2 months', '1y', '999999999999999999999d', '']) {
    assert.throws(() => parseDuration(value));
  }
});

test('a bare invocation prints help instead of refreshing all snapshots', () => {
  assert.equal(parseUpdateArgs([]).help, true);
  assert.equal(parseUpdateArgs(['--help']).help, true);
});

test('all, source, repeated title, age, and dry-run arguments are parsed', () => {
  assert.deepEqual(parseUpdateArgs(['--all', '--source', 'wikipedia', '--dry-run']), {
    mode: 'all', titles: [], ageMs: null, source: 'wikipedia', dryRun: true, help: false,
  });
  assert.deepEqual(parseUpdateArgs(['--title', 'Alan Turing', '--title=Neural Network', '--source=grokipedia']), {
    mode: 'title', titles: ['Alan Turing', 'Neural Network'], ageMs: null, source: 'grokipedia', dryRun: false, help: false,
  });
  assert.equal(parseUpdateArgs(['--older-than', '30d']).ageMs, 30 * 86_400_000);
});

test('conflicting selectors and invalid arguments are rejected', () => {
  assert.throws(() => parseUpdateArgs(['--all', '--older-than', '30d']), /only one selector/);
  assert.throws(() => parseUpdateArgs(['--source', 'unknown', '--all']), /--source/);
  assert.throws(() => parseUpdateArgs(['--title']), /requires a value/);
  assert.throws(() => parseUpdateArgs(['--wat']), /Unknown option/);
});

test('source aliases and custom one-off titles resolve without duplication', () => {
  const resolved = resolveUpdateEntries(catalog, ['alan_turing', 'Artificial neural network', 'Custom Article']);
  assert.deepEqual(resolved.map((entry) => entry.title), ['Alan Turing', 'Neural networks', 'Custom Article']);
  assert.equal(resolved[2].kind, 'topic');
  assert.equal(normalizeArticleTitle('  Alan_Turing  '), 'alan turing');
});

test('repeated aliases resolve to a single curated article', () => {
  assert.equal(resolveUpdateEntries(catalog, ['Alan Turing', 'alan_turing', 'ALAN TURING']).length, 1);
});

test('missing and stale timestamps refresh; a recent timestamp remains fresh', () => {
  const now = Date.parse('2026-01-15T00:00:00Z');
  assert.equal(isSnapshotOlderThan({ fetchedAt: '2026-01-01T00:00:00Z' }, 7 * 86_400_000, now), true);
  assert.equal(isSnapshotOlderThan({ fetchedAt: '2026-01-12T00:00:00Z' }, 7 * 86_400_000, now), false);
  assert.equal(isSnapshotOlderThan({}, 7 * 86_400_000, now), true);
  assert.equal(isSnapshotOlderThan({ fetchedAt: 'invalid' }, 7 * 86_400_000, now), true);
});
