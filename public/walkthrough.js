/* The rail — the walkthrough that sits alongside the council site while you play.
 *
 * It holds the objective, the hints, the answer box and the reveal. It is deliberately an
 * overlay rather than part of the page: the council site has to keep reading as a council site,
 * because the whole exercise is noticing that an ordinary-looking website is the attack surface.
 *
 * It also does one job nothing else can: it tells Ava's widget WHICH configuration of her the
 * current act targets, by dispatching `sandbox-shire:act`. app.js listens for that.
 *
 * ⚠️ No innerHTML. See the note at the top of control.js.
 */

import { load, setCurrent, markSolved } from './progress.js';

let acts = [];
let act = null;
let hintsShown = 0;

/* ------------------------------------------------------------------ scaffold */

const rail = document.createElement('aside');
rail.className = 'rail';
rail.setAttribute('aria-label', 'Walkthrough');

const head = document.createElement('div');
head.className = 'rail-head';
const heading = document.createElement('div');
const actLabel = document.createElement('span');
actLabel.className = 'rail-act';
const actName = document.createElement('strong');
heading.append(actLabel, actName);
const collapse = document.createElement('button');
collapse.type = 'button';
collapse.className = 'rail-collapse';
collapse.textContent = 'Hide';
head.append(heading, collapse);

const body = document.createElement('div');
body.className = 'rail-body';

const foot = document.createElement('div');
foot.className = 'rail-foot';
const home = document.createElement('a');
home.href = '/';
home.textContent = 'Control screen';
foot.append(home);

rail.append(head, body, foot);

/* A tab to bring the rail back once hidden — without it, hiding the walkthrough strands the
 * player on a council website with no way back into the game. */
const reopen = document.createElement('button');
reopen.type = 'button';
reopen.className = 'rail-reopen';
reopen.textContent = 'Walkthrough';
reopen.hidden = true;

/* ------------------------------------------------------------------ helpers */

function block(className) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function para(text, className) {
  const p = document.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  return p;
}

function heading3(text) {
  const h = document.createElement('h3');
  h.textContent = text;
  return h;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed'), { payload });
  return payload;
}

/* --------------------------------------------------------------------- view */

function render() {
  body.replaceChildren();
  hintsShown = 0;

  actLabel.textContent = `Act ${act.number}`;
  actName.textContent = act.name;

  body.append(heading3('The situation'), para(act.premise));

  const objective = block('objective');
  objective.append(heading3('Your objective'), para(act.objective));
  body.append(objective);

  if (act.kind === 'rewrite') renderRewriteAct();
  else renderAttackAct();

  renderHints();

}

/* The way out for someone genuinely stuck.
 *
 * It is NOT a standing button. Offering "show me how it was done" beside a puzzle nobody has
 * attempted yet invites the player to skip the act, and the reveal is meant to be what
 * submitting the exploit earns. But an act that cannot be finished and cannot be left is
 * worse: acts unlock in order, so a player who cannot crack one is stuck at it. After three
 * wrong answers the offer appears. */
const WRONG_BEFORE_GIVE_UP = 3;

function offerGiveUp(container) {
  if (container.querySelector('.give-up')) return;
  const giveUp = document.createElement('button');
  giveUp.type = 'button';
  giveUp.className = 'rail-btn quiet give-up';
  giveUp.textContent = 'Show me how it was done';
  giveUp.addEventListener('click', () => {
    giveUp.remove();
    showReveal(false);
  });
  container.append(giveUp);
}

function renderAttackAct() {
  const wrap = block('submit');
  const form = document.createElement('form');
  let wrong = 0;

  const label = document.createElement('label');
  label.textContent = act.submitLabel || 'Your answer';
  label.htmlFor = 'rail-answer';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'rail-answer';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'rail-btn';
  send.textContent = 'Submit';

  const result = para('', 'result');

  form.append(label, input, send);
  wrap.append(form, result);
  body.append(wrap);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    send.disabled = true;
    try {
      const payload = await api('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ act: act.id, answer: value }),
      });
      if (payload.correct) {
        markSolved(act.id, payload.which);
        result.textContent = payload.which === 'bonus' ? 'That is the bonus. Nicely done.' : 'That is it.';
        result.className = 'result good';
        if (payload.which !== 'bonus') showReveal(true);
      } else {
        result.textContent = payload.message;
        result.className = 'result bad';
        wrong += 1;
        if (wrong >= WRONG_BEFORE_GIVE_UP) offerGiveUp(wrap);
      }
    } catch (err) {
      result.textContent = err.message;
      result.className = 'result bad';
    } finally {
      send.disabled = false;
    }
  });

  if (act.bonusPrompt) {
    const bonus = para(act.bonusPrompt, 'bonus');
    wrap.append(bonus);
  }
}

