/**
 * Turns an article into the plain form the books take: one paragraph per
 * line, a blank line between paragraphs, and `#Heading` lines for sections
 * (the marks props/book.js reads). Reference sections are left out, and the
 * characters the book reads as marks (`*`, `~`) are removed from the words.
 */

/** Sections that are not part of the reading. */
const DROP_SECTIONS = /^(see also|references|external links|further reading|notes|sources|bibliography|footnotes|citations|primary sources|secondary sources)$/i;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

/**
 * Cleans text already in the book's form: collapses spaces, removes the
 * mark characters, drops reference sections, and squeezes blank lines.
 * @param {string} text
 */
export function cleanLines(text) {
  const out = [];
  let skipping = false;
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/[\s ]+/g, ' ').trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const heading = /^#{1,6}\s*(.+)$/.exec(line);
    if (heading) {
      const name = heading[1].replace(/[*~#]/g, '').replace(/\s+/g, ' ').trim();
      skipping = DROP_SECTIONS.test(name);
      if (!skipping && name) {
        if (out.length && out[out.length - 1] !== '') out.push('');
        out.push(`#${name}`, '');
      }
      continue;
    }
    if (skipping) continue;
    const words = line.replace(/[*~]/g, '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    if (words) out.push(words);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/**
 * Wikipedia's plain-text extract (the `explaintext` form), where sections are
 * written `== Heading ==` (and deeper with more `=`).
 * @param {string} extract
 */
export function wikipediaExtractToText(extract) {
  const marked = String(extract ?? '').replace(/^(={2,6})\s*(.+?)\s*\1\s*$/gm, (_, _eq, name) => `#${name}`);
  return cleanLines(marked);
}

/** Strips every tag from an HTML fragment and decodes its entities. */
export function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ''));
}

/**
 * The text of an HTML fragment: paragraphs and blocks on their own lines,
 * headings as `#Heading`, and the markup, scripts, maths and buttons dropped.
 * @param {string} fragment
 */
export function htmlToText(fragment) {
  let s = String(fragment)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|math|button|annotation|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<sup\b[^>]*reference[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => `\n\n#${stripTags(inner).trim()}\n\n`)
    .replace(/<span\b[^>]*data-tts-block[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|section|blockquote|table|tr|figure|figcaption|dd|dt|h[1-6])\b[^>]*>/gi, '\n\n');
  s = stripTags(s);
  return cleanLines(s);
}

/**
 * The article body of a Grokipedia page: the `div.article-body` element, found
 * by counting its nested divs, or null when the page has none.
 * @param {string} html
 */
export function grokipediaBody(html) {
  const start = String(html).indexOf('<div class="article-body">');
  if (start < 0) return null;
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = tag.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return null;
}
