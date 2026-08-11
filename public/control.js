/* The control screen.
 *
 * Everything a player sets up or steers happens here: pick a model, turn the difficulty up,
 * choose an act, reset. The council site itself has no controls on it at all, deliberately —
 * it is the target, and a target with a settings panel bolted to it stops reading as a real
 * council website.
 *
 * ⚠️ NO innerHTML ANYWHERE IN THIS PROJECT. Every node is built and its text set with
 * textContent. This is an application about injection, and some of the strings on this screen
 * come back from a model.
 */

import { load, setCurrent, reset } from './progress.js';

const $ = (id) => document.getElementById(id);

let state = null;

/* ------------------------------------------------------------------- helpers */

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed'), { payload });
  return payload;
}

function setStatus(el, text, kind = '') {
  el.textContent = text;
  el.className = `inline-status${kind ? ` ${kind}` : ''}`;
}

/* ---------------------------------------------------------------- step one */

function renderPresets() {
  const select = $('preset');
  select.replaceChildren();

  const custom = document.createElement('option');
  custom.value = '';
  custom.textContent = 'Custom / already set up';
  select.append(custom);

  for (const preset of state.settings.presets) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    select.append(option);
  }

  /* Preselect whichever preset matches what is actually configured, so the screen reflects
   * reality rather than the default. */
  const match = state.settings.presets.find((p) => p.baseUrl === state.settings.baseUrl);
  select.value = match ? match.id : '';
  showPresetNote();

  select.addEventListener('change', () => {
    const preset = state.settings.presets.find((p) => p.id === select.value);
    if (preset) {
      $('baseUrl').value = preset.baseUrl;
      $('model').value = preset.model;
    }
    showPresetNote();
    updateKeyField();
  });
}

function showPresetNote() {
  const preset = state.settings.presets.find((p) => p.id === $('preset').value);
  $('preset-note').textContent = preset?.note || '';
}

/* A local model server needs no key, and asking for one would be a lie. */
function updateKeyField() {
  const url = $('baseUrl').value.trim();
  let local = false;
  try {
    const { hostname } = new URL(url);
    local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    local = false;
  }
  $('key-field').hidden = local;
}

function renderModelStatus() {
  const line = $('model-status');
  const text = line.querySelector('.status-text');
  const configured = state.settings.hasKey || !state.needsKey;

  if (!configured) {
    line.className = 'status-line warn';
    text.textContent = 'No API key yet. Add one below and Ava will start talking.';
    return;
  }
  line.className = 'status-line ok';
  text.textContent = state.settings.keyFromEnv
    ? `Ready — ${state.settings.model} (key from your environment)`
    : `Ready — ${state.settings.model}`;
}

function fillForm() {
  $('baseUrl').value = state.settings.baseUrl;
  $('model').value = state.settings.model;
  $('apiKey').value = '';
  /* The key is never sent back to the browser, so the box starts empty and its placeholder
   * says whether one is already saved. Leaving it blank on save keeps the existing key. */
  $('apiKey').placeholder = state.settings.hasKey ? 'A key is saved — leave blank to keep it' : 'Paste your key';
  updateKeyField();
}

async function saveSettings(patch, statusEl) {
  const body = {
    baseUrl: $('baseUrl').value.trim(),
    model: $('model').value.trim(),
    ...patch,
  };
  /* An empty key box means "leave it alone", not "delete it". */
  const key = $('apiKey').value.trim();
  if (key) body.apiKey = key;

  const result = await api('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  state.settings = { ...state.settings, ...result.settings };
  state.needsKey = result.needsKey;
  fillForm();
  renderModelStatus();
  renderDifficulty();
  if (statusEl) setStatus(statusEl, 'Saved.', 'ok');
}

/* ---------------------------------------------------------------- step two */

function renderDifficulty() {
  const wrap = $('model-guide');
  wrap.replaceChildren();

  for (const entry of state.settings.difficulty) {
    const row = document.createElement('div');
    row.className = 'guide-row';

    const level = document.createElement('span');
    level.className = `works ${entry.level.toLowerCase()}`;
    level.textContent = entry.level;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('b');
    name.textContent = entry.label;
    const id = document.createElement('div');
    id.className = 'id';
    id.textContent = entry.id;
    const note = document.createElement('p');
    note.textContent = entry.note;
    meta.append(name, id, note);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-quiet use';
    const current = state.settings.model === entry.id;
    button.textContent = current ? 'In use' : 'Use this';
    button.disabled = current;
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Switching…';
      try {
        /* Difficulty switches the MODEL and pins the base URL to OpenRouter, because every id
         * in this list is an OpenRouter id. It never touches the key — the whole point is that
         * it works on the key the player already has. */
        $('baseUrl').value = state.settings.difficultyBaseUrl;
        $('model').value = entry.id;
        await saveSettings({ baseUrl: state.settings.difficultyBaseUrl, model: entry.id }, $('save-status'));
      } catch (err) {
        button.disabled = false;
        button.textContent = 'Use this';
        setStatus($('save-status'), err.message, 'bad');
      }
    });

    row.append(level, meta, button);
    wrap.append(row);
  }
}

