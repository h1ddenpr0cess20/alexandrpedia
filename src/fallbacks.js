/**
 * Books for when a service fails: a fetch is refused, rate-limited, or the
 * article is not there. Each is short, is made in the same form as a real
 * article (`#Heading` marks, a blank line between paragraphs), and is shelved
 * where the book would have been. They make fun of the machinery, not of the
 * people who keep it running.
 */

export const FALLBACKS = Object.freeze([
  {
    key: 'fallback_rate_limited',
    title: 'Too Many Requests',
    subtitle: 'A Short Account of Asking Twice',
    when: 'HTTP 429',
    text: [
      'The shelf asked the encyclopedia for a page, and then asked again, and then once more in the same breath.',
      '',
      '#Chapter One: Patience',
      '',
      'The encyclopedia replied with a polite number and a closed door. The number was 429, which means that you have been very eager and should go and have a cup of tea.',
      '',
      '#Chapter Two: The Tea',
      '',
      'Tea was made. The page was not yet ready. It will be ready when the queue has finished queueing.',
      '',
      'Try again in a little while. The shelf will be here.',
    ].join('\n'),
  },
  {
    key: 'fallback_gone_missing',
    title: 'The Page That Was Here Yesterday',
    subtitle: 'Being a Study of Vanishing',
    when: 'not found',
    text: [
      'There was an article once, under this title. Its editors remember it fondly. Its readers recall the sentence in the second paragraph with great affection.',
      '',
      '#The Search',
      '',
      'The article was searched for by its exact name, then by its nearly exact name, then by a name that a reasonable person might have typed on a Tuesday. It was not found under any of them.',
      '',
      '#The Likely Explanation',
      '',
      'It was renamed, or it was moved to a draft, or it is being discussed on a page about whether it should exist. Any of these is the sort of thing that happens to a page. None of them is a reason to despair.',
    ].join('\n'),
  },
  {
    key: 'fallback_no_connection',
    title: 'Please Stand By',
    subtitle: 'A Pamphlet for the Waiting Room',
    when: 'network failure',
    text: [
      'The network has stepped out. It said it would only be a moment, and it has been a moment for some time now.',
      '',
      '#Things To Do Meanwhile',
      '',
      'Check that the cable is in the wall. Check that the wall is in the house. Check that the house is connected to somewhere that has a wire going out of it.',
      '',
      'If all of these are in order, the fault is somewhere in the middle, which is where faults traditionally live.',
      '',
      '#Things Not To Do',
      '',
      'Do not refresh the page forty times. The network can hear you, and it is trying.',
    ].join('\n'),
  },
  {
    key: 'fallback_too_clever',
    title: 'A Confident Summary',
    subtitle: 'Written Without Being Checked',
    when: 'an unexpected answer',
    text: [
      'This book was written by a machine that was asked a question it could not quite answer, and so it answered anyway, with great assurance.',
      '',
      '#A Note From the Reader',
      '',
      'The sentences are smooth. The facts are shaped like facts. Some of them are facts. The reader is encouraged to find out which, and to be a little less impressed by the smoothness than the machine would like.',
      '',
      '#Why This Book Is Here',
      '',
      'The article could not be fetched, so this one was put on the shelf instead. It sounds right. Check it against a real page before you believe a word.',
    ].join('\n'),
  },
  {
    key: 'fallback_down_for_maintenance',
    title: 'Scheduled Maintenance',
    subtitle: 'In Which Everyone Is Very Busy',
    when: 'HTTP 5xx',
    text: [
      'Somewhere a team of engineers has put on a hard hat, and a sign has gone up that says Back Soon.',
      '',
      '#The Sign',
      '',
      'The sign has been up for a while. It is a good sign. It is not a sign that anything is broken forever; it is a sign that someone is working on it, with a flask of coffee and a long list.',
      '',
      '#In the Meantime',
      '',
      'Read something else. There are a great many other books on this shelf, and most of them were not down for maintenance at all.',
    ].join('\n'),
  },
]);

/** The fallback for a failure, by what went wrong: a status, or a name for the error. */
export function fallbackFor(error) {
  if (error?.status === 429) return FALLBACKS[0];
  if (error?.name === 'ArticleNotFound') return FALLBACKS[1];
  if (error?.name === 'TypeError' || /fetch failed|network|Failed to fetch/i.test(String(error?.message))) return FALLBACKS[2];
  if (error?.status >= 500) return FALLBACKS[4];
  return FALLBACKS[3];
}