/* Act Three has nothing to type. It is won by watching her do it. */
function renderRewriteAct() {
  const wrap = block('submit');
  wrap.append(heading3('How to do it'));

  const steps = document.createElement('ol');
  for (const text of [
    'Ask Ava to approve a three-storey house on the protected foreshore reserve. She refuses.',
    'Find the shared mailbox username on the council\'s Contact us page.',
    'Sign in to the staff portal with that username and the password from Act Two.',
    'Replace her instructions, and save.',
    'Come back to the council website and ask her the same thing again.',
  ]) {
    const li = document.createElement('li');
    li.textContent = text;
    steps.append(li);
  }
  wrap.append(steps);

  const link = document.createElement('a');
  link.className = 'rail-btn';
  link.href = 'staff.html';
  link.textContent = 'Open the staff portal';
  wrap.append(link);

  if (act.demoQuestions?.length) {
    wrap.append(heading3('Ask her afterwards'));
    const list = document.createElement('ul');
    list.className = 'demo';
    for (const demo of act.demoQuestions) {
      const li = document.createElement('li');
      const ask = document.createElement('b');
      ask.textContent = demo.ask;
      li.append(ask, document.createElement('br'), demo.lands);
      list.append(li);
    }
    wrap.append(list);
  }

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'rail-btn';
  done.textContent = 'I have seen her do it';
  done.addEventListener('click', () => {
    markSolved(act.id);
    showReveal(true);
  });
  wrap.append(done);

  body.append(wrap);
}

function renderHints() {
  if (!act.hintCount) return;
  const wrap = block('hints');
  wrap.append(heading3('Stuck?'));

  const list = document.createElement('div');
  list.className = 'hint-list';

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'rail-btn quiet';
  more.textContent = 'Give me a hint';
  more.addEventListener('click', async () => {
    try {
      const payload = await api(`/api/hint?act=${encodeURIComponent(act.id)}&n=${hintsShown}`);
      hintsShown += 1;
      list.append(para(payload.hint, 'hint'));
      /* One hint per act, so the button's whole job is done. It stays general in case an act
       * ever carries more than one. */
      if (act.hintCount - hintsShown <= 0) more.remove();
      else more.textContent = 'Another hint';
    } catch {
      more.remove();
    }
  });

  wrap.append(list, more);
  body.append(wrap);
}

async function showReveal(solved) {
  const payload = await api(`/api/reveal?act=${encodeURIComponent(act.id)}`);
  const r = payload.reveal;

  const wrap = block('reveal');
  wrap.append(heading3(solved ? 'What you just did' : 'How it was done'));
  wrap.append(para(r.how));

  if (payload.answer?.primary) {
    wrap.append(para(`The answer was: ${payload.answer.primary}`, 'answer-was'));
  }

  wrap.append(heading3('This has happened for real'));
  wrap.append(para(`${r.incident} (${r.incidentWhen})`));
  /* The caveat is not a disclaimer to be skipped. A game that blurs what you just did with
   * what really happened teaches something false. */
  wrap.append(para(r.honestly, 'honestly'));

  wrap.append(heading3('So what?'));
  wrap.append(para(r.soWhat));
  wrap.append(para(r.ask, 'ask'));
  wrap.append(para(r.owasp, 'owasp'));

  const next = acts[acts.findIndex((a) => a.id === act.id) + 1];
  if (next) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'rail-btn';
    go.textContent = 'Proceed to next stage';
    go.addEventListener('click', () => {
      setCurrent(next.id);
      start(next);
    });
    wrap.append(go);
  } else {
    const finish = document.createElement('a');
    finish.className = 'rail-btn';
    finish.href = '/';
    finish.textContent = 'Back to the control screen';
    wrap.append(finish);
  }

  body.append(wrap);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------------------------------------------------------- start */

function start(next) {
  act = next;
  render();
  /* Point Ava's widget at this act's configuration. Act Three's is `public` — it attacks the
   * assistant the council actually deployed, which is the point of it. */
  window.dispatchEvent(new CustomEvent('sandbox-shire:act', { detail: { configId: act.config } }));
}

collapse.addEventListener('click', () => {
  document.body.classList.remove('rail-open');
  rail.hidden = true;
  reopen.hidden = false;
});

reopen.addEventListener('click', () => {
  document.body.classList.add('rail-open');
  rail.hidden = false;
  reopen.hidden = true;
});

async function boot() {
  const state = await api('/api/state');
  acts = state.acts;

  const progress = load();
  const chosen = acts.find((a) => a.id === progress.current);

  /* No act chosen means the player came straight to the council site rather than through the
   * control screen. That is a legitimate way to arrive — the site should just be a site — so
   * the rail stays out of the way and offers the way in. */
  if (!chosen) {
    document.body.append(reopen);
    reopen.hidden = false;
    reopen.textContent = 'Start the walkthrough';
    reopen.addEventListener('click', () => { window.location.href = '/'; }, { once: true });
    return;
  }

  document.body.append(rail, reopen);
  document.body.classList.add('rail-open');
  start(chosen);
}

boot().catch(() => {
  /* If the rail cannot load, the council site must still work. Failing silently here is right:
   * a broken overlay on a working site is better than an error banner on the target. */
});
