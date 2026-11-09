/**
 * What is on the shelves: the same list for each source, so one topic can be
 * compared across the two encyclopedias. `title` is the article's title as the
 * sources spell it (underscores and spaces both work).
 */
export const KINDS = Object.freeze({
  topic: 'Topic',
  person: 'Person',
  company: 'Company',
});

export const CATALOG = Object.freeze([
  // topics
  { title: 'Artificial intelligence', kind: 'topic' },
  { title: 'Machine learning', kind: 'topic' },
  { title: 'Deep learning', kind: 'topic' },
  { title: 'Neural network (machine learning)', kind: 'topic' },
  { title: 'Large language model', kind: 'topic' },
  { title: 'Reinforcement learning', kind: 'topic' },
  { title: 'Natural language processing', kind: 'topic' },
  { title: 'Computer vision', kind: 'topic' },
  { title: 'Artificial general intelligence', kind: 'topic' },
  { title: 'AI safety', kind: 'topic' },
  // people
  { title: 'Alan Turing', kind: 'person' },
  { title: 'John McCarthy', kind: 'person' },
  { title: 'Marvin Minsky', kind: 'person' },
  { title: 'Geoffrey Hinton', kind: 'person' },
  { title: 'Yann LeCun', kind: 'person' },
  { title: 'Yoshua Bengio', kind: 'person' },
  { title: 'Fei-Fei Li', kind: 'person' },
  { title: 'Demis Hassabis', kind: 'person' },
  { title: 'Ilya Sutskever', kind: 'person' },
  { title: 'Sam Altman', kind: 'person' },
  { title: 'Dario Amodei', kind: 'person' },
  { title: 'Andrew Ng', kind: 'person' },
  // companies
  { title: 'OpenAI', kind: 'company' },
  { title: 'Anthropic', kind: 'company' },
  { title: 'Google DeepMind', kind: 'company' },
  { title: 'Meta AI', kind: 'company' },
  { title: 'Mistral AI', kind: 'company' },
  { title: 'Hugging Face', kind: 'company' },
  { title: 'Nvidia', kind: 'company' },
  { title: 'Cohere', kind: 'company' },
  { title: 'Stability AI', kind: 'company' },
]);

/** A stable key for an entry, the same on every shelf. */
export const keyOf = (entry) => entry.title.replace(/[\s()]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
