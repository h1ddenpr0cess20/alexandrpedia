/** CLI and selection helpers for refreshing committed article snapshots. */

const DURATION_UNITS = Object.freeze({
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
});

export function parseDuration(value) {
  const match = /^(\d+)([smhdw])$/i.exec(String(value ?? '').trim());
  if (!match) throw new Error('Age must be a duration such as 12h, 7d, or 2w.');
  const amount = Number(match[1]);
  const milliseconds = amount * DURATION_UNITS[match[2].toLowerCase()];
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error('Age must be a positive, safely representable duration.');
  }
  return milliseconds;
}

export function normalizeArticleTitle(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Missing selector is help, never an accidental full-catalog refresh. */
export function parseUpdateArgs(args) {
  const options = { mode: null, titles: [], ageMs: null, source: 'both', dryRun: false, help: false };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const split = arg.indexOf('=');
    const flag = split < 0 ? arg : arg.slice(0, split);
    const inlineValue = split < 0 ? undefined : arg.slice(split + 1);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(flag + ' requires a value.');
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
        throw new Error('Unknown option: ' + arg);
    }
  }

  if (options.help || !options.mode) return Object.freeze({ ...options, help: true });
  if (options.mode === 'title') {
    const unique = new Map(options.titles.map((title) => [normalizeArticleTitle(title), title]));
    options.titles = [...unique.values()];
  }
  return Object.freeze({ ...options, titles: Object.freeze([...options.titles]) });
}

/** Resolve curated names and source-specific aliases; preserve unknown one-off titles. */
export function resolveUpdateEntries(entries, requestedTitles) {
  const result = [];
  const seen = new Set();

  for (const requested of requestedTitles) {
    const normalized = normalizeArticleTitle(requested);
    const match = entries.find((entry) =>
      [entry.title, ...Object.values(entry.titles ?? {})]
        .some((alias) => normalizeArticleTitle(alias) === normalized)
    );
    const entry = match ?? Object.freeze({ title: requested, kind: 'topic', titles: Object.freeze({}) });
    const key = normalizeArticleTitle(entry.title);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

/** Missing/invalid timestamps count as stale so old snapshots are refreshable. */
export function isSnapshotOlderThan(snapshot, ageMs, now = Date.now()) {
  const fetchedAt = Date.parse(snapshot?.fetchedAt ?? '');
  return !Number.isFinite(fetchedAt) || fetchedAt <= now - ageMs;
}
