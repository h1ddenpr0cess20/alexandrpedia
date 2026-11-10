/** CLI and selection helpers for refreshing committed article snapshots. */

const DURATION_UNITS = Object.freeze({
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
});

export function parseDuration(value) {
  const match = /^(\\d+)([smhdw])$/i.exec(String(value ?? '').trim());
  if (!match) throw new Error('Age must be a duration such as 12h, 7d, or 2w.');
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const milliseconds = amount * DURATION_UNITS[unit];
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error('Age must be a positive, safely representable duration.');
  }
  return milliseconds;
}

export function normalizeArticleTitle(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\\p{L}\\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Parse updater options. A selector is mandatory so an accidental bare
 * invocation can never refresh hundreds of articles.
 */
export function parseUpdateArgs(args) {
  const options = {
    mode: null,
    titles: [],
    ageMs: null,
    source: 'both',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split(/=(.*)/s, 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
      return value;
    };

    switch (flag) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--all':
        if (options.mode) throw new Error('Choose only one selector: --all, --title, or --older-than.');
        options.mode = 'all';
        break;
      case '--title': {
        if (options.mode && options.mode !== 'title') throw new Error('Choose only one selector: --all, --title, or --older-than.');
        options.mode = 'title';
        const title = readValue().trim();
        if (!title) throw new Error('--title cannot be empty.');
        options.titles.push(title);
        break;
      }
      case '--older-than':
        if (options.mode) throw new Error('Choose only one selector: --all, --title, or --older-than.');
        options.mode = 'older-than';
        options.ageMs = parseDuration(readValue());
        break;
      case '--source':
        options.source = readValue().toLowerCase();
        if (!['both', 'wikipedia', 'grokipedia'].includes(options.source)) {
          throw new Error('--source must be both, wikipedia, or grokipedia.');
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.help) return Object.freeze(options);
  if (!options.mode) throw new Error('Choose --all, --title "Article title", or --older-than 30d.');
  if (options.mode === 'title') {
    const unique = new Map(options.titles.map((title) => [normalizeArticleTitle(title), title]));
    options.titles = [...unique.values()];
  }
  return Object.freeze({ ...options, titles: Object.freeze([...options.titles]) });
}

/** Match requested titles to the display title or either source's title alias. */
export function selectCatalogEntries(entries, requestedTitles) {
  const wanted = new Set(requestedTitles.map(normalizeArticleTitle));
  const matched = [];
  const found = new Set();

  for (const entry of entries) {
    const aliases = [entry.title, ...Object.values(entry.titles ?? {})];
    if (!aliases.some((title) => wanted.has(normalizeArticleTitle(title)))) continue;
    matched.push(entry);
    for (const title of aliases) found.add(normalizeArticleTitle(title));
  }

  const missing = requestedTitles.filter((title) => !found.has(normalizeArticleTitle(title)));
  return { entries: matched, missing };
}

/** Missing/invalid timestamps are considered stale so old snapshots are refreshable. */
export function isSnapshotOlderThan(snapshot, ageMs, now = Date.now()) {
  const fetchedAt = Date.parse(snapshot?.fetchedAt ?? '');
  return !Number.isFinite(fetchedAt) || fetchedAt <= now - ageMs;
}
