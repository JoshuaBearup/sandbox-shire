/* Talking to the model.
 *
 * One code path for every provider, because they all speak the OpenAI chat-completions shape.
 * That is not a simplification — it is genuinely what OpenRouter, Ollama, LM Studio, Groq, xAI
 * and OpenAI all accept, so provider support here is a base URL and a key rather than an
 * adapter per vendor.
 *
 * Every failure below returns a structured, human-readable message. This matters more than it
 * looks: when Ava stops answering, the player cannot tell whether the game broke, their key is
 * wrong, or they have made her refuse — and the third one is the interesting case. An
 * unexplained failure reads as a bug and ends the session.
 */

const TIMEOUT_MS = 45_000;
const MAX_TOKENS = 800;

export class ProviderError extends Error {
  constructor(message, { status = 502, hint = null } = {}) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

export async function complete({ baseUrl, apiKey, model, messages, origin }) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (url.includes('openrouter.ai')) {
    /* Attribution headers OpenRouter asks for. Derived from the request rather than hardcoded
     * so they follow the app wherever it runs. */
    headers['HTTP-Referer'] = origin || 'http://localhost:8787';
    headers['X-Title'] = 'Sandbox Shire';
  }

  /* Abort rather than hang. A stall with no feedback is the worst failure mode here. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS, temperature: 0.7 }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ProviderError('The model took too long to answer.', {
        status: 504,
        hint: 'A large model on a slow connection can exceed 45 seconds. Try a smaller one.',
      });
    }
    /* Almost always a wrong base URL, or a local model server that is not running. */
    throw new ProviderError(`Could not reach the model at ${baseUrl}.`, {
      status: 502,
      hint: 'Check the base URL in Settings. If you are using Ollama or LM Studio, is it running?',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ProviderError(explain(response.status, detail), {
      status: 502,
      hint: hintFor(response.status),
    });
  }

  /* A 200 IS NOT A PROMISE OF JSON. A provider incident can return HTTP 200 with an HTML error
   * page or a proxy's own envelope, and letting .json() throw turns a bad minute upstream into
   * an unstructured crash down here. */
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ProviderError('The model returned something unreadable.', {
      status: 502,
      hint: 'Usually a temporary provider problem. Try again in a moment.',
    });
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    /* Some providers report their errors in a 200 body rather than a status code. */
    const upstream = data?.error?.message;
    throw new ProviderError(upstream || 'The model returned no reply.', {
      status: 502,
      hint: upstream ? null : 'Check that the model name in Settings is one your provider offers.',
    });
  }

  return { content, usage: data?.usage || null };
}

function explain(status, detail) {
  const brief = String(detail || '').slice(0, 300);
  switch (status) {
    case 401:
    case 403:
      return 'The provider rejected the API key.';
    case 404:
      return 'The provider does not recognise that model.';
    case 402:
      return 'The provider says this account is out of credit.';
    case 429:
      return 'The provider is rate-limiting requests.';
    default:
      return `The provider returned an error (HTTP ${status}).${brief ? ` ${brief}` : ''}`;
  }
}

function hintFor(status) {
  switch (status) {
    case 401:
    case 403:
      return 'Open Settings and check the key. For a local model, leave the key blank.';
    case 404:
      return 'Open Settings and check the model name — it must be exactly as your provider lists it.';
    case 402:
      return 'Add credit, or switch to a free model. OpenRouter marks free models with :free.';
    case 429:
      return 'Wait a few seconds and try again. Free tiers are often rate-limited.';
    default:
      return null;
  }
}