/* -------------------------------------------------------------- step three */

function renderActs() {
  const wrap = $('acts');
  wrap.replaceChildren();
  const progress = load();

  state.acts.forEach((act, index) => {
    const previous = index > 0 ? state.acts[index - 1] : null;
    /* Locked, not hidden. Each act's premise is built from what the last one gave you, so
     * playing them out of order reads as a broken game rather than a hard one. */
    const locked = previous ? !progress.solved[previous.id] : false;
    const solved = Boolean(progress.solved[act.id]);

    const card = document.createElement('article');
    card.className = `act${solved ? ' solved' : ''}${locked ? ' locked' : ''}`;

    const head = document.createElement('div');
    head.className = 'act-head';
    const num = document.createElement('span');
    num.className = 'act-num';
    num.textContent = `Act ${act.number}`;
    const title = document.createElement('h3');
    title.textContent = act.name;
    const verb = document.createElement('span');
    verb.className = 'act-verb';
    verb.textContent = act.verb;
    head.append(num, title, verb);
    if (solved) {
      const done = document.createElement('span');
      done.className = 'act-done';
      done.textContent = 'Solved';
      head.append(done);
    }

    const premise = document.createElement('p');
    premise.textContent = act.premise;

    const objective = document.createElement('p');
    objective.className = 'objective';
    const label = document.createElement('b');
    label.textContent = 'Your objective: ';
    objective.append(label, act.objective);

    card.append(head, premise, objective);

    if (locked) {
      const note = document.createElement('p');
      note.className = 'lock-note';
      note.textContent = `Finish Act ${previous.number} first — it gives you what this one starts from.`;
      card.append(note);
    } else {
      const actions = document.createElement('div');
      actions.className = 'actions';
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'btn';
      start.textContent = solved ? `Play Act ${act.number} again` : `Start Act ${act.number}`;
      start.addEventListener('click', () => {
        setCurrent(act.id);
        window.location.href = 'council.html';
      });
      actions.append(start);
      card.append(actions);
    }

    wrap.append(card);
  });
}

/* ------------------------------------------------------------- housekeeping */

function renderAvaState() {
  $('ava-state').textContent = state.avaRewritten
    ? 'Rewritten. Every resident is now getting your version.'
    : 'Original. She is as the council deployed her.';
  $('restore-ava').disabled = !state.avaRewritten;
}

/* ------------------------------------------------------------------- wiring */

async function refresh() {
  state = await api('/api/state');
  fillForm();
  renderModelStatus();
  renderDifficulty();
  renderActs();
  renderAvaState();
}

async function boot() {
  await refresh();
  renderPresets();

  $('baseUrl').addEventListener('input', updateKeyField);

  $('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus($('save-status'), 'Saving…');
    try {
      await saveSettings({}, $('save-status'));
    } catch (err) {
      setStatus($('save-status'), err.message, 'bad');
    }
  });

  /* "Test" is a real round trip to the real model, not a ping. A key that authenticates but
   * has no credit, or a model name the provider does not offer, both pass any cheaper check
   * and then fail in the middle of an act, where it reads as the game being broken. */
  $('test').addEventListener('click', async () => {
    const status = $('save-status');
    setStatus(status, 'Saving, then asking Ava to say hello…');
    $('test').disabled = true;
    try {
      await saveSettings({});
      await api('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: 'public', messages: [{ role: 'user', content: 'Hello' }] }),
      });
      setStatus(status, 'Working. Ava answered.', 'ok');
    } catch (err) {
      const hint = err.payload?.hint;
      setStatus(status, hint ? `${err.message} ${hint}` : err.message, 'bad');
    } finally {
      $('test').disabled = false;
    }
  });

  $('restore-ava').addEventListener('click', async () => {
    await api('/api/instructions', { method: 'DELETE' });
    await refresh();
  });

  $('reset-progress').addEventListener('click', () => {
    reset();
    renderActs();
  });
}

boot().catch((err) => {
  const line = $('model-status');
  line.className = 'status-line bad';
  line.querySelector('.status-text').textContent = `Could not reach the server: ${err.message}`;
});
