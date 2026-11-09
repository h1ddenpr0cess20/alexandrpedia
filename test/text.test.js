import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanLines, decodeEntities, grokipediaBody, htmlToText, wikipediaExtractToText } from '../src/text.js';

const here = dirname(fileURLToPath(import.meta.url));

test('Wikipedia section markers become book headings, and reference sections are dropped', () => {
  const extract = [
    'Alan Turing was a mathematician.',
    '',
    '== Early life ==',
    'He was born in London.',
    '',
    '=== Schooling ===',
    'He went to school.',
    '',
    '== See also ==',
    '* List of computer scientists',
    '',
    '== References ==',
    'Some reference.',
  ].join('\n');
  const text = wikipediaExtractToText(extract);
  assert.equal(text, [
    'Alan Turing was a mathematician.',
    '',
    '#Early life',
    '',
    'He was born in London.',
    '',
    '#Schooling',
    '',
    'He went to school.',
  ].join('\n'));
});

test('the mark characters the book reads (* and ~) are removed from the words', () => {
  assert.equal(cleanLines('a *starred* and ~struck~ word'), 'a starred and struck word');
});

test('citation markers like [12] are removed', () => {
  assert.equal(cleanLines('A claim.[12] Another.[3][4]'), 'A claim. Another.');
});

test('entities are decoded', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &#8211; &#x2014; &quot;ok&quot;'), 'Tom & Jerry – — "ok"');
});

test('a Grokipedia article body is found by its nesting, not by the next closing div', () => {
  const html = '<div class="x"><div class="article-body"><div><p>inner</p></div><span>after</span></div></div><p>outside</p>';
  assert.equal(grokipediaBody(html), '<div class="article-body"><div><p>inner</p></div><span>after</span></div>');
  assert.equal(grokipediaBody('<p>no body</p>'), null);
});

test('the Grokipedia excerpt becomes paragraphs and headings, with no markup, maths or buttons left', () => {
  const html = readFileSync(join(here, 'fixtures/grokipedia-article-excerpt.html'), 'utf8');
  const text = htmlToText(grokipediaBody(html));
  assert.match(text, /^Alan Mathison Turing \(23 June 1912 – 7 June 1954\) was an English mathematician/);
  assert.match(text, /\n\n#Early Life and Education\n\n/);
  assert.match(text, /\n\n#Family Background and Childhood\n\n/);
  assert.doesNotMatch(text, /[<>]/);
  assert.doesNotMatch(text, /Copy link|Listen to this section/);
  // each paragraph is its own block, not one run-on line
  assert.ok(text.split('\n\n').length >= 4);
});
