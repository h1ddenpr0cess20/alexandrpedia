import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from '../src/fetch.js';
import { GROKIPEDIA, WIKIPEDIA, slugOf } from '../src/sources.js';

/** A fetch that answers from a script of [status, headers] pairs, and records the calls. */
function scripted(replies) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const [status, headers = {}, body = ''] = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Response(body, { status, headers });
  };
  return { fetchImpl, calls };
}

test('a 429 is retried after the Retry-After delay, then the answer is kept', async () => {
  const waits = [];
  const { fetchImpl, calls } = scripted([[429, { 'retry-after': '3' }], [200, {}, 'ok']]);
  const res = await fetchWithRetry('https://example.test/a', { fetchImpl, sleep: async (ms) => waits.push(ms) });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [3000]);
});

test('without Retry-After, the wait doubles each time', async () => {
  const waits = [];
  const { fetchImpl } = scripted([[503], [503], [503], [200]]);
  const res = await fetchWithRetry('https://example.test/b', { fetchImpl, baseDelay: 100, sleep: async (ms) => waits.push(ms) });
  assert.equal(res.status, 200);
  assert.deepEqual(waits, [100, 200, 400]);
});

test('it gives up after the retries and returns the last answer', async () => {
  const { fetchImpl, calls } = scripted([[429]]);
  const res = await fetchWithRetry('https://example.test/c', { fetchImpl, retries: 2, sleep: async () => {} });
  assert.equal(res.status, 429);
  assert.equal(calls.length, 3);
});

test('a 404 is not retried', async () => {
  const { fetchImpl, calls } = scripted([[404]]);
  const res = await fetchWithRetry('https://example.test/d', { fetchImpl, sleep: async () => {} });
  assert.equal(res.status, 404);
  assert.equal(calls.length, 1);
});

test('Wikipedia and Grokipedia address pages by the title with underscores', () => {
  assert.equal(slugOf('  Alan  Turing '), 'Alan_Turing');
  assert.equal(WIKIPEDIA.pageUrl('Fei-Fei Li'), 'https://en.wikipedia.org/wiki/Fei-Fei_Li');
  assert.equal(GROKIPEDIA.pageUrl('Neural network (machine learning)'), 'https://grokipedia.com/page/Neural_network_(machine_learning)');
});

test('the Wikipedia source reads a committed local JSON snapshot', async () => {
  const body = JSON.stringify({
    title: 'Nvidia',
    url: 'https://en.wikipedia.org/wiki/Nvidia',
    text: 'Nvidia is a company.\\n\\n#History\\n\\nIt began.',
    license: 'CC BY-SA 4.0',
  });
  const { fetchImpl, calls } = scripted([[200, {}, body]]);
  const article = await WIKIPEDIA.fetch('Nvidia', { fetchImpl });
  assert.ok(new URL(calls[0]).pathname.endsWith('/data/wikipedia/Nvidia.json'));
  assert.equal(article.title, 'Nvidia');
  assert.equal(article.text, 'Nvidia is a company.\\n\\n#History\\n\\nIt began.');
  assert.equal(article.license, 'CC BY-SA 4.0');
});

test('a missing local Wikipedia snapshot is reported as not found', async () => {
  const { fetchImpl } = scripted([[404]]);
  await assert.rejects(WIKIPEDIA.fetch('Nope', { fetchImpl }), { name: 'ArticleNotFound' });
});
