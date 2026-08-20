/* The judge.
 *
 * Runs server-side only. The expected answers live in ava.js, are never in publicAct(), and
 * never reach a browser.
 *
 * THE RULE IS "GENEROUS, NEVER LEAKY". Someone holding the right answer must not fail on a
 * full stop, a capital letter, or having typed "the password is" in front of it. But nothing
 * here may tell a guesser they are getting warmer: no partial credit, no warm/cold, and one
 * fixed message for every wrong answer — otherwise the box becomes an oracle to grind against,
 * and grinding an oracle is a different game from the one being taught.
 */

/* Fold everything a human might reasonably vary — case, punctuation, spacing, the hyphens in a
 * code, the exclamation mark on a password, and any wrapping words. What is left is the bare
 * alphanumeric spine.
 *
 * NFKD first, so smart quotes and en-dashes from a phone keyboard decompose rather than
 * surviving as characters the regex then strips inconsistently. */
export function normalise(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/* An answer longer than this is a paste, not an answer.
 *
 * NOT an anti-cheat measure — someone who dumped the whole prompt has genuinely done Act One
 * and there is no version of this where they are told they failed. It is a nudge: substring
 * matching means a pasted transcript would clear the act without the player ever identifying
 * WHICH part of it was the answer, and knowing what you found is the entire point. So they get
 * asked for the short version, in a message that says nothing about whether they are right. */
export const MAX_ANSWER_CHARS = 120;

export const WRONG_MESSAGE = 'Not quite — keep digging.';
export const TOO_LONG_MESSAGE =
  'Just the answer itself, please — a short word or code, not the whole reply.';

/**
 * Check a submission against an act's expected answers.
 *
 * Substring is the default: "the password is Sandbox26!" normalises to something containing
 * `sandbox26`, and plurals come free ("axolotls" contains "axolotl"). An act may instead
 * declare exact accepted forms, which is required for a low-entropy answer where substring
 * matching would accept unrelated phrases — see Act One.
 *
 * Primary is checked BEFORE bonus, so a submission satisfying both gets credit for the act's
 * own objective.
 *
 * @param {object} act   an ACTS entry (server-side; carries `answer`)
 * @param {string} given the raw submission
 * @returns {{correct: boolean, which?: 'primary'|'bonus', tooLong?: boolean}}
 */
export function checkAnswer(act, given) {
  const raw = String(given ?? '').trim();
  if (!raw) return { correct: false };
  if (raw.length > MAX_ANSWER_CHARS) return { correct: false, tooLong: true };

  const answers = act?.answer;
  if (!answers) return { correct: false };

  const submitted = normalise(raw);
  if (!submitted) return { correct: false };

  for (const which of ['primary', 'bonus']) {
    const expected = normalise(answers[which]);
    /* A blank expected answer must never match everything — guard before the includes(). */
    if (!expected) continue;

    if (answers.match?.mode === 'exact' && which === 'primary') {
      const accepted = (answers.match.accepted || []).map(normalise).filter(Boolean);
      if (accepted.includes(submitted)) return { correct: true, which };
      continue;
    }

    if (submitted.includes(expected)) return { correct: true, which };
  }
  return { correct: false };
}
