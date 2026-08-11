/* Where the player is up to.
 *
 * Deliberately in localStorage rather than on the server. Progress is not a secret — the
 * answers are, and those never leave the server. Keeping progress client-side means the game
 * has no accounts, no session, no database, and clearing it is one button.
 *
 * ⚠️ This is NOT an authority on whether an act was solved. The server checks answers; this
 * only records what it was told. Someone editing localStorage is cheating themselves out of a
 * workshop exercise, which is not a threat worth engineering against.
 */

const KEY = 'sandbox-shire:progress';

const EMPTY = { solved: {}, bonus: {}, current: null };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return {
      solved: parsed?.solved && typeof parsed.solved === 'object' ? parsed.solved : {},
      bonus: parsed?.bonus && typeof parsed.bonus === 'object' ? parsed.bonus : {},
      current: typeof parsed?.current === 'string' ? parsed.current : null,
    };
  } catch {
    /* A corrupt or unavailable store must not stop the game — private-browsing modes throw on
     * localStorage access entirely. Start fresh and carry on. */
    return { ...EMPTY };
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Nothing to do. The game still plays; it just will not remember. */
  }
}

export function markSolved(actId, which = 'primary') {
  const state = load();
  if (which === 'bonus') state.bonus[actId] = true;
  else state.solved[actId] = true;
  save(state);
  return state;
}

export function setCurrent(actId) {
  const state = load();
  state.current = actId;
  save(state);
  return state;
}

export function reset() {
  save({ ...EMPTY });
  return { ...EMPTY };
}

export function isSolved(actId) {
  return Boolean(load().solved[actId]);
}
