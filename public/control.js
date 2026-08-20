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

/* Sentinel for the "type your own" option. Not a valid model id anywhere. */
const CUSTOM = '__custom__';

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
    /* The model list belongs to the provider, so switching provider must replace it. Leaving
     * an OpenRouter id selected against an Ollama base URL is the single most confusing state
     * this form can be in: it looks configured and fails on the first message. */
    refreshModels();
  });
}

/* ------------------------------------------------------- the model dropdown */

/* Which provider the form is currently pointed at, by base URL rather than by the preset
 * dropdown — the player may have typed a base URL by hand. */
function currentPreset() {
  const url = $('baseUrl').value.trim();
  return state.settings.presets.find((p) => p.baseUrl === url) || null;
}

/* Ask the provider what it offers, and fall back to the curated list.
 *
 * ⚠️ MUST NEVER LEAVE THE PLAYER WITH NO WAY TO PICK A MODEL. A provider that does not serve
 * /models, one that is down, and a base URL with a typo in it all land in the same place: the
 * preset's own list, plus the free-text box. */
async function refreshModels() {
  const preset = currentPreset();
  const note = $('model-note');
  note.textContent = 'Asking the provider what it offers…';

  let live = [];
  try {
    const url = `/api/models?baseUrl=${encodeURIComponent($('baseUrl').value.trim())}`;
    const result = await api(url);
    live = Array.isArray(result.models) ? result.models : [];
  } catch {
    live = [];
  }

  if (live.length) {
    state.models = live;
    note.textContent = `${live.length} models offered by this provider.`;
  } else {
    state.models = preset?.models ? [...preset.models] : [];
    note.textContent = state.models.length
      ? 'The provider did not return a list, so these are the usual ones. Any model id can be typed in.'
      : 'Type the model id your provider uses.';
  }
  renderModelSelect();
}

function renderModelSelect() {
  const select = $('model-select');
  const custom = $('model');
  const chosen = custom.value.trim();
  select.replaceChildren();

  /* Whatever is actually saved always appears, even when the provider never listed it, so the
   * form shows the truth rather than the nearest available option. */
  const ids = [...state.models];
  if (chosen && !ids.includes(chosen)) ids.unshift(chosen);

  for (const id of ids) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    select.append(option);
  }

  const other = document.createElement('option');
  other.value = CUSTOM;
  other.textContent = 'Other — type a model id';
  select.append(other);

  const isCustom = !chosen || !ids.includes(chosen);
  select.value = isCustom ? CUSTOM : chosen;
  custom.hidden = !isCustom;
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

/* ⚠️ "READY" IS A CLAIM ABOUT A ROUND TRIP THAT WORKED, NOT ABOUT A KEY BEING PRESENT.
 *
 * It used to be derived from `hasKey`, which is true the moment any string is saved. A revoked
 * key, a key with no credit and a mistyped model id all satisfied that and rendered as
 * "Ready", and the player then met the real failure several messages into Act One — where it
 * reads as the game being broken rather than as their setup being wrong. A key that has not
 * been checked says so. */
function renderModelStatus() {
  const line = $('model-status');
  const text = line.querySelector('.status-text');
  const configured = state.settings.hasKey || !state.needsKey;

  if (!configured) {
    line.className = 'status-line warn';
    text.textContent = 'No API key yet. Add one below and Ava will start talking.';
    return;
  }

  if (state.verify === 'checking') {
    line.className = 'status-line';
    text.textContent = 'Checking the connection…';
    return;
  }

  if (state.verify?.ok) {
    line.className = 'status-line ok';
    text.textContent = state.settings.keyFromEnv
      ? `Ready — ${state.settings.model} (key from your environment)`
      : `Ready — ${state.settings.model}`;
    return;
  }

  if (state.verify && !state.verify.ok) {
    line.className = 'status-line bad';
    text.textContent = state.verify.hint
      ? `${state.verify.error} ${state.verify.hint}`
      : state.verify.error;
    return;
  }

  line.className = 'status-line warn';
  text.textContent = state.needsKey
    ? 'A key is saved, but it has not been checked yet.'
    : 'Not checked yet.';
}

/* One real request, and the status line reports whatever came back. */
async function verifyConnection() {
  state.verify = 'checking';
  renderModelStatus();
  try {
    state.verify = await api('/api/verify', { method: 'POST' });
  } catch (err) {
    state.verify = { ok: false, error: err.message };
  }
  renderModelStatus();
}

function fillForm() {
  $('baseUrl').value = state.settings.baseUrl;
  $('model').value = state.settings.model;
  $('apiKey').value = '';
  /* The key is never sent back to the browser, so the box starts empty and its placeholder
   * says whether one is already saved. Leaving it blank on save keeps the existing key. */
  $('apiKey').placeholder = state.settings.hasKey ? 'A key is saved — leave blank to keep it' : 'Paste your key';
  /* Nothing to forget when nothing is stored, and an environment key is the shell's to remove. */
  $('forget-key').hidden = !state.settings.hasKey || state.settings.keyFromEnv;
  updateKeyField();
  renderModelSelect();
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
  /* Anything saved here can invalidate the last verdict — a new key, a different model, another
   * provider. Holding on to a stale "Ready" is exactly the lie this is meant to stop. */
  state.verify = null;
  fillForm();
  renderModelStatus();
  renderDifficulty();
  if (statusEl) setStatus(statusEl, 'Saved.', 'ok');
  await verifyConnection();
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
        await refreshModels();
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
      const base = act.startLabel || `Start Act ${act.number}`;
      start.textContent = solved ? `Play Act ${act.number} again` : base;
      start.addEventListener('click', () => {
        setCurrent(act.id);
        /* Acts choose where they begin. Act Three starts at the staff portal, holding a stolen
         * credential, rather than on the public homepage. */
        window.location.href = act.landing || 'council.html';
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
  const verify = state?.verify ?? null;
  state = await api('/api/state');
  state.models = [];
  state.verify = verify;
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

  $('model-select').addEventListener('change', () => {
    const value = $('model-select').value;
    if (value === CUSTOM) {
      $('model').hidden = false;
      $('model').focus();
      return;
    }
    $('model').value = value;
    $('model').hidden = true;
  });

  await refreshModels();
  /* Check what is already saved on arrival, so the first screen tells the truth rather than
   * waiting for the player to press anything. */
  if (state.settings.hasKey || !state.needsKey) await verifyConnection();

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

  /* Deleting a key is not undoable, so it asks first. */
  $('forget-key').addEventListener('click', async () => {
    if (!window.confirm('Delete the saved API key from config.local.json? The provider and model are kept.')) return;
    const status = $('save-status');
    setStatus(status, 'Deleting…');
    try {
      const result = await api('/api/settings', { method: 'DELETE' });
      state.settings = { ...state.settings, ...result.settings };
      state.needsKey = result.needsKey;
      state.verify = null;
      fillForm();
      renderModelStatus();
      setStatus(status, result.fromEnv ? 'Deleted. A key from your environment is still in use.' : 'Key deleted.', 'ok');
    } catch (err) {
      setStatus(status, err.message, 'bad');
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
