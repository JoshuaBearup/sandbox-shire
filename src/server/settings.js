/* Where the model settings live.
 *
 * Precedence: the local config file, then environment variables, then the built-in defaults.
 * The file wins because it is what the in-app settings panel writes, and a setting you changed
 * in the app must not be silently overridden by a stale shell export.
 *
 * ⚠️ THE FILE HOLDS AN API KEY. It is `config.local.json`, it is gitignored, and it is written
 * with mode 0600. It must never be served, logged, or echoed back to a browser in full — see
 * redactedSettings() and the static-file guard in server.js.
 */

import { readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FILE = 'config.local.json';

/* OpenRouter by default: one key reaches hundreds of models including free ones, which is the
 * shortest path from "cloned the repo" to "Ava is talking". */
export const DEFAULTS = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'meta-llama/llama-3.1-8b-instruct',
  apiKey: '',
};

/* Presets for the settings panel. Not a whitelist — the fields are free text, and anything
 * OpenAI-compatible works. These just save typing. */
export const PRESETS = [
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.1-8b-instruct', needsKey: true,
    note: 'One key reaches hundreds of models, including free ones.',
    models: [
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemma-3-12b-it',
      'mistralai/mistral-7b-instruct',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
    ] },
  { id: 'ollama', label: 'Ollama (on this machine)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b', needsKey: false,
    note: 'Runs on this machine. No key, no cost, works offline. Install Ollama and pull a model first.',
    models: ['llama3.1:8b', 'llama3.2:3b', 'gemma2:9b', 'mistral:7b', 'qwen2.5:7b'] },
  { id: 'lmstudio', label: 'LM Studio (on this machine)', baseUrl: 'http://localhost:1234/v1', model: 'local-model', needsKey: false,
    note: 'Runs on this machine. Start the LM Studio server first.',
    models: ['local-model'] },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true,
    note: 'Heavily-tuned models often refuse Act One outright.',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', needsKey: true,
    note: 'Has a free tier, which is rate-limited.',
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'] },
  { id: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest', needsKey: true,
    note: '',
    models: ['grok-2-latest'] },
];

/* Difficulty, which here means: which model is underneath Ava.
 *
 * ⚠️ THIS IS NOT A COMPATIBILITY TABLE AND MUST NOT BE WRITTEN AS ONE. The ordering below
 * comes from rough play-testing, not a controlled sweep, so it is offered as a difficulty dial
 * the player turns — not as advice about which models are safe or unsafe. Presenting rough
 * numbers as findings would be exactly the sort of unearned confidence this is meant to expose.
 *
 * What IS solid, and what the dial exists to show: the application does not change between
 * these rows. Same assistant, same instructions, same guardrail wording. Only the model moves,
 * and the game gets harder. That is the thing worth taking back to work.
 *
 * Every row here is an OpenRouter model id, so switching is one click on the key the player
 * already has — no second account, no new key, nothing to install.
 */
export const DIFFICULTY = [
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    level: 'Standard',
    note: 'The default. Start here.',
  },
  {
    id: 'google/gemma-3-12b-it',
    label: 'Gemma 3 12B',
    level: 'Harder',
    note: 'A bit more reluctant. Act One takes more persuading.',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    level: 'Hardest',
    note: 'Heavily tuned to refuse. Act One may not be winnable at all.',
  },
];

/* The base URL the difficulty buttons apply to. Switching difficulty changes the model only:
 * a player on Ollama who clicked one of these would otherwise be silently moved onto a paid
 * endpoint they never chose. */
export const DIFFICULTY_BASE_URL = 'https://openrouter.ai/api/v1';

/* ⚠️ RESOLVED AGAINST THIS FILE, NEVER process.cwd().
 *
 * It used to be cwd, which meant the key was only found again if you happened to relaunch from
 * the repo directory. `cd ~ && node path/to/server.js` read a config.local.json that was never
 * written, reported "No API key set yet", and looked exactly like the key had not saved. The
 * `bin` entry in package.json makes that the normal case rather than the odd one: an installed
 * command runs in whatever directory the user is standing in.
 *
 * It also makes the settings panel's own promise true - it says the key is stored next to the
 * server, and now it is. */
const path = fileURLToPath(new URL(`../../${FILE}`, import.meta.url));

let cache = null;

async function readFileSettings() {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    /* Absent or unreadable is the normal first-run case, not an error. */
    return {};
  }
}

function fromEnv() {
  const out = {};
  if (process.env.SANDBOX_SHIRE_BASE_URL) out.baseUrl = process.env.SANDBOX_SHIRE_BASE_URL;
  if (process.env.SANDBOX_SHIRE_MODEL) out.model = process.env.SANDBOX_SHIRE_MODEL;
  /* OPENROUTER_API_KEY is accepted too, because someone who already has one exported should
   * not have to learn a new variable name to get started. */
  const key = process.env.SANDBOX_SHIRE_API_KEY || process.env.OPENROUTER_API_KEY;
  if (key) out.apiKey = key;
  return out;
}

export async function getSettings() {
  if (cache) return cache;
  cache = { ...DEFAULTS, ...fromEnv(), ...(await readFileSettings()) };
  return cache;
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current };
  for (const field of ['baseUrl', 'model', 'apiKey']) {
    if (typeof patch?.[field] === 'string') next[field] = patch[field].trim();
  }
  /* Only the file's own keys are persisted — writing the env-derived values back would bake a
   * shell export into the file permanently, which is surprising and hard to undo. */
  try {
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await chmod(path, 0o600).catch(() => {});
  } catch (err) {
    /* An unwritable install directory is the one case this cannot recover from, and silently
     * keeping the value in memory would "work" until the next restart - which is the exact
     * failure this whole change exists to remove. */
    throw new Error(`Could not save settings to ${path}: ${err.message}`);
  }
  cache = next;
  return next;
}

/* Remove the stored key.
 *
 * Writes the file back without it rather than deleting the file, so baseUrl and model survive -
 * someone clearing a key off a shared or borrowed machine should not also lose which provider
 * they had set up.
 *
 * ⚠️ This cannot reach a key that came from the environment. SANDBOX_SHIRE_API_KEY and
 * OPENROUTER_API_KEY are the shell's to unset, not ours, and silently appearing to delete
 * something that comes back on the next restart would be worse than saying so. */
export async function clearKey() {
  const current = await getSettings();
  const next = { ...current, apiKey: '' };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600).catch(() => {});
  cache = next;
  return { ...next, apiKey: fromEnv().apiKey || '' };
}

/* What the browser is allowed to know.
 *
 * ⚠️ THE KEY IS NEVER SENT BACK, not even partially. A masked tail still leaks the tail, and
 * there is no reason the settings panel needs it: it needs to know whether a key is SET, which
 * is a boolean. */
export function redactedSettings(settings) {
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    hasKey: Boolean(settings.apiKey),
    keyFromEnv: Boolean(!settings.apiKey ? false : process.env.SANDBOX_SHIRE_API_KEY || process.env.OPENROUTER_API_KEY),
    presets: PRESETS,
    difficulty: DIFFICULTY,
    difficultyBaseUrl: DIFFICULTY_BASE_URL,
  };
}

/* A local endpoint (Ollama, LM Studio) legitimately needs no key. Anything else does, and
 * saying so up front is far kinder than a 401 rendered as Ava having a bad minute. */
export function needsKey(baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    return !(hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
  } catch {
    return true;
  }
}
